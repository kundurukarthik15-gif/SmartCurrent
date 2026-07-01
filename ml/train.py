# ml/train.py
import pandas as pd
import numpy as np
import os
import joblib
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import RandomForestRegressor
import xgboost as xgb
import lightgbm as lgb
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

from data_generator import generate_historical_data

def train_and_evaluate(data_path="ml/historical_consumption_data.csv", model_path="ml/model.joblib"):
    # Generate data if not exists
    if not os.path.exists(data_path):
        print("Historical dataset not found. Generating...")
        generate_historical_data(data_path)
        
    # Read the data
    df = pd.read_csv(data_path)
    
    # Feature engineering / columns
    feature_cols = [
        "month", "year", "prev_month_units", "avg_yearly_units",
        "tariff_rate", "fixed_charge", "fuel_adjustment", 
        "seasonal_factor", "temperature_avg", "holidays_count"
    ]
    target_col = "units_consumed"
    
    X = df[feature_cols]
    y = df[target_col]
    
    # Split into train and test sets
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    
    # Scale features
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)
    
    # Models to evaluate
    models = {
        "RandomForest": RandomForestRegressor(n_estimators=100, random_state=42),
        "XGBoost": xgb.XGBRegressor(n_estimators=100, learning_rate=0.05, max_depth=5, random_state=42),
        "LightGBM": lgb.LGBMRegressor(n_estimators=100, learning_rate=0.05, max_depth=5, random_state=42, verbose=-1)
    }
    
    best_model_name = None
    best_mae = float("inf")
    best_model = None
    results = {}
    
    # Train and evaluate each model
    for name, model in models.items():
        print(f"\nTraining {name}...")
        model.fit(X_train_scaled, y_train)
        
        preds = model.predict(X_test_scaled)
        
        mae = mean_absolute_error(y_test, preds)
        rmse = np.sqrt(mean_squared_error(y_test, preds))
        r2 = r2_score(y_test, preds)
        
        results[name] = {"MAE": mae, "RMSE": rmse, "R2": r2}
        print(f"{name} Evaluation: MAE={mae:.4f}, RMSE={rmse:.4f}, R2={r2:.4f}")
        
        if mae < best_mae:
            best_mae = mae
            best_model_name = name
            best_model = model
            
    print(f"\nBest Model: {best_model_name} with MAE: {best_mae:.4f}")
    
    # Calculate feature importances for the best model
    if best_model_name == "RandomForest":
        importances = best_model.feature_importances_
    elif best_model_name == "XGBoost":
        importances = best_model.feature_importances_
    elif best_model_name == "LightGBM":
        importances = best_model.feature_importances_
    else:
        importances = np.zeros(len(feature_cols))
        
    feature_importance_dict = dict(zip(feature_cols, [float(i) for i in importances]))
    
    # Prepare package for saving
    model_package = {
        "model": best_model,
        "model_name": best_model_name,
        "scaler": scaler,
        "feature_names": feature_cols,
        "metrics": results,
        "best_metrics": results[best_model_name],
        "feature_importances": feature_importance_dict
    }
    
    # Save the best model package
    os.makedirs(os.path.dirname(model_path), exist_ok=True)
    joblib.dump(model_package, model_path)
    print(f"Model package saved successfully at {model_path}")
    
    return model_package

if __name__ == "__main__":
    train_and_evaluate()
