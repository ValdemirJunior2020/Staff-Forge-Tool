# StaffForge Architecture

```text
React/Vite Client
  ├─ Landing gate: name/email/company
  ├─ Firebase Analytics + Firestore event/session tracking
  ├─ Command Center dashboard
  ├─ Agent master database
  ├─ Utilization / Forecast / Intelligence / AI modules
  ↓
FastAPI API Gateway
  ├─ Session + audit APIs
  ├─ Workforce APIs
  ├─ AI orchestration endpoint
  ├─ ETL job entrypoints
  ↓
PostgreSQL
  ├─ tenants, vendors, sites, teams
  ├─ agents, vendor_accounts, snapshots
  ├─ utilization_intervals
  ├─ recommendations
  ├─ user_sessions, audit_events
  ↓
Celery + Redis
  ├─ scheduled ETL
  ├─ forecasts
  ├─ anomaly detection
  ↓
Future AI/ML Layer
  ├─ RAG over schema + metadata
  ├─ function-calling SQL tools
  ├─ demand forecasting
  ├─ attrition prediction
```

The design is multi-tenant ready, audit-first, AI-safe, and built to accept new vendor files without changing the UI.
