-- PostgreSQL Schema for Smart Current Bill Predictor

-- Users table (authentication and general roles)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'consumer', -- 'consumer', 'admin'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Consumers table (personal details)
CREATE TABLE IF NOT EXISTS consumers (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    tax_id VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tariff Plans table (billing calculations)
CREATE TABLE IF NOT EXISTS tariff_plans (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    fixed_charge DOUBLE PRECISION DEFAULT 0.0,
    rate_per_unit DOUBLE PRECISION DEFAULT 0.0,
    fuel_adjustment_charge DOUBLE PRECISION DEFAULT 0.0,
    slabs_json TEXT NOT NULL, -- JSON array of tariff slabs e.g., [{"min": 0, "max": 100, "rate": 0.1}, ...]
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Properties table (allows multiple properties per consumer)
CREATE TABLE IF NOT EXISTS properties (
    id SERIAL PRIMARY KEY,
    consumer_id INTEGER REFERENCES consumers(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL, -- e.g., 'Home', 'Shop', 'Farm', etc.
    address TEXT NOT NULL,
    property_type VARCHAR(50) DEFAULT 'Residential', -- 'Residential', 'Commercial', 'Industrial', 'Agricultural'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Electricity Meters table (physical meter linked to a property)
CREATE TABLE IF NOT EXISTS electricity_meters (
    id SERIAL PRIMARY KEY,
    property_id INTEGER REFERENCES properties(id) ON DELETE CASCADE,
    meter_number VARCHAR(100) UNIQUE NOT NULL,
    qr_code_hash VARCHAR(255) UNIQUE NOT NULL,
    status VARCHAR(50) DEFAULT 'active', -- 'active', 'inactive', 'maintenance'
    connection_type VARCHAR(50) DEFAULT 'single-phase', -- 'single-phase', 'three-phase'
    tariff_plan_id INTEGER REFERENCES tariff_plans(id) ON DELETE SET NULL,
    installed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Monthly Readings table (recorded actual reading and source)
CREATE TABLE IF NOT EXISTS monthly_readings (
    id SERIAL PRIMARY KEY,
    meter_id INTEGER REFERENCES electricity_meters(id) ON DELETE CASCADE,
    reading_date DATE NOT NULL,
    cumulative_reading DOUBLE PRECISION NOT NULL,
    units_consumed DOUBLE PRECISION NOT NULL,
    image_url TEXT,
    is_ocr_extracted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Historical Bills table (billing logs)
CREATE TABLE IF NOT EXISTS historical_bills (
    id SERIAL PRIMARY KEY,
    meter_id INTEGER REFERENCES electricity_meters(id) ON DELETE CASCADE,
    bill_date DATE NOT NULL,
    units_consumed DOUBLE PRECISION NOT NULL,
    bill_amount DOUBLE PRECISION NOT NULL,
    payment_status VARCHAR(50) DEFAULT 'unpaid', -- 'paid', 'unpaid', 'overdue'
    due_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- AI Predictions table (monthly forecasts and confidence metrics)
CREATE TABLE IF NOT EXISTS ai_predictions (
    id SERIAL PRIMARY KEY,
    meter_id INTEGER REFERENCES electricity_meters(id) ON DELETE CASCADE,
    prediction_month DATE NOT NULL,
    predicted_units DOUBLE PRECISION NOT NULL,
    predicted_bill DOUBLE PRECISION NOT NULL,
    confidence_score DOUBLE PRECISION NOT NULL,
    anomaly_status VARCHAR(50) DEFAULT 'Low', -- 'Low', 'Medium', 'High'
    insights_json TEXT NOT NULL, -- JSON array of energy-saving tips
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Payments table (transaction records)
CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    bill_id INTEGER REFERENCES historical_bills(id) ON DELETE CASCADE,
    amount_paid DOUBLE PRECISION NOT NULL,
    payment_date DATE NOT NULL,
    transaction_reference VARCHAR(100) UNIQUE NOT NULL,
    payment_method VARCHAR(50) NOT NULL
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) DEFAULT 'info', -- 'alert', 'info', 'payment'
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Admin Logs table
CREATE TABLE IF NOT EXISTS admin_logs (
    id SERIAL PRIMARY KEY,
    admin_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    action VARCHAR(255) NOT NULL,
    details TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_properties_consumer_id ON properties(consumer_id);
CREATE INDEX IF NOT EXISTS idx_meters_property_id ON electricity_meters(property_id);
CREATE INDEX IF NOT EXISTS idx_readings_meter_id ON monthly_readings(meter_id);
CREATE INDEX IF NOT EXISTS idx_bills_meter_id ON historical_bills(meter_id);
CREATE INDEX IF NOT EXISTS idx_predictions_meter_id ON ai_predictions(meter_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
