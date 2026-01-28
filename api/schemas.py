from pydantic import BaseModel, ConfigDict, Field, field_validator
from typing import Optional, List
from datetime import datetime
from typing import Literal


class DeviceBase(BaseModel):
    mac: str
    ip_address: Optional[str] = None
    hostname: Optional[str] = None
    vendor: Optional[str] = None
    tags: List[str] = Field(default_factory=list)

    @field_validator("mac")
    @classmethod
    def mac_not_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("mac must not be empty")
        return v.strip()


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

    @field_validator("type")
    @classmethod
    def type_not_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("type must not be empty")
        return v.strip()

    @field_validator("device_mac")
    @classmethod
    def device_mac_clean(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        v = v.strip()
        return v or None


class EventOut(EventCreate):
    model_config = ConfigDict(from_attributes=True)

    id: int
    timestamp: datetime


class HealthCheckCreate(BaseModel):
    target: str
    latency_ms: Optional[float] = None
    status: str
    check_type: str


class HealthCheckOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    timestamp: datetime
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


class InternetStatusOut(BaseModel):
    recent_checks: List[HealthCheckOut]
    incidents: List[IncidentOut]


class IncidentCreate(BaseModel):
    type: str
    description: Optional[str] = None
    status: Literal["OPEN", "RESOLVED"]

    @field_validator("type")
    @classmethod
    def incident_type_not_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("type must not be empty")
        return v.strip()
