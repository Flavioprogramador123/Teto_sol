from __future__ import annotations

from datetime import date


SOLAR_SCENARIOS = [
    {"id": "summer_solstice", "label": "Solstício de verão", "date_rule": "astronomical_summer_solstice"},
    {"id": "march_equinox", "label": "Equinócio de março", "date_rule": "march_equinox"},
    {"id": "winter_solstice", "label": "Solstício de inverno", "date_rule": "astronomical_winter_solstice"},
    {"id": "september_equinox", "label": "Equinócio de setembro", "date_rule": "september_equinox"},
]


def scenario_date(scenario_id: str, year: int = 2026) -> date:
    """Datas aproximadas astronômicas para cenários sazonais (hemisfério sul)."""
    table = {
        "summer_solstice": date(year, 12, 21),
        "winter_solstice": date(year, 6, 21),
        "march_equinox": date(year, 3, 20),
        "september_equinox": date(year, 9, 22),
    }
    if scenario_id not in table:
        raise ValueError(f"Cenário desconhecido: {scenario_id}")
    return table[scenario_id]


def default_time_range() -> dict:
    return {"start": "07:00", "end": "17:00", "step_minutes": 15}
