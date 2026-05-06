# server/app/api/routes/ai.py
from pydantic import BaseModel
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.services.ai import ask_staffforge_ai
router=APIRouter(prefix='/ai',tags=['ai'])
class AIQuestion(BaseModel): question: str; session_id: str|None=None
@router.post('/ask')
def ask(payload:AIQuestion, db:Session=Depends(get_db)): return ask_staffforge_ai(db,payload.question)
