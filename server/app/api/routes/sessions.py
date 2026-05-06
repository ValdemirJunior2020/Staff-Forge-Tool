# server/app/api/routes/sessions.py
from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models import UserSession, AuditEvent
from app.schemas.workforce import LandingSessionCreate, AuditEventCreate
from app.services.audit import create_session, log_event
router=APIRouter(prefix='/sessions',tags=['sessions'])
@router.post('')
def start(payload:LandingSessionCreate, request:Request, db:Session=Depends(get_db)):
    payload.user_agent=payload.user_agent or request.headers.get('user-agent')
    s=create_session(db,payload); return {'id':s.id,'started_at':s.started_at.isoformat()}
@router.post('/events')
def event(payload:AuditEventCreate, db:Session=Depends(get_db)):
    e=log_event(db,payload); return {'id':e.id,'created_at':e.created_at.isoformat()}
@router.get('/admin/recent')
def recent(db:Session=Depends(get_db)):
    return {'sessions':[{'id':s.id,'full_name':s.full_name,'email':s.email,'company_department':s.company_department,'started_at':s.started_at.isoformat()} for s in db.query(UserSession).order_by(UserSession.started_at.desc()).limit(50)], 'events':[{'id':e.id,'event_name':e.event_name,'actor_email':e.actor_email,'page':e.page,'created_at':e.created_at.isoformat()} for e in db.query(AuditEvent).order_by(AuditEvent.created_at.desc()).limit(100)]}
