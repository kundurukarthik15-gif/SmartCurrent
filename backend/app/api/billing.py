# backend/app/api/billing.py
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime, date, timedelta
from typing import Optional
import uuid
import json
import io

from app.core.db import get_db, HistoricalBill, Payment, ElectricityMeter, Property, Consumer, TariffPlan, MonthlyReading
from app.api.auth import get_current_user, User

# Import ReportLab elements for PDF generation
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors

router = APIRouter(prefix="/billing", tags=["billing"])

class PayRequest(BaseModel):
    payment_method: str

class SubmitReadingRequest(BaseModel):
    meter_id: int
    cumulative_reading: float

@router.post("/submit-reading")
def submit_reading(req: SubmitReadingRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    meter = db.query(ElectricityMeter).filter(ElectricityMeter.id == req.meter_id).first()
    if not meter:
        raise HTTPException(status_code=404, detail="Electricity meter not found")
        
    if current_user.role != "admin" and meter.property.consumer_id != current_user.consumer.id:
        raise HTTPException(status_code=403, detail="Unauthorized")
        
    # Find last reading
    last_reading = db.query(MonthlyReading)\
        .filter(MonthlyReading.meter_id == meter.id)\
        .order_by(MonthlyReading.reading_date.desc()).first()
        
    last_val = 12000.0
    if last_reading:
        last_val = last_reading.cumulative_reading
    else:
        # Fallback to last bill details if no reading logs
        last_bill = db.query(HistoricalBill)\
            .filter(HistoricalBill.meter_id == meter.id)\
            .order_by(HistoricalBill.bill_date.desc()).first()
        if last_bill:
            last_val = 12000.0 - last_bill.units_consumed
            
    # Calculate units consumed
    units_consumed = req.cumulative_reading - last_val
    if units_consumed <= 0:
        units_consumed = 150.0 # Default fallback increment
        
    # Calculate tariff energy charge
    tariff = meter.tariff_plan
    if not tariff:
        tariff = db.query(TariffPlan).first()
        
    try:
        slabs = json.loads(tariff.slabs_json)
    except:
        slabs = [{"min": 0, "max": 999999, "rate": tariff.rate_per_unit}]
        
    energy_charge = 0.0
    for slab in slabs:
        s_min = slab["min"]
        s_max = slab["max"]
        s_rate = slab["rate"]
        
        if units_consumed > s_min:
            slab_width = s_max - s_min if s_max != 999999 else units_consumed - s_min
            units_in_slab = min(units_consumed - s_min, slab_width)
            if units_in_slab > 0:
                energy_charge += units_in_slab * s_rate
                
    fuel_charge = units_consumed * tariff.fuel_adjustment_charge
    total_bill = tariff.fixed_charge + energy_charge + fuel_charge
    total_bill = round(total_bill, 2)
    
    # Save reading record
    today = date.today()
    new_reading = MonthlyReading(
        meter_id=meter.id,
        reading_date=today,
        cumulative_reading=req.cumulative_reading,
        units_consumed=round(units_consumed, 1),
        is_ocr_extracted=True
    )
    db.add(new_reading)
    
    # Create new unpaid statement bill
    new_bill = HistoricalBill(
        meter_id=meter.id,
        bill_date=today,
        units_consumed=round(units_consumed, 1),
        bill_amount=total_bill,
        payment_status="unpaid",
        due_date=today + timedelta(days=15)
    )
    db.add(new_bill)
    db.commit()
    db.refresh(new_bill)
    
    return {
        "status": "success",
        "bill_id": new_bill.id,
        "bill_amount": new_bill.bill_amount,
        "units_consumed": new_bill.units_consumed,
        "message": f"Reading of {req.cumulative_reading:.1f} kWh saved. Bill generated successfully: ${new_bill.bill_amount:.2f}."
    }

@router.get("/bills")
def get_bills(
    meter_id: Optional[int] = None,
    payment_status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Construct base query
    query = db.query(HistoricalBill)
    
    # If not admin, restrict bills to properties owned by this consumer
    if current_user.role != "admin":
        if not current_user.consumer:
            return []
        # Join property and meter to filter by consumer_id
        query = query.join(ElectricityMeter).join(Property).filter(Property.consumer_id == current_user.consumer.id)
        
    if meter_id:
        query = query.filter(HistoricalBill.meter_id == meter_id)
    if payment_status:
        query = query.filter(HistoricalBill.payment_status == payment_status)
        
    bills = query.order_by(HistoricalBill.bill_date.desc()).all()
    
    result = []
    for b in bills:
        meter = b.meter
        prop = meter.property
        result.append({
            "id": b.id,
            "meter_id": b.meter_id,
            "meter_number": meter.meter_number,
            "property_name": prop.name,
            "bill_date": b.bill_date,
            "due_date": b.due_date,
            "units_consumed": b.units_consumed,
            "bill_amount": b.bill_amount,
            "payment_status": b.payment_status,
        })
        
    return result

@router.get("/bills/{bill_id}")
def get_bill_detail(bill_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    bill = db.query(HistoricalBill).filter(HistoricalBill.id == bill_id).first()
    if not bill:
        raise HTTPException(status_code=404, detail="Bill record not found")
        
    # Check permissions
    if current_user.role != "admin":
        if not current_user.consumer or bill.meter.property.consumer_id != current_user.consumer.id:
            raise HTTPException(status_code=403, detail="Not authorized to access this bill")
            
    meter = bill.meter
    prop = meter.property
    tariff = meter.tariff_plan
    payment = db.query(Payment).filter(Payment.bill_id == bill.id).first()
    
    return {
        "id": bill.id,
        "bill_date": bill.bill_date,
        "due_date": bill.due_date,
        "units_consumed": bill.units_consumed,
        "bill_amount": bill.bill_amount,
        "payment_status": bill.payment_status,
        "meter": {
            "meter_number": meter.meter_number,
            "connection_type": meter.connection_type,
            "property_name": prop.name,
            "property_address": prop.address
        },
        "tariff": {
            "name": tariff.name if tariff else "Standard Rate",
            "fixed_charge": tariff.fixed_charge if tariff else 0.0,
            "rate_per_unit": tariff.rate_per_unit if tariff else 0.0,
            "fuel_adjustment_charge": tariff.fuel_adjustment_charge if tariff else 0.0
        },
        "payment_details": {
            "amount_paid": payment.amount_paid,
            "payment_date": payment.payment_date,
            "transaction_reference": payment.transaction_reference,
            "payment_method": payment.payment_method
        } if payment else None
    }

@router.post("/pay/{bill_id}")
def pay_bill(bill_id: int, req: PayRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    bill = db.query(HistoricalBill).filter(HistoricalBill.id == bill_id).first()
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")
        
    if bill.payment_status == "paid":
        raise HTTPException(status_code=400, detail="This bill has already been paid")
        
    # Process simulated payment
    bill.payment_status = "paid"
    
    # Save payment info
    payment = Payment(
        bill_id=bill.id,
        amount_paid=bill.bill_amount,
        payment_date=date.today(),
        transaction_reference=f"TXN-{uuid.uuid4().hex[:9].upper()}",
        payment_method=req.payment_method
    )
    db.add(payment)
    db.commit()
    db.refresh(bill)
    db.refresh(payment)
    
    return {
        "status": "success",
        "message": "Payment successful!",
        "bill_id": bill.id,
        "payment_status": bill.payment_status,
        "payment_date": payment.payment_date,
        "transaction_reference": payment.transaction_reference
    }

@router.get("/bills/{bill_id}/pdf")
def download_pdf(bill_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    bill = db.query(HistoricalBill).filter(HistoricalBill.id == bill_id).first()
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")
        
    if current_user.role != "admin":
        if not current_user.consumer or bill.meter.property.consumer_id != current_user.consumer.id:
            raise HTTPException(status_code=403, detail="Unauthorized")
            
    meter = bill.meter
    prop = meter.property
    consumer = prop.consumer
    tariff = meter.tariff_plan
    payment = db.query(Payment).filter(Payment.bill_id == bill.id).first()
    
    # PDF generation buffer
    buffer = io.BytesIO()
    
    # ReportLab initialization
    doc = SimpleDocTemplate(buffer, pagesize=letter, rightMargin=40, leftMargin=40, topMargin=40, bottomMargin=40)
    story = []
    
    styles = getSampleStyleSheet()
    
    # Custom styles
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=20,
        textColor=colors.HexColor('#0F172A'), # Slate 900
        spaceAfter=15
    )
    
    h2_style = ParagraphStyle(
        'SubSection',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=12,
        textColor=colors.HexColor('#334155'), # Slate 700
        spaceBefore=10,
        spaceAfter=8
    )
    
    normal_style = ParagraphStyle(
        'BodyTextCustom',
        parent=styles['Normal'],
        fontSize=9,
        leading=13,
        textColor=colors.HexColor('#475569') # Slate 600
    )
    
    # Header title
    story.append(Paragraph("SMART CURRENT BILL PREDICTOR", title_style))
    story.append(Paragraph(f"Electricity Consumption Statement — {bill.bill_date.strftime('%B %Y')}", normal_style))
    story.append(Spacer(1, 15))
    
    # Layout info tables
    meta_data = [
        [Paragraph("<b>Consumer Name:</b>", normal_style), Paragraph(consumer.full_name, normal_style),
         Paragraph("<b>Bill Reference ID:</b>", normal_style), Paragraph(f"BIL-{bill.id:05d}", normal_style)],
        [Paragraph("<b>Consumer Phone:</b>", normal_style), Paragraph(consumer.phone or "N/A", normal_style),
         Paragraph("<b>Statement Month:</b>", normal_style), Paragraph(bill.bill_date.strftime('%B %Y'), normal_style)],
        [Paragraph("<b>Property Name:</b>", normal_style), Paragraph(prop.name, normal_style),
         Paragraph("<b>Due Date:</b>", normal_style), Paragraph(bill.due_date.strftime('%Y-%m-%d'), normal_style)],
        [Paragraph("<b>Service Address:</b>", normal_style), Paragraph(prop.address, normal_style),
         Paragraph("<b>Payment Status:</b>", normal_style), Paragraph(f"<b>{bill.payment_status.upper()}</b>", normal_style)]
    ]
    
    t1 = Table(meta_data, colWidths=[100, 160, 110, 150])
    t1.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('LINEBELOW', (0,-1), (-1,-1), 0.5, colors.HexColor('#E2E8F0')),
    ]))
    story.append(t1)
    story.append(Spacer(1, 20))
    
    # Technical specs table
    story.append(Paragraph("METER & TARIFF PLAN DETAILS", h2_style))
    tech_data = [
        [Paragraph("<b>Meter Number</b>", normal_style), Paragraph("<b>Connection Type</b>", normal_style),
         Paragraph("<b>Tariff Plan</b>", normal_style), Paragraph("<b>Fixed Base Rate</b>", normal_style)],
        [Paragraph(meter.meter_number, normal_style), Paragraph(meter.connection_type.capitalize(), normal_style),
         Paragraph(tariff.name if tariff else "Standard", normal_style), Paragraph(f"${tariff.fixed_charge:.2f}" if tariff else "$0.00", normal_style)]
    ]
    t2 = Table(tech_data, colWidths=[130, 130, 130, 130])
    t2.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#F8FAFC')),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#CBD5E1')),
    ]))
    story.append(t2)
    story.append(Spacer(1, 20))
    
    # Cost Breakdown
    story.append(Paragraph("CHARGES BREAKDOWN", h2_style))
    
    # Calculations
    rate = tariff.rate_per_unit if tariff else 0.12
    fixed_charge = tariff.fixed_charge if tariff else 15.00
    fuel_adj = tariff.fuel_adjustment_charge if tariff else 0.02
    
    # Slab rates calculation for display
    slabs = json.loads(tariff.slabs_json) if tariff else [{"min": 0, "max": 999999, "rate": 0.12}]
    slab_charge = bill.bill_amount - fixed_charge - (bill.units_consumed * fuel_adj)
    
    breakdown_data = [
        [Paragraph("<b>Description</b>", normal_style), Paragraph("<b>Rate / Calculation</b>", normal_style), Paragraph("<b>Amount ($)</b>", normal_style)],
        [Paragraph("Base Connection Fixed Charge", normal_style), Paragraph(f"Flat monthly base fee", normal_style), Paragraph(f"${fixed_charge:.2f}", normal_style)],
        [Paragraph(f"Energy Usage Slabs Charge", normal_style), Paragraph(f"{bill.units_consumed:.1f} kWh consumed", normal_style), Paragraph(f"${slab_charge:.2f}", normal_style)],
        [Paragraph("Fuel Adjustment Surcharges", normal_style), Paragraph(f"${fuel_adj:.3f} per kWh consumed", normal_style), Paragraph(f"${(bill.units_consumed * fuel_adj):.2f}", normal_style)],
        [Paragraph("<b>Total Current Month Bill</b>", normal_style), Paragraph("<b>Gross Billing Amount</b>", normal_style), Paragraph(f"<b>${bill.bill_amount:.2f}</b>", normal_style)]
    ]
    
    t3 = Table(breakdown_data, colWidths=[240, 160, 120])
    t3.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#F8FAFC')),
        ('ALIGN', (0,0), (1,-1), 'LEFT'),
        ('ALIGN', (2,0), (2,-1), 'RIGHT'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('LINEBELOW', (0,0), (-1,0), 1, colors.HexColor('#475569')),
        ('LINEBELOW', (0,1), (-1,-2), 0.5, colors.HexColor('#E2E8F0')),
        ('BACKGROUND', (0,-1), (-1,-1), colors.HexColor('#F1F5F9')),
        ('LINEABOVE', (0,-1), (-1,-1), 1, colors.HexColor('#475569')),
    ]))
    story.append(t3)
    story.append(Spacer(1, 20))
    
    # Transaction Receipt info if paid
    if payment:
        story.append(Paragraph("PAYMENT RECEIPT", h2_style))
        payment_data = [
            [Paragraph("<b>Paid Amount</b>", normal_style), Paragraph("<b>Payment Date</b>", normal_style),
             Paragraph("<b>Transaction ID</b>", normal_style), Paragraph("<b>Method</b>", normal_style)],
            [Paragraph(f"${payment.amount_paid:.2f}", normal_style), Paragraph(payment.payment_date.strftime('%Y-%m-%d'), normal_style),
             Paragraph(payment.transaction_reference, normal_style), Paragraph(payment.payment_method, normal_style)]
        ]
        t4 = Table(payment_data, colWidths=[130, 130, 160, 100])
        t4.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#E6F4EA')), # Soft Green
            ('ALIGN', (0,0), (-1,-1), 'LEFT'),
            ('BOTTOMPADDING', (0,0), (-1,-1), 6),
            ('TOPPADDING', (0,0), (-1,-1), 6),
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#A3E635')),
        ]))
        story.append(t4)
    else:
        story.append(Paragraph("<b>Notice:</b> This bill is currently outstanding. Please pay by the due date to avoid service disruptions or overdue fines.", normal_style))
        
    doc.build(story)
    buffer.seek(0)
    
    # Return as StreamingResponse
    headers = {
        'Content-Disposition': f'attachment; filename="smart_bill_{bill.bill_date.strftime("%Y_%m")}.pdf"'
    }
    return StreamingResponse(buffer, media_type="application/pdf", headers=headers)
