"""Data models for experiments and anomaly results."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Optional

from sqlalchemy import Column, DateTime, Float, Integer, String, Text
from sqlalchemy.orm import declarative_base

Base = declarative_base()


class Experiment(Base):
    """ORM model representing a carbon rod exfoliation experiment."""

    __tablename__ = "experiments"

    id: int = Column(Integer, primary_key=True, autoincrement=True)
    date_time: datetime = Column(DateTime, nullable=False, default=datetime.utcnow)
    experiment_id: str = Column(String(50), unique=True, nullable=False)
    mode: str = Column(String(10), nullable=False)
    voltage_V: Optional[float] = Column(Float)
    current_A: Optional[float] = Column(Float)
    electrolyte: str = Column(String(100), nullable=False)
    duration_min: Optional[float] = Column(Float)
    initial_mass_positive_g: float = Column(Float, nullable=False)
    final_mass_positive_g: float = Column(Float, nullable=False)
    delta_mass_positive_g: float = Column(Float, nullable=False)
    initial_mass_negative_g: float = Column(Float, nullable=False)
    final_mass_negative_g: float = Column(Float, nullable=False)
    delta_mass_negative_g: float = Column(Float, nullable=False)
    notes: str = Column(Text, nullable=True)

    def __repr__(self) -> str:  # pragma: no cover - debug helper
        return (
            f"<Experiment {self.experiment_id} mode={self.mode} "
            f"Δm+={self.delta_mass_positive_g:.4f} Δm-={self.delta_mass_negative_g:.4f}>"
        )


@dataclass
class Anomaly:
    """Container describing detected anomalies for an experiment."""

    experiment_id: str
    anomaly_type: str
    message: str
