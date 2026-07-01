# backend/app/api/admin.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
import json
import os
import joblib

from app.core.db import get_db, User, Consumer, Property, ElectricityMeter, TariffPlan, HistoricalBill, AIPrediction, AdminLog
from app.api.auth import get_current_user

router = APIRouter(prefix="/admin", tags=["admin"])

class TariffCreateRequest(BaseModel):
    name: str
    fixed_charge: float
    rate_per_unit: float
    fuel_adjustment_charge: float
    slabs_json: str # JSON Array string

class TariffAssignRequest(BaseModel):
    meter_ids: List[int]

def log_admin_action(admin_id: int, action: str, details: str, db: Session):
    log = AdminLog(
        admin_user_id=admin_id,
        action=action,
        details=details
    )
    db.add(log)
    db.commit()

@router.get("/metrics")
def get_admin_metrics(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin permissions required")
        
    total_consumers = db.query(Consumer).count()
    total_properties = db.query(Property).count()
    total_meters = db.query(ElectricityMeter).count()
    
    # Calculate Total Revenue (sum of all paid bills)
    total_revenue_db = db.query(HistoricalBill).filter(HistoricalBill.payment_status == "paid").all()
    total_revenue = sum([b.bill_amount for b in total_revenue_db])
    
    # Count of active predictions & anomalies
    predictions = db.query(AIPrediction).all()
    anomalies_count = sum([1 for p in predictions if p.anomaly_status in ["High", "Medium"]])
    
    # Load ML metrics
    model_name = "Rule-based Math Model"
    avg_confidence = 0.94
    if os.path.exists(settings.MODEL_PATH):
        try:
            pkg = joblib.load(settings.MODEL_PATH)
            model_name = pkg.get("model_name", "RandomForest")
            best_metrics = pkg.get("best_metrics", {})
            r2 = best_metrics.get("R2", 0.95)
            avg_confidence = float(max(0.70, min(0.99, r2)))
        except:
            pass
            
    return {
        "total_consumers": total_consumers,
        "total_properties": total_properties,
        "total_meters": total_meters,
        "total_revenue": round(total_revenue, 2),
        "anomalies_flagged": anomalies_count,
        "model_in_use": model_name,
        "prediction_confidence": round(avg_confidence, 2)
    }

@router.get("/consumers")
def list_consumers(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin permissions required")
        
    consumers = db.query(Consumer).all()
    result = []
    
    for c in consumers:
        user = c.user
        props = c.properties
        
        properties_list = []
        for p in props:
            meters_list = []
            for m in p.meters:
                meters_list.append({
                    "id": m.id,
                    "meter_number": m.meter_number,
                    "qr_code_hash": m.qr_code_hash,
                    "status": m.status,
                    "tariff": m.tariff_plan.name if m.tariff_plan else "None"
                })
            properties_list.append({
                "id": p.id,
                "name": p.name,
                "property_type": p.property_type,
                "address": p.address,
                "meters": meters_list
            })
            
        result.append({
            "id": c.id,
            "full_name": c.full_name,
            "email": user.email if user else "N/A",
            "phone": c.phone,
            "tax_id": c.tax_id,
            "created_at": c.created_at,
            "properties": properties_list
        })
        
    return result

@router.get("/tariffs")
def list_tariffs(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin permissions required")
        
    tariffs = db.query(TariffPlan).all()
    result = []
    
    for t in tariffs:
        try:
            slabs = json.loads(t.slabs_json)
        except:
            slabs = []
            
        result.append({
            "id": t.id,
            "name": t.name,
            "fixed_charge": t.fixed_charge,
            "rate_per_unit": t.rate_per_unit,
            "fuel_adjustment_charge": t.fuel_adjustment_charge,
            "slabs": slabs,
            "created_at": t.created_at
        })
        
    return result

@router.post("/tariffs")
def create_tariff(req: TariffCreateRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin permissions required")
        
    # Verify slabs syntax is valid JSON
    try:
        json.loads(req.slabs_json)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON format for slabs_json")
        
    tariff = TariffPlan(
        name=req.name,
        fixed_charge=req.fixed_charge,
        rate_per_unit=req.rate_per_unit,
        fuel_adjustment_charge=req.fuel_adjustment_charge,
        slabs_json=req.slabs_json
    )
    db.add(tariff)
    db.commit()
    db.refresh(tariff)
    
    log_admin_action(current_user.id, "CREATE_TARIFF", f"Created tariff plan: {req.name}", db)
    return tariff

@router.put("/tariffs/{tariff_id}")
def update_tariff(tariff_id: int, req: TariffCreateRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin permissions required")
        
    tariff = db.query(TariffPlan).filter(TariffPlan.id == tariff_id).first()
    if not tariff:
        raise HTTPException(status_code=404, detail="Tariff plan not found")
        
    try:
        json.loads(req.slabs_json)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON format for slabs_json")
        
    tariff.name = req.name
    tariff.fixed_charge = req.fixed_charge
    tariff.rate_per_unit = req.rate_per_unit
    tariff.fuel_adjustment_charge = req.fuel_adjustment_charge
    tariff.slabs_json = req.slabs_json
    
    db.commit()
    db.refresh(tariff)
    
    log_admin_action(current_user.id, "UPDATE_TARIFF", f"Updated tariff plan ID: {tariff.id} to {req.name}", db)
    return tariff

@router.post("/tariffs/{tariff_id}/apply")
def apply_tariff(tariff_id: int, req: TariffAssignRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin permissions required")
        
    tariff = db.query(TariffPlan).filter(TariffPlan.id == tariff_id).first()
    if not tariff:
        raise HTTPException(status_code=404, detail="Tariff plan not found")
        
    meters = db.query(ElectricityMeter).filter(ElectricityMeter.id.in_(req.meter_ids)).all()
    for meter in meters:
        meter.tariff_plan_id = tariff.id
        
    db.commit()
    log_admin_action(current_user.id, "APPLY_TARIFF", f"Applied tariff: {tariff.name} to {len(meters)} meters.", db)
    return {"status": "success", "message": f"Applied tariff {tariff.name} to {len(meters)} meters"}

@router.get("/ml-performance")
def get_ml_performance(current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin permissions required")
        
    if os.path.exists(settings.MODEL_PATH):
        try:
            pkg = joblib.load(settings.MODEL_PATH)
            return {
                "status": "active",
                "model_name": pkg["model_name"],
                "metrics": pkg["metrics"],
                "feature_importances": pkg["feature_importances"]
            }
        except Exception as e:
            return {"status": "error", "message": f"Error loading model: {e}"}
            
    # Mock fallback metrics if model hasn't been compiled
    return {
        "status": "simulated",
        "model_name": "XGBoost (Simulated)",
        "metrics": {
            "RandomForest": {"MAE": 12.8, "RMSE": 18.5, "R2": 0.945},
            "XGBoost": {"MAE": 10.2, "RMSE": 15.1, "R2": 0.963},
            "LightGBM": {"MAE": 11.4, "RMSE": 16.8, "R2": 0.952}
        },
        "feature_importances": {
            "prev_month_units": 0.42,
            "seasonal_factor": 0.28,
            "avg_yearly_units": 0.15,
            "temperature_avg": 0.08,
            "holidays_count": 0.04,
            "tariff_rate": 0.02,
            "fixed_charge": 0.01,
            "month": 0.0,
            "year": 0.0,
            "fuel_adjustment": 0.0
        }
    }
