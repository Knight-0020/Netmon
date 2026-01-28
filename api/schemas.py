from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class DeviceBase(BaseModel):
    mac: String
    ip_address: Optional[String] = None
    hostname: Optional[String] = None
    vendor: Optional[String] = None
    tags: List[String] = []

class DeviceCreate(DeviceBase):
    pass

class DeviceUpdate(BaseModel):
    name: Optional[String] = None
    tags: Optional[List[String]] = None
    notes: Optional[String] = None

class DeviceOut(DeviceBase):
    name: Optional[String] = None
    first_seen: datetime
    last_seen: Optional[datetime]
    is_online: bool
    notes: Optional[String] = None

    class Config:
        orm_mode = True

class EventCreate(BaseModel):
    type: String
    message: String
    device_mac: Optional[String] = None
    timestamp: Optional[datetime] = None

class EventOut(EventCreate):
    id: int
    timestamp: datetime

    class Config:
        orm_mode = True

class HealthCheckCreate(BaseModel):
    target: String
    latency_ms: Optional[float]
    status: String
    check_type: String

class IncidentOut(BaseModel):
    id: int
    start_time: datetime
    end_time: Optional[datetime]
    type: String
    description: String

    class Config:
        orm_mode = True
