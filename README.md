# 🏥 Clinical Healthcare Management System (EHR & Hospital ERP)

A comprehensive, full-stack Hospital & Electronic Health Record (EHR) platform built with **React 19 (TypeScript)** and **Django REST Framework (Python 3.10+)**.

Designed for clinics, hospitals, diagnostic laboratories, and pharmacy operations with granular Role-Based Access Control (RBAC), real-time Server-Sent Events (SSE) notification streaming, and asynchronous Celery task pipelines.

---

## 🏛️ System Architecture

The repository is structured into two primary components:

```
Health care/
├── slash-admin/                  # Frontend (React 19, TypeScript, Ant Design, TailwindCSS, Vite)
├── backend/                      # Backend API (Django 5.1, DRF, Celery, Redis, SQLite/PostgreSQL)
├── start-app.bat                 # One-click launcher for Windows (launches all 4 services)
├── start-backend.sh              # Linux/macOS backend launcher script
├── start-frontend.sh             # Linux/macOS frontend launcher script
├── work_flow                     # Clinical Lab & Real-time Notification workflow reference
├── .gitignore                    # Git configuration (tracks backend & slash-admin only)
└── README.md                     # Project documentation
```

### 💻 Frontend (`slash-admin`)
- **React 19** with **TypeScript**
- **Vite** build tooling for near-instant HMR
- **Ant Design (antd 5)** + **TailwindCSS 4** for healthcare UI components
- **Zustand** for lightweight global state management
- **React Router v7** for nested healthcare and admin routing
- **Axios** with JWT interceptors and auto token refresh
- **Server-Sent Events (SSE)** listener for live clinical toasts & notification badges
- **FullCalendar & ApexCharts** for appointment scheduling and clinical analytics

### ⚙️ Backend (`backend`)
- **Django 5.1** & **Django REST Framework (DRF)**
- **SimpleJWT** for stateless token authentication
- **Role-Based Access Control (RBAC)** with granular document-level permission matrix (`DocPerm`)
- **Celery & Celery Beat** for async background jobs, emails, and 24h unfulfilled order reminders
- **Redis Pub/Sub** for streaming clinical notifications to SSE clients (`/api/healthcare/realtime/stream/`)
- **drf-spectacular** for automated OpenAPI / Swagger documentation (`/api/docs/`)
- **SQLite** default (ready for PostgreSQL in production)

---

## 🩺 Healthcare Modules & Features

| Module | Core Features |
|--------|---------------|
| **👤 Clinical Operations** | Patient Master, Medical History, Healthcare Practitioners, OPD Schedules, Appointments, Encounters (SOAP notes, diagnoses, symptoms), Vital Signs (BP, Temp, Pulse, BMI alert thresholds), Drug Prescriptions, and Service Requests |
| **🧪 Diagnostics & Laboratory** | Interactive Lab Dashboard, Specimen Accessioning & Barcode tracking, Lab Test Templates (CBC, Lipid, etc.), Reference Range alerts (Normal/Abnormal), Diagnostic Reports, Multi-tier Doctor Sign-off & Real-time Notifications |
| **🛏️ Inpatient & Nursing** | Inpatient Admissions, Room/Bed Occupancy tracking, Emergency Records, Clinical Nursing Tasks & Checklists, Discharge Summaries |
| **💊 Pharmacy & Formulary** | Drug Formulary & Medication Catalog, Medication Classes, Active Ingredients, Drug-Drug Interactions, Main Pharmacy Warehouses, Stock Intake, Outpatient Dispensing with Receipts, Inpatient Medication Orders & Scheduled Dose Administration |
| **🧘 Therapy & Rehabilitation** | Therapy Plans, Treatment Plan Templates, and Therapy Session logging |
| **🏢 Hospital Administration** | Medical Departments, Healthcare Settings, Insurance Payors & Claims, Dosage Forms, Sample Types, Clinical Reference Data, and Patient Billing Records |
| **🔐 Security & System Governance** | User Accounts, Roles & Granular DocPerms, Permission Matrix & Inspector, Workflow Designer, Server Scripts, Document Shares, Scheduled Jobs, Error Logs, Notification Channels & Delivery Auditing |

---

## 🚀 Quick Start Guide

### Prerequisites
- **Python**: 3.10 or higher
- **Node.js**: 18.x or 20.x (`npm` or `pnpm`)
- **Redis Server**: Required for Celery queues and real-time SSE alerts
  ```bash
  redis-server
  ```

---

### Option A: One-Click Launcher (Windows)

Double-click or run:
```bat
start-app.bat
```
This automatically opens four dedicated console windows:
1. **Django REST Backend** (`http://localhost:8000`)
2. **Celery Worker** (asynchronous event dispatch)
3. **Celery Beat** (periodic order and schedule checks)
4. **Vite Frontend** (`http://localhost:5173`)

---

### Option B: Manual Setup

#### 1. Backend Setup (`backend/`)

```bash
cd backend

# Create virtual environment
python -m venv .venv

# Activate virtual environment
# Windows:
call .venv\Scripts\activate.bat
# Linux/macOS:
source .venv/bin/activate

# Upgrade pip & install dependencies
python -m pip install --upgrade pip
pip install -r requirements.txt

# Run migrations
python manage.py migrate

# Seed foundational data and roles
python manage.py seed_data
python manage.py seed_roles

# Start the Django server
python manage.py runserver 0.0.0.0:8000
```

> **Automated Setup Script (Windows):**  
> You can also run `.\setup.bat` inside the `backend` folder to automate virtual environment creation, dependency installation, and database seeding.

#### 2. Celery Worker & Beat (Required for Async & Real-Time Alerts)

In separate terminal windows:
```powershell
# In terminal 2 (Celery Worker):
cd backend
.\start-celery-worker.bat

# In terminal 3 (Celery Beat Scheduler):
cd backend
.\start-celery-beat.bat
```
*(On Linux/macOS: `celery -A erp worker --loglevel=info` and `celery -A erp beat --loglevel=info`)*

#### 3. Frontend Setup (`slash-admin/`)

```bash
cd slash-admin

# Install dependencies
npm install
# or: pnpm install

# Start Vite development server
npm run dev
```

The application will be accessible at:
- **Web App**: [http://localhost:5173](http://localhost:5173)
- **Default Landing Page**: `/healthcare`
- **Backend API**: [http://localhost:8000](http://localhost:8000)
- **API Swagger Docs**: [http://localhost:8000/api/docs/](http://localhost:8000/api/docs/)

---

## 🔑 Default Credentials

| Username | Password | Role | Description |
|----------|----------|------|-------------|
| `admin`  | `admin123` | Administrator | Full administrative & clinical access across all modules |

---

## 🌐 API Overview

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/login/` | `POST` | Authenticate and obtain JWT access & refresh tokens |
| `/api/auth/profile/` | `GET` | Retrieve logged-in user profile and permissions |
| `/api/healthcare/patients/` | `GET`, `POST` | Patient registry and demographic records |
| `/api/healthcare/practitioners/` | `GET`, `POST` | Practitioners and clinical specialties |
| `/api/healthcare/encounters/` | `GET`, `POST` | Patient clinical encounters and SOAP notes |
| `/api/healthcare/appointments/` | `GET`, `POST` | OPD appointments and calendar scheduling |
| `/api/healthcare/lab-tests/` | `GET`, `POST` | Laboratory test results and specimen analysis |
| `/api/healthcare/lab-dashboard/` | `GET` | Laboratory queue metrics and fulfillment status |
| `/api/healthcare/realtime/stream/` | `GET` (SSE) | Real-time Server-Sent Events stream for clinical alerts |
| `/api/healthcare/pharmacy/` | `GET`, `POST` | Medication catalog, prescriptions, and dispensing receipts |
| `/api/roles/matrix/` | `GET` | Granular Role and DocPerm permission matrix |
| `/api/roles/users/` | `GET`, `POST` | User administration and role assignments |

---

## 📦 GitHub & Version Control Configuration

This repository is configured with a tailored `.gitignore` specifically designed for GitHub:

- **Included in Git**:
  - `slash-admin/` (React application source code)
  - `backend/` (Django application source code, apps, migrations, settings)
  - Launcher scripts (`start-app.bat`, `start-backend.sh`, `start-frontend.sh`, `work_flow`)
  - Documentation (`README.md`, `.gitignore`)
- **Ignored from Git**:
  - `slash-admin/node_modules/` (installed npm packages)
  - `slash-admin/dist/` (production build output)
  - `backend/.venv/` (Python virtual environment)
  - `backend/db.sqlite3*` (local database files)
  - `backend/celerybeat-schedule*` (Celery local runtime DB)
  - All temporary, experimental, or third-party folders outside `slash-admin` and `backend`

---

## 📄 License

This project is licensed for internal clinical operations and electronic health record management.
