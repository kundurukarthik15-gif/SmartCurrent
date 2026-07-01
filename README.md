# Smart Current Bill Predictor ⚡

Develop a modern, production-ready, full-stack application named **Smart Current Bill Predictor**. The application allows consumers to scan electricity meter QR codes, verify authenticity, upload photographs of meter registers to parse values using OCR, monitor historical consumption, and predict current and future bills using Machine Learning.

---

## Technical Stack

* **Frontend**: React (Vite.js) + TypeScript + Tailwind CSS + Recharts + Framer Motion
* **Backend**: Python FastAPI (REST API, Pydantic validation, JWT authentication)
* **Machine Learning**: Pandas, NumPy, Scikit-learn, XGBoost, LightGBM, Joblib
* **Database**: PostgreSQL (Production) / SQLite (Zero-config local development fallback)
* **OCR**: PyTesseract meter extraction with simulated heuristic fallback

---

## Directory Structure

```
├── backend/
│   ├── app/
│   │   ├── api/          # Route controllers (auth, prediction, qr, ocr, billing, chatbot)
│   │   ├── core/         # Configs, database sessions, SQLAlchemy model schemas, JWT security
│   │   └── main.py       # FastAPI main entrypoint and startup seeder logic
│   └── requirements.txt  # Python package dependencies
├── database/
│   ├── schema.sql        # PostgreSQL table structures
│   └── seed_data.py      # Database seeding scripts (reconciles 5 years of bill history)
├── frontend/
│   ├── src/
│   │   ├── pages/        # View screens (Dashboard, PropertyManager, QRScanner, OCRMeter, BillHistory, Chatbot, AdminPanel)
│   │   ├── App.tsx       # Auth context, Property context, Theme manager, and Base layouts
│   │   └── main.tsx      # DOM mount point
│   ├── index.html        # Main HTML
│   ├── package.json      # React dependencies
│   └── tailwind.config.js# Custom brand themes & animation classes
├── ml/
│   ├── data_generator.py # Generates synthetic consumption variables
│   ├── train.py          # Trains XGBoost, LightGBM, and RF models, selecting best parameters
│   └── model.joblib      # Serialized ML model
└── docker-compose.yml    # Multistage multi-container orchestration
```

---

## Quickstart Guide

### 1. Setup Backend
1. Navigate to `backend` directory:
   ```bash
   cd backend
   ```
2. Create a virtual environment and activate:
   ```bash
   python -m venv venv
   # On Windows:
   .\venv\Scripts\activate
   # On macOS/Linux:
   source venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Start FastAPI backend server:
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```
   *Note: On startup, the database (`smart_bill.db` locally via SQLite) initializes tables and self-seeds dummy billing data, including properties for testing.*

### 2. Seeding & ML Training Pipeline
1. Run data generator to synthesize 5-year consumption data:
   ```bash
   python ml/data_generator.py
   ```
2. Train multiple ML algorithms (Random Forest, XGBoost, LightGBM), validate metrics, select the best model, and serialize parameters to `ml/model.joblib`:
   ```bash
   python ml/train.py
   ```
3. Refresh the FastAPI backend server to load the trained model instantly.

### 3. Setup Frontend
1. Navigate to `frontend` directory:
   ```bash
   cd frontend
   ```
2. Install npm packages:
   ```bash
   npm install
   ```
3. Start Vite local server:
   ```bash
   npm run dev
   ```
4. Open the application in your browser at `http://localhost:3000`.

---

## Default Login Credentials

Use the following seeded accounts to review dashboard features:

* **Consumer Account**:
  * Email: `customer@smartbill.com`
  * Password: `CustomerPass123!`
* **Administrator Account**:
  * Email: `admin@smartbill.com`
  * Password: `AdminPass123!`

---

## Application Workflows

1. **Unauthenticated Auth**: The app loads a login page. Switch tabs to Register or request forgot password URL. Click "Sign in with Google" to simulate Google OAuth identity token logins.
2. **Dashboard**: View monthly billing units, AI confidence indicators, carbon equivalents, anomaly flags, and Recharts graph details. Select between different registered properties (Home, Shop, etc.) in the sidebar.
3. **QR Meter Authenticator**: Paste a secure QR hash or select demo presets. The scanner queries the provider database, checks digital signatures, and returns meter profiles.
4. **OCR Meter Scanning**: Upload a photo of the register display or click simulated presets. The system applies binarization filters, runs character OCR extraction, and shows manual correction overlays.
5. **AI Chatbot**: Open AI Assistant to chat about billing spikes, tariff rules, and structural conservation tips.
6. **Admin Panel**: Manage customer accounts, adjust fixed and unit rates in active tariff plans, review ML feature weights, and print signed QR labels.
