# backend/app/core/config.py
import os
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), ".env"),
        extra="ignore"
    )
    
    PROJECT_NAME: str = "Smart Current Bill Predictor"
    API_V1_STR: str = "/api"
    SECRET_KEY: str = os.getenv("SECRET_KEY", "SUPER_SECRET_SECURITY_KEY_FOR_JWT_AUTHENTICATION_129847192847")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 120
    
    # Database Configuration: Fallback to SQLite out-of-the-box
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./smart_bill.db")
    
    # Supabase Configuration
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "https://vvfqioddzstswyemrypy.supabase.co")
    SUPABASE_ANON_KEY: str = os.getenv("SUPABASE_ANON_KEY", "sb_publishable_k925XOIwi8hV8ics3d6CJw_JuZ0Q-AM")
    
    # Default Admin Configuration
    ADMIN_EMAIL: str = os.getenv("ADMIN_EMAIL", "admin@smartbill.com")
    ADMIN_PASSWORD: str = os.getenv("ADMIN_PASSWORD", "AdminPass123!")
    
    # ML model path
    MODEL_PATH: str = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "ml", "model.joblib")
    
    # QR verification secret key
    QR_SECRET: str = os.getenv("QR_SECRET", "QR_DECRYPTION_SECRET_KEY_982374982374")

settings = Settings()
