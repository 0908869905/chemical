"""Analysis and anomaly detection tools for carbon rod exfoliation experiments."""
from __future__ import annotations

from collections import defaultdict
from dataclasses import asdict
from datetime import datetime
from pathlib import Path
from typing import Dict, Iterable, List, Tuple

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

from . import config
from .models import Anomaly, Experiment


def experiments_to_dataframe(experiments: Iterable[Experiment]) -> pd.DataFrame:
    """Convert experiments to a pandas DataFrame for analysis."""
    records = [
        {
            "id": exp.id,
            "date_time": exp.date_time,
            "experiment_id": exp.experiment_id,
            "mode": exp.mode,
            "voltage_V": exp.voltage_V,
            "current_A": exp.current_A,
            "electrolyte": exp.electrolyte,
            "duration_min": exp.duration_min,
            "delta_mass_positive_g": exp.delta_mass_positive_g,
            "delta_mass_negative_g": exp.delta_mass_negative_g,
            "notes": exp.notes,
        }
        for exp in experiments
    ]
    if not records:
        return pd.DataFrame()
    df = pd.DataFrame(records)
    df["date_time"] = pd.to_datetime(df["date_time"])
    return df


def basic_statistics(df: pd.DataFrame) -> Dict[str, Dict[str, float]]:
    """Compute summary statistics for anode and cathode mass deltas."""
    if df.empty:
        return {}

    stats = {}
    for label, column in [
        ("anode", "delta_mass_positive_g"),
        ("cathode", "delta_mass_negative_g"),
    ]:
        series = df[column]
        stats[label] = {
            "mean": float(series.mean()),
            "std": float(series.std(ddof=0)),
            "max": float(series.max()),
            "min": float(series.min()),
        }
    stats["ratio_mean_abs"] = float(
        (df["delta_mass_negative_g"].abs() / df["delta_mass_positive_g"].abs().replace(0, np.nan)).mean()
    )
    return stats


def grouped_statistics(df: pd.DataFrame) -> Dict[Tuple[str, str], Dict[str, Dict[str, float]]]:
    """Compute statistics grouped by electrolyte and mode."""
    if df.empty:
        return {}
    results: Dict[Tuple[str, str], Dict[str, Dict[str, float]]] = {}
    for (electrolyte, mode), group in df.groupby(["electrolyte", "mode"]):
        results[(electrolyte, mode)] = basic_statistics(group)
    return results


def detect_anomalies(
    experiments: Iterable[Experiment],
    thresholds: Dict[str, float] | None = None,
) -> List[Anomaly]:
    """Detect anomalies based on configurable thresholds."""
    thresholds = {**config.DEFAULT_ANALYSIS_CONFIG, **(thresholds or {})}
    cathode_ratio_limit = thresholds["cathode_loss_ratio_threshold"]
    anode_loss_limit = thresholds["anode_loss_threshold_g"]
    instability_std_limit = thresholds["std_dev_instability_threshold_g"]

    anomalies: List[Anomaly] = []
    experiments_list = list(experiments)
    if not experiments_list:
        return anomalies

    for exp in experiments_list:
        if exp.delta_mass_positive_g != 0:
            ratio = abs(exp.delta_mass_negative_g) / abs(exp.delta_mass_positive_g)
            if ratio >= cathode_ratio_limit:
                anomalies.append(
                    Anomaly(
                        experiment_id=exp.experiment_id,
                        anomaly_type="HIGH_CATHODE_LOSS",
                        message=(
                            f"陰極質量變化過大，|Δm-|/|Δm+| = {ratio:.2f} 超過門檻 {cathode_ratio_limit}"
                        ),
                    )
                )
        if exp.delta_mass_positive_g >= anode_loss_limit:
            anomalies.append(
                Anomaly(
                    experiment_id=exp.experiment_id,
                    anomaly_type="HIGH_ANODE_LOSS",
                    message=(f"陽極質量流失 {exp.delta_mass_positive_g:.3f} g 超過門檻 {anode_loss_limit} g"),
                )
            )

    df = experiments_to_dataframe(experiments_list)
    if not df.empty:
        grouped = df.groupby(["electrolyte", "mode"])
        for (electrolyte, mode), group in grouped:
            std_anode = group["delta_mass_positive_g"].std(ddof=0)
            if std_anode >= instability_std_limit:
                anomalies.append(
                    Anomaly(
                        experiment_id=f"GROUP-{electrolyte}-{mode}",
                        anomaly_type="UNSTABLE_RESULTS",
                        message=(
                            f"條件({electrolyte}, {mode}) 下陽極 Δm 標準差 {std_anode:.3f} g 超過 {instability_std_limit} g"
                        ),
                    )
                )
    return anomalies


def plot_deltas(df: pd.DataFrame, title: str, output_path: Path) -> Path:
    """Plot Δm for anode and cathode by experiment id."""
    output_path.parent.mkdir(exist_ok=True)
    if df.empty:
        raise ValueError("No data available for plotting.")

    plt.figure(figsize=(8, 4))
    plt.plot(df["experiment_id"], df["delta_mass_positive_g"], label="Δm+ (anode)", marker="o")
    plt.plot(df["experiment_id"], df["delta_mass_negative_g"], label="Δm- (cathode)", marker="o")
    plt.xticks(rotation=45, ha="right")
    plt.title(title)
    plt.xlabel("Experiment ID")
    plt.ylabel("Δm (g)")
    plt.legend()
    plt.tight_layout()
    plt.savefig(output_path)
    plt.close()
    return output_path


def plot_time_trend(df: pd.DataFrame, title: str, output_path: Path) -> Path:
    """Plot Δm over time when date information is available."""
    output_path.parent.mkdir(exist_ok=True)
    if df.empty:
        raise ValueError("No data available for plotting.")

    sorted_df = df.sort_values("date_time")
    plt.figure(figsize=(8, 4))
    plt.plot(sorted_df["date_time"], sorted_df["delta_mass_positive_g"], label="Δm+ (anode)")
    plt.plot(sorted_df["date_time"], sorted_df["delta_mass_negative_g"], label="Δm- (cathode)")
    plt.title(title)
    plt.xlabel("Date")
    plt.ylabel("Δm (g)")
    plt.legend()
    plt.tight_layout()
    plt.savefig(output_path)
    plt.close()
    return output_path


def summarize_analysis(experiments: Iterable[Experiment]) -> Dict[str, object]:
    """Return combined statistics and anomaly results for convenience."""
    exp_list = list(experiments)
    df = experiments_to_dataframe(exp_list)
    stats_all = basic_statistics(df) if not df.empty else {}
    grouped_stats = grouped_statistics(df) if not df.empty else {}
    anomalies = detect_anomalies(exp_list)
    return {
        "overall_stats": stats_all,
        "grouped_stats": {str(k): v for k, v in grouped_stats.items()},
        "anomalies": [asdict(a) for a in anomalies],
    }
