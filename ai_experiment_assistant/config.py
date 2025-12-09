"""Configuration utilities for the AI experiment assistant."""
from __future__ import annotations

import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
PLOTS_DIR = BASE_DIR / "plots"
EXPORTS_DIR = BASE_DIR / "exports"
REPORTS_DIR = BASE_DIR / "reports"

for _dir in (DATA_DIR, PLOTS_DIR, EXPORTS_DIR, REPORTS_DIR):
    _dir.mkdir(exist_ok=True)

DATABASE_URL = os.environ.get("EXPERIMENT_DB_URL", f"sqlite:///{DATA_DIR / 'experiments.db'}")

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
OPENAI_MODEL = os.environ.get("OPENAI_MODEL", "gpt-4o-mini")
OPENAI_API_BASE = os.environ.get("OPENAI_API_BASE", "https://api.openai.com/v1/chat/completions")

DEFAULT_ANALYSIS_CONFIG = {
    "cathode_loss_ratio_threshold": 0.5,
    "anode_loss_threshold_g": 0.1,
    "std_dev_instability_threshold_g": 0.05,
}
