# database/seed_data.py
import sys
import os
from datetime import datetime, date, timedelta
import json
import random

# Add backend directory to sys.path
sys.path.append(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backend"))

from app.core.db import init_db, SessionLocal, User, Consumer, Property, ElectricityMeter, TariffPlan, HistoricalBill, Payment
from app.core.security import get_password_hash
from app.core.config import settings

def seed():
    print("Initializing Database...")
    init_db()
    
    db = SessionLocal()
    try:
        # 1. Seed Admin User
        admin = db.query(User).filter(User.email == settings.ADMIN_EMAIL).first()
        if not admin:
            print("Creating Admin User...")
            admin = User(
                email=settings.ADMIN_EMAIL,
                password_hash=get_password_hash(settings.ADMIN_PASSWORD),
                role="admin"
            )
            db.add(admin)
            db.commit()
            db.refresh(admin)
            
        # 2. Seed Tariff Plans
        tariffs_count = db.query(TariffPlan).count()
        if tariffs_count == 0:
            print("Seeding Tariff Plans...")
            # Slabs format: [{"min": 0, "max": 100, "rate": 0.12}, ...]
            plans = [
                TariffPlan(
                    name="Residential Standard",
                    fixed_charge=15.0,
                    rate_per_unit=0.12,
                    fuel_adjustment_charge=0.02,
                    slabs_json=json.dumps([
                        {"min": 0, "max": 100, "rate": 0.12},
                        {"min": 101, "max": 300, "rate": 0.144},
                        {"min": 301, "max": 999999, "rate": 0.18}
                    ])
                ),
                TariffPlan(
                    name="Commercial Standard",
                    fixed_charge=45.0,
                    rate_per_unit=0.18,
                    fuel_adjustment_charge=0.03,
                    slabs_json=json.dumps([
                        {"min": 0, "max": 500, "rate": 0.18},
                        {"min": 501, "max": 2000, "rate": 0.216},
                        {"min": 2001, "max": 999999, "rate": 0.27}
                    ])
                ),
                TariffPlan(
                    name="Industrial Premium",
                    fixed_charge=150.0,
                    rate_per_unit=0.22,
                    fuel_adjustment_charge=0.04,
                    slabs_json=json.dumps([
                        {"min": 0, "max": 1000, "rate": 0.22},
                        {"min": 1001, "max": 5000, "rate": 0.264},
                        {"min": 5001, "max": 999999, "rate": 0.33}
                    ])
                ),
                TariffPlan(
                    name="Agricultural Standard",
                    fixed_charge=10.0,
                    rate_per_unit=0.06,
                    fuel_adjustment_charge=0.01,
                    slabs_json=json.dumps([
                        {"min": 0, "max": 999999, "rate": 0.06}
                    ])
                )
            ]
            db.add_all(plans)
            db.commit()
            
        # 3. Create consumer user: customer@smartbill.com
        user_email = "customer@smartbill.com"
        customer_user = db.query(User).filter(User.email == user_email).first()
        if not customer_user:
            print("Creating Customer User...")
            customer_user = User(
                email=user_email,
                password_hash=get_password_hash("CustomerPass123!"),
                role="consumer"
            )
            db.add(customer_user)
            db.commit()
            db.refresh(customer_user)

        # Always ensure consumer profile exists for the demo user
        consumer = db.query(Consumer).filter(Consumer.user_id == customer_user.id).first()
        if not consumer:
            print("Creating Consumer profile...")
            consumer = Consumer(
                user_id=customer_user.id,
                full_name="Karthik Kunduru",
                phone="+1 (555) 019-2834",
                tax_id="TX-892749-E"
            )
            db.add(consumer)
            db.commit()
            db.refresh(consumer)

        # Always ensure demo properties + meters exist (idempotent)
        if True:  # Always run this block
            print("Seeding/verifying properties and historical data...")
            properties_data = [
                {
                    "name": "Home Apartment", 
                    "type": "Residential", 
                    "tariff": "Residential Standard", 
                    "base": 220, 
                    "seasonal_amp": 90, 
                    "variance": 15,
                    "meter_num": "MTR-893018",
                    "qr_hash": "VERIFY-MTR-HOME"
                },
                {
                    "name": "Retail Shop", 
                    "type": "Commercial", 
                    "tariff": "Commercial Standard", 
                    "base": 850, 
                    "seasonal_amp": 280, 
                    "variance": 50,
                    "meter_num": "MTR-284920",
                    "qr_hash": "VERIFY-MTR-SHOP"
                }
            ]
            
            monthly_temp = [12, 15, 20, 25, 30, 34, 33, 31, 27, 22, 17, 13]
            
            for p_idx, p_info in enumerate(properties_data):
                # Idempotent: skip if meter already exists
                existing_meter = db.query(ElectricityMeter).filter(
                    ElectricityMeter.qr_code_hash == p_info["qr_hash"]
                ).first()
                if existing_meter:
                    print(f"  Meter {p_info['meter_num']} already exists, skipping.")
                    continue

                # Create property linked to consumer
                prop = Property(
                    consumer_id=consumer.id,
                    name=p_info["name"],
                    address=f"Flat {100 * (p_idx + 1) + 4}, Main Street, City Tech Hub",
                    property_type=p_info["type"]
                )
                db.add(prop)
                db.commit()
                db.refresh(prop)
                
                # Assign meter
                tariff = db.query(TariffPlan).filter(TariffPlan.name == p_info["tariff"]).first()
                meter_num = p_info["meter_num"]
                qr_hash = p_info["qr_hash"]
                
                meter = ElectricityMeter(
                    property_id=prop.id,
                    meter_number=meter_num,
                    qr_code_hash=qr_hash,
                    status="active",
                    connection_type="single-phase",
                    tariff_plan_id=tariff.id,
                    installed_at=datetime.utcnow() - timedelta(days=5*365)
                )
                db.add(meter)
                db.commit()
                db.refresh(meter)
                
                # Seed historical bills (5 years: Jan 2021 to May 2026)
                # Let's generate data
                start_year = 2021
                current_year = 2026
                
                for year in range(start_year, current_year + 1):
                    for month in range(1, 13):
                        # Stop at May 2026
                        if year == 2026 and month > 5:
                            continue
                            
                        # Compute units
                        temp = monthly_temp[month-1]
                        seasonal_factor = 1.0 + (temp - 20) / 30.0 * 1.2
                        yoy_trend = 1.0 + (year - 2021) * 0.02
                        noise = random.gauss(0, p_info["variance"])
                        units = (p_info["base"] * yoy_trend * seasonal_factor) + noise
                        units = max(50.0, units)
                        
                        # Calculate bill amount dynamically using plan slabs
                        slabs = json.loads(tariff.slabs_json)
                        energy_charge = 0.0
                        units_left = units
                        
                        # Apply slabs
                        for slab in slabs:
                            # Slab is list of objects e.g., [{"min": 0, "max": 100, "rate": 0.12}, ...]
                            s_min = slab["min"]
                            s_max = slab["max"]
                            s_rate = slab["rate"]
                            
                            if units > s_min:
                                slab_width = s_max - s_min if s_max != 999999 else units - s_min
                                units_in_slab = min(units - s_min, slab_width)
                                if units_in_slab > 0:
                                    energy_charge += units_in_slab * s_rate
                                    
                        total_bill = tariff.fixed_charge + energy_charge + (units * tariff.fuel_adjustment_charge)
                        
                        # Due date: 15th of next month
                        bill_dt = date(year, month, 1)
                        if month == 12:
                            due_dt = date(year + 1, 1, 15)
                        else:
                            due_dt = date(year, month + 1, 15)
                            
                        # Set payment status: past bills paid, recent bills could be unpaid
                        payment_status = "paid"
                        # Make May 2026 unpaid
                        if year == 2026 and month == 5:
                            payment_status = "unpaid"
                            
                        bill = HistoricalBill(
                            meter_id=meter.id,
                            bill_date=bill_dt,
                            units_consumed=round(units, 2),
                            bill_amount=round(total_bill, 2),
                            payment_status=payment_status,
                            due_date=due_dt
                        )
                        db.add(bill)
                        db.commit()
                        db.refresh(bill)
                        
                        # Add payment record for paid bills
                        if payment_status == "paid":
                            payment = Payment(
                                bill_id=bill.id,
                                amount_paid=bill.bill_amount,
                                payment_date=bill.bill_date + timedelta(days=10),
                                transaction_reference=f"TXN-{random.randint(100000000, 999999999)}",
                                payment_method=random.choice(['UPI', 'Credit Card', 'Net Banking'])
                            )
                            db.add(payment)
                            db.commit()

            print("Successfully seeded all data!")

    except Exception as e:
        print(f"Error during seeding: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed()
