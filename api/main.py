from fastapi import FastAPI, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from typing import List, Optional
from datetime import datetime

from .database import engine, Base, get_db
from . import models, schemas

app = FastAPI(title="NetMon API")

from fastapi.middleware.cors import CORSMiddleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

# --- Ingest ---

@app.post("/ingest/device")
async def ingest_device(device_in: schemas.DeviceCreate, db: AsyncSession = Depends(get_db)):
    # Check if exists
    result = await db.execute(select(models.Device).where(models.Device.mac == device_in.mac))
    device = result.scalars().first()
    
    if device:
        device.last_seen = datetime.now()
        device.ip_address = device_in.ip_address
        device.is_online = True
        if device_in.hostname:
            device.hostname = device_in.hostname
        if device_in.vendor:
            device.vendor = device_in.vendor
    else:
        device = models.Device(
            mac=device_in.mac,
            ip_address=device_in.ip_address,
            hostname=device_in.hostname,
            vendor=device_in.vendor,
            is_online=True,
            last_seen=datetime.now()
        )
        db.add(device)
    
    await db.commit()
    return {"status": "ok"}

@app.post("/ingest/event")
async def ingest_event(event_in: schemas.EventCreate, db: AsyncSession = Depends(get_db)):
    event = models.Event(
        type=event_in.type,
        message=event_in.message,
        device_mac=event_in.device_mac,
        timestamp=event_in.timestamp or datetime.now()
    )
    db.add(event)
    
    # If device event, update online status if needed
    if event_in.type == "OFFLINE" and event_in.device_mac:
        result = await db.execute(select(models.Device).where(models.Device.mac == event_in.device_mac))
        dev = result.scalars().first()
        if dev:
            dev.is_online = False
            
    await db.commit()
    return {"status": "ok"}

@app.post("/ingest/health")
async def ingest_health(health_in: schemas.HealthCheckCreate, db: AsyncSession = Depends(get_db)):
    # Store metric
    h = models.InternetHealth(
        target=health_in.target,
        latency_ms=health_in.latency_ms,
        status=health_in.status,
        check_type=health_in.check_type
    )
    db.add(h)
    await db.commit()
    return {"status": "ok"}

@app.post("/ingest/incident")
async def ingest_incident(incident_data: dict, db: AsyncSession = Depends(get_db)):
    # incident_data: {type: str, description: str, status: "OPEN"|"RESOLVED"}
    # Simplified logic: if OPEN, create new if not exists active. If RESOLVED, close active.
    # For MVP just create log
    if incident_data.get("status") == "OPEN":
         # Check if open incident of this type exists
         res = await db.execute(select(models.Incident).where(models.Incident.type == incident_data["type"]).where(models.Incident.end_time == None))
         existing = res.scalars().first()
         if not existing:
             inc = models.Incident(type=incident_data["type"], description=incident_data["description"])
             db.add(inc)
    elif incident_data.get("status") == "RESOLVED":
         res = await db.execute(select(models.Incident).where(models.Incident.type == incident_data["type"]).where(models.Incident.end_time == None))
         existing = res.scalars().first()
         if existing:
             existing.end_time = datetime.now()
             
    await db.commit()
    return {"status": "ok"}

# --- Read ---

@app.get("/devices", response_model=List[schemas.DeviceOut])
async def get_devices(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.Device).order_by(models.Device.is_online.desc(), models.Device.last_seen.desc()))
    return result.scalars().all()

@app.get("/devices/{mac}", response_model=schemas.DeviceOut)
async def get_device(mac: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.Device).where(models.Device.mac == mac))
    dev = result.scalars().first()
    if not dev:
        raise HTTPException(status_code=404, detail="Device not found")
    return dev

@app.patch("/devices/{mac}")
async def update_device(mac: str, update: schemas.DeviceUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.Device).where(models.Device.mac == mac))
    dev = result.scalars().first()
    if not dev:
        raise HTTPException(status_code=404, detail="Device not found")
        
    if update.name is not None:
        dev.name = update.name
    if update.notes is not None:
        dev.notes = update.notes
    if update.tags is not None:
        dev.tags = update.tags
        
    await db.commit()
    return {"status": "updated"}

@app.get("/events", response_model=List[schemas.EventOut])
async def get_events(limit: int = 50, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.Event).order_by(models.Event.timestamp.desc()).limit(limit))
    return result.scalars().all()

@app.get("/internet/status")
async def get_internet_status(db: AsyncSession = Depends(get_db)):
    # Get latest checks
    # For MVP just get the last 5 checks
    res = await db.execute(select(models.InternetHealth).order_by(models.InternetHealth.timestamp.desc()).limit(10))
    checks = res.scalars().all()
    
    # Incidents
    res_inc = await db.execute(select(models.Incident).order_by(models.Incident.start_time.desc()).limit(5))
    incidents = res_inc.scalars().all()
    
    return {
        "recent_checks": checks,
        "incidents": incidents
    }
