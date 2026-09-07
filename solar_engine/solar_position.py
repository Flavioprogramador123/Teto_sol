from __future__ import annotations

from datetime import date, datetime, time
from zoneinfo import ZoneInfo

import pandas as pd
from pvlib.location import Location


def build_time_index(
    day: date,
    time_start: str,
    time_end: str,
    step_minutes: int,
    timezone_name: str,
) -> pd.DatetimeIndex:
    """Cria horários locais conscientes de fuso horário."""
    timezone = ZoneInfo(timezone_name)
    start_hour, start_minute = map(int, time_start.split(":"))
    end_hour, end_minute = map(int, time_end.split(":"))

    start = datetime.combine(day, time(start_hour, start_minute), tzinfo=timezone)
    end = datetime.combine(day, time(end_hour, end_minute), tzinfo=timezone)

    return pd.date_range(
        start=start,
        end=end,
        freq=f"{step_minutes}min",
    )


def calculate_solar_position(
    latitude: float,
    longitude: float,
    timezone_name: str,
    day: date,
    time_start: str = "07:00",
    time_end: str = "17:00",
    step_minutes: int = 15,
) -> pd.DataFrame:
    """Calcula posição solar para o local e período informados (NREL via pvlib)."""
    times = build_time_index(
        day=day,
        time_start=time_start,
        time_end=time_end,
        step_minutes=step_minutes,
        timezone_name=timezone_name,
    )

    location = Location(
        latitude=latitude,
        longitude=longitude,
        tz=timezone_name,
        name="Pepilene project",
    )

    solar_position = location.get_solarposition(
        times,
        method="nrel_numpy",
    )

    solar_position["latitude"] = latitude
    solar_position["longitude"] = longitude
    solar_position["timezone"] = timezone_name
    solar_position["sun_up"] = solar_position["elevation"] > 0.0

    return solar_position.reset_index(names="timestamp")


def add_sunrise_sunset(
    position: pd.DataFrame,
    latitude: float,
    longitude: float,
    timezone_name: str,
) -> pd.DataFrame:
    """Adiciona marcadores de nascer e pôr do Sol ao resultado."""
    if position.empty:
        return position

    location = Location(
        latitude=latitude,
        longitude=longitude,
        tz=timezone_name,
    )

    day = position["timestamp"].iloc[0].date()
    day_index = pd.DatetimeIndex([pd.Timestamp(day, tz=timezone_name)])

    events = location.get_sun_rise_set_transit(day_index)
    event_row = events.iloc[0]

    result = position.copy()
    result["sunrise"] = event_row["sunrise"]
    result["sunset"] = event_row["sunset"]
    result["solar_transit"] = event_row["transit"]
    return result


if __name__ == "__main__":
    data = calculate_solar_position(
        latitude=-16.328,
        longitude=-48.953,
        timezone_name="America/Sao_Paulo",
        day=date(2026, 6, 21),
        time_start="07:00",
        time_end="17:00",
        step_minutes=15,
    )
    print(data[["timestamp", "azimuth", "elevation", "zenith", "sun_up"]].head())
