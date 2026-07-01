# backend/tests/test_api.py
import sys
import os
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Add backend directory to sys.path
sys.path.append(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from app.main import app
from app.core.db import Base, get_db, User, TariffPlan, Consumer, Property, ElectricityMeter
from app.core.security import get_password_hash

# Setup Test Database: SQLite in-memory database
SQLALCHEMY_DATABASE_URL = "sqlite:///./test_temp.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

# Override FastAPI dependency
app.dependency_overrides[get_db] = override_get_db

client = TestClient(app)

@pytest.fixture(autouse=True)
def setup_database():
    # Create tables
    Base.metadata.create_all(bind=engine)
    
    # Seed minimal parameters
    db = TestingSessionLocal()
    try:
        # 1. Add Tariff Plan
        tariff = TariffPlan(
            name="Residential Standard",
            fixed_charge=15.0,
            rate_per_unit=0.12,
            fuel_adjustment_charge=0.02,
            slabs_json='[{"min": 0, "max": 100, "rate": 0.12}, {"min": 101, "max": 999999, "rate": 0.15}]'
        )
        db.add(tariff)
        db.commit()
        
        # 2. Add User & Consumer
        user = User(
            email="test_user@smartbill.com",
            password_hash=get_password_hash("TestPass123!"),
            role="consumer"
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        
        consumer = Consumer(
            user_id=user.id,
            full_name="Test Consumer Profile"
        )
        db.add(consumer)
        db.commit()
        db.refresh(consumer)
        
        # 3. Add Property
        prop = Property(
            consumer_id=consumer.id,
            name="Home Suite",
            address="404 Test Road",
            property_type="Residential"
        )
        db.add(prop)
        db.commit()
        db.refresh(prop)
        
        # 4. Add Meter
        meter = ElectricityMeter(
            property_id=prop.id,
            meter_number="MTR-TEST-99",
            qr_code_hash="VERIFY-MTR-TEST-99",
            status="active",
            connection_type="single-phase",
            tariff_plan_id=tariff.id
        )
        db.add(meter)
        db.commit()
        
    finally:
        db.close()
        
    yield
    
    # Tear down tables
    Base.metadata.drop_all(bind=engine)
    if os.path.exists("./test_temp.db"):
        os.remove("./test_temp.db")

def test_health_check():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"

def test_user_authentication():
    # Register duplicate
    reg_data = {
        "email": "test_user@smartbill.com",
        "password": "NewPassword123!",
        "full_name": "Dupe User"
    }
    response = client.post("/api/auth/register", json=reg_data)
    assert response.status_code == 400 # Email registered already

    # Register new user
    reg_data_new = {
        "email": "new_user@smartbill.com",
        "password": "SecurePassword123!",
        "full_name": "New User Name"
    }
    response = client.post("/api/auth/register", json=reg_data_new)
    assert response.status_code == 200
    assert "access_token" in response.json()

    # Login
    login_data = {
        "username": "test_user@smartbill.com",
        "password": "TestPass123!"
    }
    response = client.post("/api/auth/login", data=login_data)
    assert response.status_code == 200
    assert "access_token" in response.json()

def test_qr_code_verification():
    # Valid QR hash
    response = client.post("/api/qr/verify", json={"qr_code_hash": "VERIFY-MTR-TEST-99"})
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "verified"
    assert data["meter_number"] == "MTR-TEST-99"
    assert data["property"]["name"] == "Home Suite"

    # Invalid QR hash
    response = client.post("/api/qr/verify", json={"qr_code_hash": "VERIFY-MTR-INVALID"})
    assert response.status_code == 404

def test_chatbot_agent():
    # Authenticate first
    login_data = {"username": "test_user@smartbill.com", "password": "TestPass123!"}
    auth_res = client.post("/api/auth/login", data=login_data)
    token = auth_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Ask tariff plan details (meter ID is 1)
    chat_req = {
        "question": "What is my active tariff plan?",
        "meter_id": 1
    }
    response = client.post("/api/chatbot/ask", json=chat_req, headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert "answer" in data
    assert "Tariff Profile" in data["answer"]
