# server/app/services/intelligence.py
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from app.models import Agent, Vendor, AgentSnapshot

def get_kpis(db: Session):
    total = db.scalar(select(func.count()).select_from(Agent)) or 0
    active = db.scalar(select(func.count()).select_from(Agent).where(Agent.status.ilike("%active%"))) or 0
    vendors = db.scalar(select(func.count()).select_from(Vendor)) or 0
    avg_util = db.scalar(select(func.avg(AgentSnapshot.utilization_pct))) or 0
    return {"total_agents": total, "active_agents": active, "vendors": vendors, "avg_utilization": round(float(avg_util or 0), 2), "break_risk_agents": 0, "available_risk_agents": 0}

def generate_recommendations(db: Session):
    return [
        {"severity":"strategic","category":"data-quality","title":"Standardize every vendor file","detail":"Require Agent ID, HP ID, login state, schedule start/end, break windows, supervisor, and call volume by hour from every BPO.","impact_score":96,"confidence":0.92},
        {"severity":"high","category":"utilization","title":"Compare available time against call arrivals by hour","detail":"Use Telus-style interval data to identify agents available too long while other vendors carry higher load.","impact_score":91,"confidence":0.84},
        {"severity":"medium","category":"headcount","title":"Create vendor-by-hour staffing gap score","detail":"Calculate required vs actual headcount by half-hour to show overstaffing, understaffing, and profitable vendor mix.","impact_score":88,"confidence":0.81}
    ]
