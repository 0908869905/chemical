"""High-level interfaces for creating, updating, deleting, and querying experiments."""
from __future__ import annotations

from datetime import datetime
from typing import Iterable, List, Optional

from sqlalchemy import and_, or_

from .models import Experiment
from .storage import get_session


class ValidationError(ValueError):
    """Raised when user input fails validation."""


NUMERIC_FIELDS = {
    "voltage_V",
    "current_A",
    "duration_min",
    "initial_mass_positive_g",
    "final_mass_positive_g",
    "initial_mass_negative_g",
    "final_mass_negative_g",
}


def _parse_float(value: Optional[str | float]) -> Optional[float]:
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError) as exc:
        raise ValidationError(f"Invalid numeric value: {value}") from exc


def _calculate_delta(initial: float, final: float) -> float:
    return final - initial


def add_experiment(**data) -> Experiment:
    """Create a new experiment record with automatic Δm calculation."""
    parsed = {}
    for key, value in data.items():
        if key in NUMERIC_FIELDS:
            parsed[key] = _parse_float(value)
        else:
            parsed[key] = value

    for field in (
        "initial_mass_positive_g",
        "final_mass_positive_g",
        "initial_mass_negative_g",
        "final_mass_negative_g",
    ):
        if parsed.get(field) is None:
            raise ValidationError(f"Missing required numeric field: {field}")

    parsed["delta_mass_positive_g"] = _calculate_delta(
        parsed["initial_mass_positive_g"], parsed["final_mass_positive_g"]
    )
    parsed["delta_mass_negative_g"] = _calculate_delta(
        parsed["initial_mass_negative_g"], parsed["final_mass_negative_g"]
    )

    if isinstance(parsed.get("date_time"), str):
        parsed["date_time"] = datetime.fromisoformat(parsed["date_time"])

    experiment = Experiment(**parsed)
    with get_session() as session:
        session.add(experiment)
    return experiment


def edit_experiment(experiment_id: str, **changes) -> Experiment:
    """Edit an existing experiment and recalculate Δm when masses change."""
    with get_session() as session:
        experiment: Experiment | None = (
            session.query(Experiment).filter_by(experiment_id=experiment_id).one_or_none()
        )
        if not experiment:
            raise ValidationError(f"Experiment {experiment_id} not found")

        for key, value in changes.items():
            if key in NUMERIC_FIELDS:
                value = _parse_float(value)
            if hasattr(experiment, key):
                setattr(experiment, key, value)

        if any(k in changes for k in [
            "initial_mass_positive_g",
            "final_mass_positive_g",
        ]):
            experiment.delta_mass_positive_g = _calculate_delta(
                experiment.initial_mass_positive_g, experiment.final_mass_positive_g
            )
        if any(k in changes for k in [
            "initial_mass_negative_g",
            "final_mass_negative_g",
        ]):
            experiment.delta_mass_negative_g = _calculate_delta(
                experiment.initial_mass_negative_g, experiment.final_mass_negative_g
            )

        session.add(experiment)
        return experiment


def delete_experiment(experiment_id: str) -> None:
    with get_session() as session:
        experiment: Experiment | None = (
            session.query(Experiment).filter_by(experiment_id=experiment_id).one_or_none()
        )
        if not experiment:
            raise ValidationError(f"Experiment {experiment_id} not found")
        session.delete(experiment)


def query_experiments(
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    mode: Optional[str] = None,
    electrolyte: Optional[str] = None,
    search: Optional[str] = None,
) -> List[Experiment]:
    """Query experiments with optional filters."""
    with get_session() as session:
        query = session.query(Experiment)
        if start_date:
            query = query.filter(Experiment.date_time >= start_date)
        if end_date:
            query = query.filter(Experiment.date_time <= end_date)
        if mode:
            query = query.filter_by(mode=mode)
        if electrolyte:
            query = query.filter_by(electrolyte=electrolyte)
        if search:
            query = query.filter(
                or_(
                    Experiment.experiment_id.ilike(f"%{search}%"),
                    Experiment.notes.ilike(f"%{search}%"),
                )
            )
        return query.order_by(Experiment.date_time.desc()).all()
