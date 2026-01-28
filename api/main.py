from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
from datetime import datetime, timezone

from database import engine, Base, get_db
import models, schemas

app = FastAPI(title="NetMon API")


def now_utc():
    return datetime.now(timezone.utc)

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
    result = await db.execute(select(models.Device).where(models.Device.mac == device_in.mac))
    device = result.scalars().first()

    if device:
        device.last_seen = now_utc()
        device.ip_address = device_in.ip_address
        device.is_online = True
        if device_in.hostname and not device.hostname:
            device.hostname = device_in.hostname
        if device_in.vendor and not device.vendor:
            device.vendor = device_in.vendor
        if device_in.tags is not None:
            device.tags = device_in.tags
    else:
        device = models.Device(
            mac=device_in.mac,
            ip_address=device_in.ip_address,
            hostname=device_in.hostname,
            vendor=device_in.vendor,
            tags=device_in.tags or [],
            is_online=True,
            last_seen=now_utc(),
        )
        db.add(device)

    await db.commit()
    return {"status": "ok"}


@app.post("/ingest/event")
async def ingest_event(event_in: schemas.EventCreate, db: AsyncSession = Depends(get_db)):
    # Ensure device exists if device_mac is provided (prevents FK violation)
    if event_in.device_mac:
        res = await db.execute(select(models.Device).where(models.Device.mac == event_in.device_mac))
        dev = res.scalars().first()
        if not dev:
            dev = models.Device(
                mac=event_in.device_mac,
                ip_address=None,
                hostname=None,
                vendor=None,
                tags=[],
                is_online=False,
                last_seen=now_utc(),
            )
            db.add(dev)
            await db.flush()  # ensure device inserted before event insert

    event = models.Event(
        type=event_in.type,
        message=event_in.message,
        device_mac=event_in.device_mac,
        timestamp=event_in.timestamp or now_utc(),
    )
    db.add(event)

    if event_in.type == "OFFLINE" and event_in.device_mac:
        res = await db.execute(select(models.Device).where(models.Device.mac == event_in.device_mac))
        dev = res.scalars().first()
        if dev:
            dev.is_online = False

    if event_in.type == "ONLINE" and event_in.device_mac:
        res = await db.execute(select(models.Device).where(models.Device.mac == event_in.device_mac))
        dev = res.scalars().first()
        if dev:
            dev.is_online = True
            dev.last_seen = now_utc()

    await db.commit()
    return {"status": "ok"}


@app.post("/ingest/health")
async def ingest_health(health_in: schemas.HealthCheckCreate, db: AsyncSession = Depends(get_db)):
    h = models.InternetHealth(
        target=health_in.target,
        latency_ms=health_in.latency_ms,
        status=health_in.status,
        check_type=health_in.check_type,
    )
    db.add(h)
    await db.commit()
    return {"status": "ok"}


@app.post("/ingest/incident")
async def ingest_incident(incident_data: schemas.IncidentCreate, db: AsyncSession = Depends(get_db)):
    if incident_data.status == "OPEN":
        res = await db.execute(
            select(models.Incident)
            .where(models.Incident.type == incident_data.type)
            .where(models.Incident.end_time == None)
        )
        existing = res.scalars().first()
        if not existing:
            inc = models.Incident(
                type=incident_data.type,
                description=incident_data.description or ""
            )
            db.add(inc)

    elif incident_data.status == "RESOLVED":
        res = await db.execute(
            select(models.Incident)
            .where(models.Incident.type == incident_data.type)
            .where(models.Incident.end_time == None)
        )
        existing = res.scalars().first()
        if existing:
            existing.end_time = now_utc()

    await db.commit()
    return {"status": "ok"}

# --- Read ---

@app.get("/devices", response_model=List[schemas.DeviceOut])
async def get_devices(online_only: Optional[bool] = None, db: AsyncSession = Depends(get_db)):
    query = select(models.Device)
    if online_only is not None:
        query = query.where(models.Device.is_online == online_only)
    query = query.order_by(models.Device.is_online.desc(), models.Device.last_seen.desc())
    result = await db.execute(query)
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
async def get_events(
    limit: int = 50,
    device_mac: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    query = select(models.Event)
    if device_mac is not None:
        device_mac = device_mac.strip()
    if device_mac:
        query = query.where(models.Event.device_mac == device_mac)
    query = query.order_by(models.Event.timestamp.desc()).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@app.get("/internet/status", response_model=schemas.InternetStatusOut)
async def get_internet_status(db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(models.InternetHealth).order_by(models.InternetHealth.timestamp.desc()).limit(10))
    checks = res.scalars().all()

    res_inc = await db.execute(select(models.Incident).order_by(models.Incident.start_time.desc()).limit(5))
    incidents = res_inc.scalars().all()

    return {"recent_checks": checks, "incidents": incidents}
