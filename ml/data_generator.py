# ml/data_generator.py
import pandas as pd
import numpy as np
import os

def generate_historical_data(output_path="ml/historical_consumption_data.csv"):
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    # Random seed for reproducibility
    np.random.seed(42)
    
    # Meter types and properties
    meters = [
        {"id": 1, "type": "Residential", "base": 220, "seasonal_amp": 90, "variance": 20},
        {"id": 2, "type": "Commercial", "base": 850, "seasonal_amp": 300, "variance": 60},
        {"id": 3, "type": "Industrial", "base": 4200, "seasonal_amp": 800, "variance": 250},
        {"id": 4, "type": "Agricultural", "base": 310, "seasonal_amp": 180, "variance": 40},
        {"id": 5, "type": "Residential-Secondary", "base": 180, "seasonal_amp": 70, "variance": 15}
    ]
    
    records = []
    
    # Monthly average temperatures (Proxy for seasonal climate)
    # January to December
    monthly_temp = [12, 15, 20, 25, 30, 34, 33, 31, 27, 22, 17, 13]
    # Holidays count per month
    monthly_holidays = [3, 1, 2, 2, 1, 0, 1, 2, 1, 3, 2, 3]
    
    for meter in meters:
        meter_id = meter["id"]
        prop_type = meter["type"]
        base_units = meter["base"]
        seasonal_amp = meter["seasonal_amp"]
        var = meter["variance"]
        
        # Generate for 5 years (Jan 2021 to Dec 2025) + first half of 2026
        years = [2021, 2022, 2023, 2024, 2025, 2026]
        
        # Running sum to compute lag
        running_history = []
        
        for year in years:
            for month in range(1, 13):
                # Skip future months in 2026 (current date is June 30, 2026)
                if year == 2026 and month > 6:
                    continue
                    
                # Seasonal factor based on temperature (higher temp = more AC, higher heating in winter etc.)
                # In this model, high temperatures in summer (June-August) spike AC usage
                temp = monthly_temp[month-1]
                holidays = monthly_holidays[month-1]
                
                # Seasonal multiplier (higher in summer, moderate in winter, low in spring/autumn)
                # peak in July (temp 33-34)
                seasonal_factor = 1.0 + (temp - 20) / 30.0 * (1.2 if prop_type != "Agricultural" else 0.8)
                
                # Agricultural peak is in dry seasons (e.g. spring/summer for water pumping)
                if prop_type == "Agricultural" and month in [3, 4, 5, 9, 10]:
                    seasonal_factor += 0.4
                
                # Base units with slight upward year-over-year trend (2% growth per year)
                yoy_trend = 1.0 + (year - 2021) * 0.02
                
                # Generate units consumed with noise
                noise = np.random.normal(0, var)
                units = (base_units * yoy_trend * seasonal_factor) + noise
                units = max(50.0, units) # Lower bound constraint
                
                records.append({
                    "meter_id": meter_id,
                    "property_type": prop_type,
                    "year": year,
                    "month": month,
                    "temperature_avg": temp,
                    "holidays_count": holidays,
                    "seasonal_factor": round(seasonal_factor, 2),
                    "units_consumed": round(units, 2)
                })
                
    df = pd.DataFrame(records)
    
    # Calculate feature variables: prev_month_units (Lag 1) and avg_yearly_units (Rolling 12-month)
    df["prev_month_units"] = df.groupby("meter_id")["units_consumed"].shift(1)
    
    # Fill the first month's lag with a reasonable approximation
    df["prev_month_units"] = df.groupby("meter_id")["prev_month_units"].transform(lambda x: x.fillna(x.mean()))
    
    # Calculate running yearly average units
    df["avg_yearly_units"] = df.groupby("meter_id")["units_consumed"].transform(
        lambda x: x.rolling(12, min_periods=1).mean()
    )
    
    # Tariff settings (Residential, Commercial, Industrial, Agricultural)
    # Define tariff structures
    tariffs = {
        "Residential": {"fixed": 15.00, "rate": 0.12, "fuel": 0.02},
        "Commercial": {"fixed": 45.00, "rate": 0.18, "fuel": 0.03},
        "Industrial": {"fixed": 150.00, "rate": 0.22, "fuel": 0.04},
        "Agricultural": {"fixed": 10.00, "rate": 0.06, "fuel": 0.01}
    }
    
    # Populate tariff attributes and compute bills
    fixed_charges = []
    rates = []
    fuel_adjustments = []
    bill_amounts = []
    
    for idx, row in df.iterrows():
        ptype = row["property_type"]
        units = row["units_consumed"]
        
        tariff = tariffs.get(ptype, tariffs["Residential"])
        fixed = tariff["fixed"]
        rate = tariff["rate"]
        fuel = tariff["fuel"]
        
        # Calculate bill amount with a simple slab system:
        # First 100 units at base rate, next 200 at 1.2 * base rate, remaining at 1.5 * base rate
        if units <= 100:
            energy_charge = units * rate
        elif units <= 300:
            energy_charge = (100 * rate) + ((units - 100) * rate * 1.2)
        else:
            energy_charge = (100 * rate) + (200 * rate * 1.2) + ((units - 300) * rate * 1.5)
            
        fuel_charge = units * fuel
        total_bill = fixed + energy_charge + fuel_charge
        
        fixed_charges.append(fixed)
        rates.append(rate)
        fuel_adjustments.append(fuel)
        bill_amounts.append(round(total_bill, 2))
        
    df["fixed_charge"] = fixed_charges
    df["tariff_rate"] = rates
    df["fuel_adjustment"] = fuel_adjustments
    df["bill_amount"] = bill_amounts
    
    # Save to CSV
    df.to_csv(output_path, index=False)
    print(f"Generated historical dataset with {len(df)} rows at {output_path}")

if __name__ == "__main__":
    generate_historical_data()
