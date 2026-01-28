from pydantic import BaseModel, ConfigDict, Field
from typing import Optional, List
from datetime import datetime


class DeviceBase(BaseModel):
    mac: str
    ip_address: Optional[str] = None
    hostname: Optional[str] = None
    vendor: Optional[str] = None
    tags: List[str] = Field(default_factory=list)


class DeviceCreate(DeviceBase):
    pass


class DeviceUpdate(BaseModel):
    name: Optional[str] = None
    tags: Optional[List[str]] = None
    notes: Optional[str] = None


class DeviceOut(DeviceBase):
    model_config = ConfigDict(from_attributes=True)

    name: Optional[str] = None
    first_seen: datetime
    last_seen: Optional[datetime] = None
    is_online: bool
    notes: Optional[str] = None


class EventCreate(BaseModel):
    type: str
    message: str
    device_mac: Optional[str] = None
    timestamp: Optional[datetime] = None


class EventOut(EventCreate):
    model_config = ConfigDict(from_attributes=True)

    id: int
    timestamp: datetime


class HealthCheckCreate(BaseModel):
    target: str
    latency_ms: Optional[float] = None
    status: str
    check_type: str


class IncidentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    start_time: datetime
    end_time: Optional[datetime] = None
    type: str
    description: str
