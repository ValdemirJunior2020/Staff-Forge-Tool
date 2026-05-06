# server/app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import get_settings
from app.db.session import Base, engine
from app.api.routes import sessions, workforce, ai
settings=get_settings(); Base.metadata.create_all(bind=engine)
app=FastAPI(title='StaffForge',version='0.1.0')
app.add_middleware(CORSMiddleware,allow_origins=settings.cors_origin_list,allow_credentials=True,allow_methods=['*'],allow_headers=['*'])
app.include_router(sessions.router,prefix='/api'); app.include_router(workforce.router,prefix='/api'); app.include_router(ai.router,prefix='/api')
@app.get('/health')
def health(): return {'status':'ok','service':'StaffForge'}
