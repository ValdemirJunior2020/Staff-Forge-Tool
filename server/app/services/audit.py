# server/app/services/audit.py
from sqlalchemy.orm import Session
from app.models import UserSession, AuditEvent
from app.schemas.workforce import LandingSessionCreate, AuditEventCreate

def create_session(db: Session, payload: LandingSessionCreate):
    row = UserSession(tenant_key=payload.tenant_key, full_name=payload.full_name, email=str(payload.email).lower(), company_department=payload.company_department, user_agent=payload.user_agent)
    db.add(row); db.commit(); db.refresh(row); return row

def log_event(db: Session, payload: AuditEventCreate):
    row = AuditEvent(tenant_key=payload.tenant_key, session_id=payload.session_id, actor_email=str(payload.actor_email).lower() if payload.actor_email else None, event_name=payload.event_name, page=payload.page, metadata_json=payload.metadata)
    db.add(row); db.commit(); db.refresh(row); return row
