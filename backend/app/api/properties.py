# backend/app/api/properties.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
import random

from app.core.db import get_db, Property, Consumer, ElectricityMeter, TariffPlan, User
from app.api.auth import get_current_user

router = APIRouter(prefix="/properties", tags=["properties"])

class PropertyCreate(BaseModel):
    name: str # e.g. 'Home'
    address: str
    property_type: str # 'Residential', 'Commercial', 'Industrial', 'Agricultural'

class MeterRegister(BaseModel):
    meter_number: str
    connection_type: str # 'single-phase', 'three-phase'
    tariff_plan_name: str # Name of default plan to search

@router.get("")
def list_properties(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not current_user.consumer:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No consumer profile associated with user")
        
    properties = db.query(Property).filter(Property.consumer_id == current_user.consumer.id).all()
    result = []
    
    for p in properties:
        meters_list = []
        for m in p.meters:
            tariff = m.tariff_plan
            # Find latest bill
            latest_bill = None
            if m.bills:
                # Sort in memory or database
                latest_bill = sorted(m.bills, key=lambda b: b.bill_date, reverse=True)[0]
                
            meters_list.append({
                "id": m.id,
                "meter_number": m.meter_number,
                "status": m.status,
                "connection_type": m.connection_type,
                "tariff_name": tariff.name if tariff else "None",
                "latest_bill_amount": latest_bill.bill_amount if latest_bill else 0.0,
                "latest_bill_status": latest_bill.payment_status if latest_bill else "N/A"
            })
            
        result.append({
            "id": p.id,
            "name": p.name,
            "property_type": p.property_type,
            "address": p.address,
            "meters": meters_list
        })
        
    return result

@router.post("")
def create_property(prop_data: PropertyCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not current_user.consumer:
        raise HTTPException(status_code=400, detail="Consumer profile required to add properties")
        
    property = Property(
        consumer_id=current_user.consumer.id,
        name=prop_data.name,
        address=prop_data.address,
        property_type=prop_data.property_type
    )
    db.add(property)
    db.commit()
    db.refresh(property)
    return property

@router.post("/{property_id}/meters")
def register_meter(property_id: int, req: MeterRegister, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # Verify property belongs to user
    property = db.query(Property).filter(Property.id == property_id).first()
    if not property:
        raise HTTPException(status_code=404, detail="Property not found")
        
    if current_user.role != "admin" and property.consumer_id != current_user.consumer.id:
        raise HTTPException(status_code=403, detail="Unauthorized")
        
    # Check if meter already registered
    existing = db.query(ElectricityMeter).filter(ElectricityMeter.meter_number == req.meter_number).first()
    if existing:
        raise HTTPException(status_code=400, detail="Meter number already registered in system")
        
    # Search for tariff plan
    tariff = db.query(TariffPlan).filter(TariffPlan.name == req.tariff_plan_name).first()
    if not tariff:
        # Fallback to first plan
        tariff = db.query(TariffPlan).first()
        
    # Create verification hash for QR code
    qr_hash = f"VERIFY-{req.meter_number}-{random.randint(1000, 9999)}"
    
    meter = ElectricityMeter(
        property_id=property.id,
        meter_number=req.meter_number,
        qr_code_hash=qr_hash,
        status="active",
        connection_type=req.connection_type,
        tariff_plan_id=tariff.id if tariff else None
    )
    db.add(meter)
    db.commit()
    db.refresh(meter)
    return {
        "status": "success",
        "message": "Meter registered successfully",
        "meter": {
            "id": meter.id,
            "meter_number": meter.meter_number,
            "qr_code_hash": meter.qr_code_hash,
            "connection_type": meter.connection_type,
            "status": meter.status
        }
    }
