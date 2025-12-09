"""Solution preparation calculators for common electrolytes."""
from __future__ import annotations

from typing import Dict

MOLAR_MASSES: Dict[str, float] = {
    "K2CO3": 138.205,
    "Na2CO3": 105.9888,
    "Na2CO3·10H2O": 286.141,
    "KNO3": 101.1032,
    "Sr(NO3)2": 211.629,
    "Mg(NO3)2": 148.313,
    "Mg(NO3)2·6H2O": 256.41,
    "Na2SO4": 142.04,
    "Na2SO4·10H2O": 322.20,
    "H2SO4": 98.079,
}

H2SO4_PURITY = 0.98
H2SO4_DENSITY_G_ML = 1.84


def calc_solid_mass(formula: str, volume_ml: float, molarity: float) -> float:
    """Return grams of solid required to prepare the target volume and molarity."""
    if formula not in MOLAR_MASSES:
        raise ValueError(f"Unknown formula: {formula}")
    moles = (volume_ml / 1000.0) * molarity
    return moles * MOLAR_MASSES[formula]


def calc_h2so4_volume(volume_ml: float, molarity: float) -> float:
    """Calculate mL of concentrated H2SO4 needed for desired molarity."""
    moles = (volume_ml / 1000.0) * molarity
    grams_needed = moles * MOLAR_MASSES["H2SO4"]
    # grams of pure acid divided by purity gives grams of concentrated solution
    grams_solution = grams_needed / H2SO4_PURITY
    # volume = mass / density
    return grams_solution / H2SO4_DENSITY_G_ML
