# server/app/schemas/workforce.py
from pydantic import BaseModel, EmailStr
class LandingSessionCreate(BaseModel):
    full_name: str
    email: EmailStr
    company_department: str
    tenant_key: str = "hotelplanner"
    user_agent: str | None = None
class AuditEventCreate(BaseModel):
    tenant_key: str = "hotelplanner"
    session_id: str | None = None
    actor_email: EmailStr | None = None
    event_name: str
    page: str | None = None
    metadata: dict = {}
