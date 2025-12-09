"""Data storage layer handling SQLite operations and exports."""
from __future__ import annotations

import csv
from contextlib import contextmanager
from pathlib import Path
from typing import Iterable

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from . import config
from .models import Base, Experiment

engine = create_engine(config.DATABASE_URL, echo=False, future=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


def init_db() -> None:
    """Create database tables if they do not exist."""
    Base.metadata.create_all(bind=engine)


@contextmanager
def get_session() -> Iterable[Session]:
    """Provide a transactional scope around a series of operations."""
    session: Session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def export_to_csv(output_path: Path | None = None) -> Path:
    """Export all experiment records to a CSV file."""
    output_path = output_path or (config.EXPORTS_DIR / "experiments_export.csv")
    output_path.parent.mkdir(exist_ok=True)

    with get_session() as session:
        experiments = session.query(Experiment).order_by(Experiment.date_time).all()

    fieldnames = [
        "id",
        "date_time",
        "experiment_id",
        "mode",
        "voltage_V",
        "current_A",
        "electrolyte",
        "duration_min",
        "initial_mass_positive_g",
        "final_mass_positive_g",
        "delta_mass_positive_g",
        "initial_mass_negative_g",
        "final_mass_negative_g",
        "delta_mass_negative_g",
        "notes",
    ]

    with output_path.open("w", newline="", encoding="utf-8") as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        writer.writeheader()
        for exp in experiments:
            writer.writerow({
                "id": exp.id,
                "date_time": exp.date_time.isoformat(),
                "experiment_id": exp.experiment_id,
                "mode": exp.mode,
                "voltage_V": exp.voltage_V,
                "current_A": exp.current_A,
                "electrolyte": exp.electrolyte,
                "duration_min": exp.duration_min,
                "initial_mass_positive_g": exp.initial_mass_positive_g,
                "final_mass_positive_g": exp.final_mass_positive_g,
                "delta_mass_positive_g": exp.delta_mass_positive_g,
                "initial_mass_negative_g": exp.initial_mass_negative_g,
                "final_mass_negative_g": exp.final_mass_negative_g,
                "delta_mass_negative_g": exp.delta_mass_negative_g,
                "notes": exp.notes,
            })

    return output_path
