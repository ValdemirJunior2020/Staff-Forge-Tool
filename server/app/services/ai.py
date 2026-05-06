# server/app/services/ai.py
from sqlalchemy.orm import Session
from app.services.intelligence import get_kpis, generate_recommendations

def ask_staffforge_ai(db: Session, question: str):
    kpis = get_kpis(db)
    recs = generate_recommendations(db)
    return {"answer": f"StaffForge reviewed the workforce layer. Current total agents: {kpis['total_agents']}, active agents: {kpis['active_agents']}, vendors: {kpis['vendors']}. Top action: {recs[0]['title']} — {recs[0]['detail']}", "kpis": kpis, "recommendations": recs, "tools_used": ["get_kpis", "generate_recommendations"]}
