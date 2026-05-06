# server/app/etl/importer.py
import argparse, hashlib
from pathlib import Path
from datetime import datetime, timedelta
import pandas as pd
from app.db.session import SessionLocal, Base, engine
from app.models import Tenant, Vendor, Agent, VendorAccount, UtilizationInterval
from app.etl.vendor_mappings import AGENT_MAPPINGS

def clean(v):
    if pd.isna(v): return None
    s=str(v).strip()
    return s[:-2] if s.endswith('.0') and s.replace('.','',1).isdigit() else (s or None)
def hash_text(s): return hashlib.sha256(str(s).encode()).hexdigest()
def boolish(v):
    s=(clean(v) or '').lower()
    return True if s in {'yes','y','true','1'} else False if s in {'no','n','false','0'} else None
def excel_date(v):
    s=clean(v)
    if not s: return None
    try:
        if s.replace('.','',1).isdigit(): return (datetime(1899,12,30)+timedelta(days=float(s))).date()
        dt=pd.to_datetime(s, errors='coerce')
        return None if pd.isna(dt) else dt.date()
    except Exception: return None
def header_row(df, markers):
    for i in range(min(15,len(df))):
        vals=[str(x).strip() for x in df.iloc[i].tolist()]
        if sum(1 for m in markers if m in vals) >= 2: return i
    return None
def pick(row, names):
    for n in names:
        if n in row: return clean(row[n])
    return None
def tenant(db,key):
    t=db.query(Tenant).filter_by(key=key).one_or_none()
    if not t: t=Tenant(key=key,name=key.title()); db.add(t); db.commit(); db.refresh(t)
    return t
def vendor(db,t,code,name):
    v=db.query(Vendor).filter_by(tenant_id=t.id,code=code).one_or_none()
    if not v: v=Vendor(tenant_id=t.id,code=code,name=name); db.add(v); db.commit(); db.refresh(v)
    return v
def import_agents(db,path,tenant_key,dry=False):
    t=tenant(db,tenant_key); xls=pd.ExcelFile(path); result={'file':path.name,'imported':0,'sheets':[]}
    for m in AGENT_MAPPINGS:
        for sheet in m['sheets']:
            if sheet not in xls.sheet_names: continue
            raw=pd.read_excel(path,sheet_name=sheet,header=None,dtype=str)
            hr=header_row(raw,m['headers'])
            if hr is None: continue
            df=pd.read_excel(path,sheet_name=sheet,header=hr,dtype=str); df.columns=[str(c).strip() for c in df.columns]
            v=vendor(db,t,m['vendor_code'],m['vendor_name']); count=0
            for _,r in df.iterrows():
                row={str(k).strip():val for k,val in r.to_dict().items()}; mp=m['map']
                first,last=pick(row,mp.get('first_name',[])),pick(row,mp.get('last_name',[]))
                full=pick(row,mp.get('full_name',[])) or ' '.join(x for x in [first,last] if x).strip()
                email=pick(row,mp.get('email',[])); emp=pick(row,mp.get('employee_id',[]))
                if not any([full,email,emp]): continue
                pwd=pick(row,mp.get('password',[]))
                existing=db.query(Agent).filter_by(tenant_id=t.id,vendor_id=v.id,email=email.lower() if email else None).one_or_none() if email else None
                a=existing or Agent(tenant_id=t.id,vendor_id=v.id,full_name=full or email or emp)
                a.employee_id=emp; a.hp_id=pick(row,mp.get('hp_id',[])) or (emp if str(emp or '').lower().startswith('hp') else None); a.first_name=first; a.last_name=last; a.full_name=full or email or emp; a.email=email.lower() if email else None; a.role_title=pick(row,mp.get('role_title',[])); a.lob=pick(row,mp.get('lob',[])); a.supervisor_name=pick(row,mp.get('supervisor_name',[])); a.wave=pick(row,mp.get('wave',[])); a.start_date=excel_date(pick(row,mp.get('start_date',[]))); a.production_start_date=excel_date(pick(row,mp.get('production_start_date',[]))); a.status=(pick(row,mp.get('status',[])) or 'active').lower(); a.billable=boolish(pick(row,mp.get('billable',[]))); a.admin_access=boolish(pick(row,mp.get('admin_access',[]))); a.source_system=f'{path.name}:{sheet}'; a.raw_fingerprint=hash_text(sorted((k,'***' if 'password' in k.lower() else clean(v)) for k,v in row.items()))
                if not dry:
                    db.add(a); db.commit(); db.refresh(a)
                    if pwd and 'no account' not in pwd.lower(): db.add(VendorAccount(tenant_id=t.id,agent_id=a.id,system_name='vendor_login',login_id=a.hp_id or a.employee_id or a.email,password_hash=hash_text(pwd),active=True)); db.commit()
                count+=1; result['imported']+=1
            result['sheets'].append({'sheet':sheet,'vendor':m['vendor_code'],'rows':count})
    return result
def import_telus(db,path,tenant_key,dry=False):
    t=tenant(db,tenant_key); v=vendor(db,t,'TELUS','Telus'); raw=pd.read_excel(path,sheet_name=0,header=None,dtype=str); headers=[clean(x) for x in raw.iloc[1].tolist()]; out=0; cur_date=None; cur_hp=None
    for ridx in range(2,len(raw)):
        row=raw.iloc[ridx].tolist(); cur_date=excel_date(row[0]) or cur_date; cur_hp=clean(row[1]) or cur_hp; state=clean(row[2])
        if not cur_date or not cur_hp or not state: continue
        for c in range(3,len(row)):
            hour=headers[c] if c < len(headers) else None; val=clean(row[c])
            if not hour or not val: continue
            try: duration=float(val)
            except ValueError: continue
            if not dry: db.add(UtilizationInterval(tenant_id=t.id,vendor_id=v.id,summary_date=cur_date,hour_of_day=int(float(hour)),state=state,duration_minutes=duration,source_file=path.name,row_fingerprint=hash_text(f'{path.name}|{cur_date}|{cur_hp}|{state}|{hour}|{duration}')))
            out+=1
    if not dry: db.commit()
    return {'file':path.name,'vendor':'TELUS','utilization_rows':out}
def main():
    p=argparse.ArgumentParser(); p.add_argument('--input',required=True); p.add_argument('--tenant',default='hotelplanner'); p.add_argument('--dry-run',action='store_true'); a=p.parse_args(); Base.metadata.create_all(bind=engine); db=SessionLocal()
    for path in Path(a.input).glob('*.xlsx'):
        print(import_telus(db,path,a.tenant,a.dry_run) if 'telus' in path.name.lower() else import_agents(db,path,a.tenant,a.dry_run))
if __name__=='__main__': main()
