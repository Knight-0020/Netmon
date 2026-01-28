from sqlalchemy import Column, String, Boolean, DateTime, CheckConstraint, Integer, Float, ForeignKey, JSON
from sqlalchemy.sql import func
from .database import Base

class Device(Base):
    __tablename__ = "devices"
    mac = Column(String, primary_key=True, index=True)
    ip_address = Column(String, nullable=True)
    hostname = Column(String, nullable=True)
    name = Column(String, nullable=True)
    vendor = Column(String, nullable=True)
    first_seen = Column(DateTime(timezone=True), server_default=func.now())
    last_seen = Column(DateTime(timezone=True), onupdate=func.now())
    is_online = Column(Boolean, default=True)
    tags = Column(JSON, default=[])
    notes = Column(String, nullable=True)
    # device_history relation could go here

class Event(Base):
    __tablename__ = "events"
    id = Column(Integer, primary_key=True, index=True)
    type = Column(String, index=True) # NEW_DEVICE, ONLINE, OFFLINE, IP_CHANGED
    message = Column(String)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    device_mac = Column(String, ForeignKey("devices.mac"), nullable=True)

class InternetHealth(Base):
    __tablename__ = "internet_health"
    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    target = Column(String)
    latency_ms = Column(Float, nullable=True) # Null if down
    status = Column(String) # UP, DOWN
    check_type = Column(String) # PING, DNS, HTTP

class Incident(Base):
    __tablename__ = "incidents"
    id = Column(Integer, primary_key=True, index=True)
    start_time = Column(DateTime(timezone=True), server_default=func.now())
    end_time = Column(DateTime(timezone=True), nullable=True)
    type = Column(String)
    description = Column(String)
