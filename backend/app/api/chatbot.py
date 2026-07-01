# backend/app/api/chatbot.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
import re

from app.core.db import get_db, ElectricityMeter, HistoricalBill, TariffPlan
from app.api.auth import get_current_user, User
from app.api.prediction import predict_current_month, PredictRequest

router = APIRouter(prefix="/chatbot", tags=["chatbot"])

class ChatRequest(BaseModel):
    question: str
    meter_id: int

@router.post("/ask")
def ask_chatbot(req: ChatRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    meter = db.query(ElectricityMeter).filter(ElectricityMeter.id == req.meter_id).first()
    if not meter:
        raise HTTPException(status_code=404, detail="Meter not found")
        
    prop = meter.property
    tariff = meter.tariff_plan
    
    # Query billing history
    bills = db.query(HistoricalBill)\
        .filter(HistoricalBill.meter_id == meter.id)\
        .order_by(HistoricalBill.bill_date.desc())\
        .limit(12).all()
        
    question_lower = req.question.lower()
    
    # Pre-calculate data if available
    latest_bill = bills[0] if len(bills) > 0 else None
    avg_units = sum([b.units_consumed for b in bills]) / len(bills) if len(bills) > 0 else 0
    avg_bill = sum([b.bill_amount for b in bills]) / len(bills) if len(bills) > 0 else 0
    
    response = ""
    
    # Keywords matching logic for context-aware responses:
    
    # 1. Why is my bill high?
    if "why" in question_lower and ("high" in question_lower or "increase" in question_lower or "spike" in question_lower):
        if latest_bill:
            diff_pct = 0
            if avg_units > 0:
                diff_pct = ((latest_bill.units_consumed - avg_units) / avg_units) * 100
                
            if diff_pct > 5:
                response = (
                    f"### Billing Analysis for **{prop.name}**\n\n"
                    f"Your latest bill dated **{latest_bill.bill_date.strftime('%B %Y')}** is **${latest_bill.bill_amount:.2f}** for **{latest_bill.units_consumed:.1f} kWh**.\n\n"
                    f"This is **{diff_pct:.1f}% higher** than your trailing 12-month average usage of **{avg_units:.1f} kWh** ($ {avg_bill:.2f}).\n\n"
                    f"**Potential Causes:**\n"
                    f"1. **Seasonal Weather Change:** In hot/cold months, space cooling and heating systems draw the highest current. Your meter's seasonal coefficient indicates heating/cooling spikes.\n"
                    f"2. **Phantom Loads:** Standby devices left plugged in can contribute up to 10% of overall consumption.\n"
                    f"3. **Appliance Degradation:** Aging HVAC units or faulty water heater elements consume 25-40% more current.\n\n"
                    f"💡 *Tip: Check your daily AC settings or schedule an energy audit to search for leaks.*"
                )
            else:
                response = (
                    f"### Usage Check for **{prop.name}**\n\n"
                    f"Your latest bill (**${latest_bill.bill_amount:.2f}**) is actually **in-line** with your average of **${avg_bill:.2f}**.\n\n"
                    f"There is no noticeable usage anomaly in your recent history. Let me know if you would like energy saving recommendations to lower it even further!"
                )
        else:
            response = "I couldn't find any historical bills on record to compare. Please complete a meter QR scan or seed records to enable analysis."
            
    # 2. How to reduce bill / Save energy
    elif "reduce" in question_lower or "save" in question_lower or "lower" in question_lower or "tips" in question_lower:
        response = (
            f"### Personalized Conservation Tips for **{prop.name}** ({prop.property_type})\n\n"
            f"Based on your billing profile, here are high-impact conservation actions:\n\n"
            f"1. **Thermostat Regulation (AC/Heating):** Maintain AC at **24°C (75°F)**. Each degree lower increases compressor power draw by 6%.\n"
            f"2. **Mitigate Phantom Loads:** Use smart power strips to completely cut off power to entertainment centers, computers, and chargers when not in use.\n"
            f"3. **LED Lighting Transition:** Replace remaining incandescent bulbs with LEDs. LEDs consume **75-80% less energy** and last 25x longer.\n"
            f"4. **Peak Demand Management:** Avoid running heavy appliances (washers, dryers, dishwashers) during peak pricing windows (typically 2 PM - 7 PM).\n"
            f"5. **Appliance Maintenance:** Clean AC filters monthly. Dusty filters reduce airflow, forcing fans to work harder and run longer."
        )
        
    # 3. Predict next month's bill
    elif "predict" in question_lower or "forecast" in question_lower or "future" in question_lower:
        try:
            pred = predict_current_month(PredictRequest(meter_id=meter.id), db, current_user)
            response = (
                f"### AI Forecasting Assistant\n\n"
                f"I ran our machine learning model for **{prop.name}** and projected the billing outcome:\n\n"
                f"- **Target Month:** {pred['prediction_month']}\n"
                f"- **Predicted Units:** **{pred['predicted_units']:.1f} kWh**\n"
                f"- **Estimated Bill Amount:** **${pred['predicted_bill']:.2f}**\n"
                f"- **Prediction Confidence:** **{pred['confidence_score']*100:.1f}%**\n"
                f"- **Usage Alert Status:** **{pred['anomaly']['status'].upper()}**\n\n"
                f"The algorithm selected **{pred['model_used']}** as the best predictor based on your historical features."
            )
        except Exception as e:
            response = f"I encountered an error trying to simulate predictions: {e}"
            
    # 4. Compare months / trends
    elif "compare" in question_lower or "trend" in question_lower or "history" in question_lower:
        if len(bills) > 1:
            table_rows = []
            for b in bills[:5]:
                table_rows.append(f"| {b.bill_date.strftime('%b %Y')} | {b.units_consumed:.1f} kWh | ${b.bill_amount:.2f} | {b.payment_status.capitalize()} |")
                
            response = (
                f"### Consumption Comparison Table\n\n"
                f"Here is your billing trend over the last 5 statements:\n\n"
                f"| Statement Month | Units Consumed | Total Bill | Status |\n"
                f"| :--- | :--- | :--- | :--- |\n"
                + "\n".join(table_rows) + "\n\n"
                f"Your highest consumption month was **{max(bills, key=lambda x: x.units_consumed).bill_date.strftime('%B %Y')}**."
            )
        else:
            response = "You only have one bill on record, so there is not enough historical data for trend comparisons."
            
    # 5. Tariff details
    elif "tariff" in question_lower or "calculate" in question_lower or "rate" in question_lower:
        if tariff:
            try:
                slabs = json.loads(tariff.slabs_json)
                slab_txt = ""
                for s in slabs:
                    slab_txt += f"- **Units {s['min']} to {s['max']}:** ${s['rate']:.3f} per kWh\n"
            except:
                slab_txt = f"- **Base Rate:** ${tariff.rate_per_unit:.3f} per kWh\n"
                
            response = (
                f"### Tariff Profile: **{tariff.name}**\n\n"
                f"Your billing is governed by the following schedule:\n\n"
                f"- **Connection Type:** {meter.connection_type.capitalize()}\n"
                f"- **Base Fixed Charge:** ${tariff.fixed_charge:.2f} / month\n"
                f"- **Fuel Adjustment Fee:** ${tariff.fuel_adjustment_charge:.3f} / kWh\n\n"
                f"**Energy Consumption Slabs:**\n"
                f"{slab_txt}\n"
                f"Total bill = Fixed Charge + Slab Charges + (Units * Fuel Adjustment)"
            )
        else:
            response = "Your meter doesn't have an active tariff plan assigned. Please contact the administrator."
            
    # Default message
    else:
        name_str = current_user.consumer.full_name if current_user.consumer else "Customer"
        response = (
            f"Hello {name_str}! I am your AI Energy Assistant. ⚡\n\n"
            f"I have loaded details for your property **{prop.name}** (Meter: `{meter.meter_number}`). "
            f"Here are questions I can help you with:\n"
            f"- *Why is my bill high?*\n"
            f"- *How can I reduce my bill?*\n"
            f"- *Predict my next month's bill.*\n"
            f"- *Compare my usage history.*\n"
            f"- *What is my active tariff plan?*"
        )
        
    return {
        "question": req.question,
        "answer": response
    }
