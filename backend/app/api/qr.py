# backend/app/api/qr.py
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel
import qrcode
import io
import base64

from app.core.db import get_db, ElectricityMeter, Property, Consumer, TariffPlan
from app.api.auth import get_current_user, User

router = APIRouter(prefix="/qr", tags=["qr"])

class QRVerifyRequest(BaseModel):
    qr_code_hash: str

class QRGenerateRequest(BaseModel):
    meter_number: str
    property_id: int

@router.get("/my-meters")
def get_my_meters_with_qr(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Return all meters for the logged-in consumer, each with a scannable QR code image."""
    if not current_user.consumer:
        return []
    
    result = []
    for prop in current_user.consumer.properties:
        for meter in prop.meters:
            # Generate QR image for this meter's hash
            qr = qrcode.QRCode(
                version=1,
                error_correction=qrcode.constants.ERROR_CORRECT_M,
                box_size=10,
                border=4,
            )
            qr.add_data(meter.qr_code_hash)
            qr.make(fit=True)
            img = qr.make_image(fill_color="black", back_color="white")
            buffer = io.BytesIO()
            img.save(buffer, format="PNG")
            img_b64 = base64.b64encode(buffer.getvalue()).decode()
            
            result.append({
                "meter_id": meter.id,
                "meter_number": meter.meter_number,
                "qr_code_hash": meter.qr_code_hash,
                "status": meter.status,
                "connection_type": meter.connection_type,
                "property_name": prop.name,
                "property_type": prop.property_type,
                "qr_image": f"data:image/png;base64,{img_b64}"
            })
    
    return result

@router.get("/sample-codes")
def get_sample_qr_codes(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Return pre-generated QR code images for the two demo meters. Auto-creates them if missing."""
    import json
    from datetime import datetime as dt
    
    demo_meters_spec = [
        {
            "qr_hash": "VERIFY-MTR-HOME",
            "meter_number": "MTR-893018",
            "property_name": "Home Apartment",
            "property_type": "Residential",
            "tariff_name": "Residential Standard",
            "connection_type": "single-phase",
        },
        {
            "qr_hash": "VERIFY-MTR-SHOP",
            "meter_number": "MTR-284920",
            "property_name": "Retail Shop",
            "property_type": "Commercial",
            "tariff_name": "Commercial Standard",
            "connection_type": "three-phase",
        },
    ]
    
    # Find the demo consumer (customer@smartbill.com) to link properties to
    from app.core.db import User as UserModel
    demo_user = db.query(UserModel).filter(UserModel.email == "customer@smartbill.com").first()
    demo_consumer = demo_user.consumer if demo_user and hasattr(demo_user, 'consumer') else None
    
    # Fallback: link to the current user's consumer if demo user not available
    if not demo_consumer and current_user.consumer:
        demo_consumer = current_user.consumer
    
    result = []
    
    for spec in demo_meters_spec:
        meter = db.query(ElectricityMeter).filter(
            ElectricityMeter.qr_code_hash == spec["qr_hash"]
        ).first()
        
        # Auto-create meter if missing
        if not meter and demo_consumer:
            try:
                tariff = db.query(TariffPlan).filter(TariffPlan.name == spec["tariff_name"]).first()
                if not tariff:
                    tariff = db.query(TariffPlan).first()
                
                # Create property for this meter
                prop = Property(
                    consumer_id=demo_consumer.id,
                    name=spec["property_name"],
                    address=f"Demo Address, City Tech Hub",
                    property_type=spec["property_type"]
                )
                db.add(prop)
                db.commit()
                db.refresh(prop)
                
                meter = ElectricityMeter(
                    property_id=prop.id,
                    meter_number=spec["meter_number"],
                    qr_code_hash=spec["qr_hash"],
                    status="active",
                    connection_type=spec["connection_type"],
                    tariff_plan_id=tariff.id if tariff else None,
                )
                db.add(meter)
                db.commit()
                db.refresh(meter)
                print(f"Auto-created demo meter: {spec['meter_number']}")
            except Exception as e:
                print(f"Failed to auto-create meter {spec['meter_number']}: {e}")
                db.rollback()
                continue
        
        if not meter:
            continue
        
        prop = db.query(Property).filter(Property.id == meter.property_id).first()
        tariff = db.query(TariffPlan).filter(TariffPlan.id == meter.tariff_plan_id).first()
        
        # Generate QR image
        qr_img = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_M,
            box_size=14,
            border=6,
        )
        qr_img.add_data(spec["qr_hash"])
        qr_img.make(fit=True)
        img = qr_img.make_image(fill_color="black", back_color="white")
        buffer = io.BytesIO()
        img.save(buffer, format="PNG")
        img_b64 = base64.b64encode(buffer.getvalue()).decode()
        
        result.append({
            "hash": spec["qr_hash"],
            "meter_number": meter.meter_number,
            "property_name": prop.name if prop else spec["property_name"],
            "property_type": prop.property_type if prop else spec["property_type"],
            "connection_type": meter.connection_type,
            "status": meter.status,
            "tariff": tariff.name if tariff else "Standard",
            "qr_image": f"data:image/png;base64,{img_b64}"
        })
    
    return result


@router.post("/verify")
def verify_qr(req: QRVerifyRequest, request: Request, db: Session = Depends(get_db)):
    # Look up the meter by qr code hash
    meter = db.query(ElectricityMeter).filter(ElectricityMeter.qr_code_hash == req.qr_code_hash).first()
    if not meter:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invalid QR Code: Authentic meter record not found."
        )
        
    # Get associated property and consumer profile
    property = db.query(Property).filter(Property.id == meter.property_id).first()
    if not property:
        raise HTTPException(status_code=404, detail="Meter property not found")
        
    # If request contains Authorization header, verify token and dynamically link property to current consumer
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
        try:
            from app.api.auth import get_current_user
            current_user = get_current_user(token, db)
            if current_user and current_user.consumer:
                property.consumer_id = current_user.consumer.id
                db.commit()
                db.refresh(property)
        except Exception as e:
            print(f"Optional token validation failed in QR verify: {e}")
            
    consumer = db.query(Consumer).filter(Consumer.id == property.consumer_id).first()
    tariff = db.query(TariffPlan).filter(TariffPlan.id == meter.tariff_plan_id).first()
    
    # Return structured meter details
    return {
        "status": "verified",
        "meter_id": meter.id,
        "meter_number": meter.meter_number,
        "connection_type": meter.connection_type,
        "status_state": meter.status,
        "property": {
            "id": property.id,
            "name": property.name,
            "property_type": property.property_type,
            "address": property.address
        },
        "consumer": {
            "id": consumer.id if consumer else 0,
            "full_name": consumer.full_name if consumer else "Unknown",
            "phone": consumer.phone if consumer else "N/A"
        },
        "tariff_plan": {
            "name": tariff.name if tariff else "Standard",
            "fixed_charge": tariff.fixed_charge if tariff else 0.0,
            "rate_per_unit": tariff.rate_per_unit if tariff else 0.12,

            "fuel_adjustment_charge": tariff.fuel_adjustment_charge if tariff else 0.0
        }
    }

@router.post("/generate")
def generate_qr(req: QRGenerateRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin permissions required")
        
    # Verify property exists
    property = db.query(Property).filter(Property.id == req.property_id).first()
    if not property:
        raise HTTPException(status_code=404, detail="Property target not found")
        
    # Create verification hash
    qr_hash = f"VERIFY-{req.meter_number}-{base64.b64encode(req.meter_number.encode()).decode()[:6].upper()}"
    
    # Generate QR Image
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=10,
        border=4,
    )
    qr.add_data(qr_hash)
    qr.make(fit=True)
    
    img = qr.make_image(fill_color="black", back_color="white")
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    img_str = base64.b64encode(buffer.getvalue()).decode()
    
    # Check if meter already exists, if so update, else create new
    existing_meter = db.query(ElectricityMeter).filter(ElectricityMeter.meter_number == req.meter_number).first()
    
    if existing_meter:
        existing_meter.qr_code_hash = qr_hash
        existing_meter.property_id = req.property_id
        db.commit()
        db.refresh(existing_meter)
    else:
        # Map property type to default tariff plan
        plan_name_map = {
            "Residential": "Residential Standard",
            "Commercial": "Commercial Standard",
            "Industrial": "Industrial Premium",
            "Agricultural": "Agricultural Standard"
        }
        target_plan_name = plan_name_map.get(property.property_type, "Residential Standard")
        tariff = db.query(TariffPlan).filter(TariffPlan.name == target_plan_name).first()
        if not tariff:
            tariff = db.query(TariffPlan).first()
            
        new_meter = ElectricityMeter(
            property_id=req.property_id,
            meter_number=req.meter_number,
            qr_code_hash=qr_hash,
            status="active",
            connection_type="three-phase" if property.property_type in ["Commercial", "Industrial"] else "single-phase",
            tariff_plan_id=tariff.id if tariff else None
        )
        db.add(new_meter)
        db.commit()
        
    return {
        "status": "success",
        "qr_code_hash": qr_hash,
        "qr_image_base64": f"data:image/png;base64,{img_str}",
        "meter_number": req.meter_number,
        "property_id": req.property_id,
        "already_exists": existing_meter is not None
    }
