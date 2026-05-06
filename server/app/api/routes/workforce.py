# server/app/api/routes/workforce.py
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models import Agent, Vendor
from app.services.intelligence import get_kpis, generate_recommendations
router=APIRouter(prefix='/workforce',tags=['workforce'])
@router.get('/kpis')
def kpis(db:Session=Depends(get_db)): return get_kpis(db)
@router.get('/vendors')
def vendors(db:Session=Depends(get_db)): return [{'id':v.id,'code':v.code,'name':v.name,'country':v.country,'active':v.active} for v in db.query(Vendor).order_by(Vendor.name)]
@router.get('/agents')
def agents(vendor:str|None=None,status:str|None=None,search:str|None=None,db:Session=Depends(get_db)):
    q=db.query(Agent,Vendor).join(Vendor,Agent.vendor_id==Vendor.id)
    if vendor and vendor!='all': q=q.filter(Vendor.code==vendor)
    if status and status!='all': q=q.filter(Agent.status==status)
    if search:
        like=f'%{search}%'; q=q.filter((Agent.full_name.ilike(like)) | (Agent.email.ilike(like)) | (Agent.hp_id.ilike(like)))
    return [{'id':a.id,'vendor':v.name,'vendor_code':v.code,'full_name':a.full_name,'email':a.email,'hp_id':a.hp_id,'employee_id':a.employee_id,'role_title':a.role_title,'supervisor_name':a.supervisor_name,'status':a.status,'billable':a.billable} for a,v in q.limit(500).all()]
@router.get('/recommendations')
def recs(db:Session=Depends(get_db)): return generate_recommendations(db)
