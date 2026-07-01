# backend/app/core/db.py
from datetime import datetime
from sqlalchemy import create_engine, Column, Integer, String, Float, Boolean, DateTime, Date, ForeignKey, Text
from sqlalchemy.orm import declarative_base, sessionmaker, relationship
from app.core.config import settings

# Engine configuration
# If sqlite is used, need check_same_thread configuration
connect_args = {"check_same_thread": False} if settings.DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(settings.DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# DB Session Dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ORM Model Definitions

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(50), default="consumer") # 'admin', 'consumer'
    created_at = Column(DateTime, default=datetime.utcnow)
    
    consumer = relationship("Consumer", back_populates="user", uselist=False, cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")
    admin_logs = relationship("AdminLog", back_populates="admin_user", cascade="all, delete-orphan")


class Consumer(Base):
    __tablename__ = "consumers"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    full_name = Column(String(255), nullable=False)
    phone = Column(String(50), nullable=True)
    tax_id = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User", back_populates="consumer")
    properties = relationship("Property", back_populates="consumer", cascade="all, delete-orphan")


class TariffPlan(Base):
    __tablename__ = "tariff_plans"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    fixed_charge = Column(Float, default=0.0)
    rate_per_unit = Column(Float, default=0.0)
    fuel_adjustment_charge = Column(Float, default=0.0)
    slabs_json = Column(Text, nullable=False) # JSON list e.g., [{"min": 0, "max": 100, "rate": 0.12}, ...]
    created_at = Column(DateTime, default=datetime.utcnow)
    
    meters = relationship("ElectricityMeter", back_populates="tariff_plan")


class Property(Base):
    __tablename__ = "properties"
    
    id = Column(Integer, primary_key=True, index=True)
    consumer_id = Column(Integer, ForeignKey("consumers.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(100), nullable=False) # 'Home', 'Shop', 'Farm', etc.
    address = Column(Text, nullable=False)
    property_type = Column(String(50), default="Residential") # 'Residential', 'Commercial', 'Industrial', 'Agricultural'
    created_at = Column(DateTime, default=datetime.utcnow)
    
    consumer = relationship("Consumer", back_populates="properties")
    meters = relationship("ElectricityMeter", back_populates="property", cascade="all, delete-orphan")


class ElectricityMeter(Base):
    __tablename__ = "electricity_meters"
    
    id = Column(Integer, primary_key=True, index=True)
    property_id = Column(Integer, ForeignKey("properties.id", ondelete="CASCADE"), nullable=False)
    meter_number = Column(String(100), unique=True, index=True, nullable=False)
    qr_code_hash = Column(String(255), unique=True, index=True, nullable=False)
    status = Column(String(50), default="active") # 'active', 'inactive', 'maintenance'
    connection_type = Column(String(50), default="single-phase") # 'single-phase', 'three-phase'
    tariff_plan_id = Column(Integer, ForeignKey("tariff_plans.id", ondelete="SET NULL"), nullable=True)
    installed_at = Column(DateTime, default=datetime.utcnow)
    
    property = relationship("Property", back_populates="meters")
    tariff_plan = relationship("TariffPlan", back_populates="meters")
    readings = relationship("MonthlyReading", back_populates="meter", cascade="all, delete-orphan")
    bills = relationship("HistoricalBill", back_populates="meter", cascade="all, delete-orphan")
    predictions = relationship("AIPrediction", back_populates="meter", cascade="all, delete-orphan")


class MonthlyReading(Base):
    __tablename__ = "monthly_readings"
    
    id = Column(Integer, primary_key=True, index=True)
    meter_id = Column(Integer, ForeignKey("electricity_meters.id", ondelete="CASCADE"), nullable=False)
    reading_date = Column(Date, nullable=False)
    cumulative_reading = Column(Float, nullable=False)
    units_consumed = Column(Float, nullable=False)
    image_url = Column(Text, nullable=True)
    is_ocr_extracted = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    meter = relationship("ElectricityMeter", back_populates="readings")


class HistoricalBill(Base):
    __tablename__ = "historical_bills"
    
    id = Column(Integer, primary_key=True, index=True)
    meter_id = Column(Integer, ForeignKey("electricity_meters.id", ondelete="CASCADE"), nullable=False)
    bill_date = Column(Date, nullable=False)
    units_consumed = Column(Float, nullable=False)
    bill_amount = Column(Float, nullable=False)
    payment_status = Column(String(50), default="unpaid") # 'paid', 'unpaid', 'overdue'
    due_date = Column(Date, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    meter = relationship("ElectricityMeter", back_populates="bills")
    payments = relationship("Payment", back_populates="bill", cascade="all, delete-orphan")


class AIPrediction(Base):
    __tablename__ = "ai_predictions"
    
    id = Column(Integer, primary_key=True, index=True)
    meter_id = Column(Integer, ForeignKey("electricity_meters.id", ondelete="CASCADE"), nullable=False)
    prediction_month = Column(Date, nullable=False)
    predicted_units = Column(Float, nullable=False)
    predicted_bill = Column(Float, nullable=False)
    confidence_score = Column(Float, nullable=False)
    anomaly_status = Column(String(50), default="Low") # 'Low', 'Medium', 'High'
    insights_json = Column(Text, nullable=False) # JSON list of insights
    created_at = Column(DateTime, default=datetime.utcnow)
    
    meter = relationship("ElectricityMeter", back_populates="predictions")


class Payment(Base):
    __tablename__ = "payments"
    
    id = Column(Integer, primary_key=True, index=True)
    bill_id = Column(Integer, ForeignKey("historical_bills.id", ondelete="CASCADE"), nullable=False)
    amount_paid = Column(Float, nullable=False)
    payment_date = Column(Date, nullable=False)
    transaction_reference = Column(String(100), unique=True, index=True, nullable=False)
    payment_method = Column(String(50), nullable=False) # 'Credit Card', 'Net Banking', 'UPI', 'Wallet'
    
    bill = relationship("HistoricalBill", back_populates="payments")


class Notification(Base):
    __tablename__ = "notifications"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    type = Column(String(50), default="info") # 'alert', 'info', 'payment'
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User", back_populates="notifications")


class AdminLog(Base):
    __tablename__ = "admin_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    admin_user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    action = Column(String(255), nullable=False)
    details = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    admin_user = relationship("User", back_populates="admin_logs")

# Helper to initialize SQLite/PostgreSQL schema
def init_db():
    Base.metadata.create_all(bind=engine)
