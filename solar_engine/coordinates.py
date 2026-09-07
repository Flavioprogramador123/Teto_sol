from __future__ import annotations

import math

from pyproj import Transformer


WGS84_TO_ECEF = Transformer.from_crs(
    "EPSG:4979",
    "EPSG:4978",
    always_xy=True,
)


def geodetic_to_ecef(
    latitude: float,
    longitude: float,
    height_m: float,
) -> tuple[float, float, float]:
    x, y, z = WGS84_TO_ECEF.transform(longitude, latitude, height_m)
    return float(x), float(y), float(z)


def ecef_to_enu(
    ecef: tuple[float, float, float],
    origin_ecef: tuple[float, float, float],
    origin_latitude: float,
    origin_longitude: float,
) -> tuple[float, float, float]:
    """Converte ECEF para East, North, Up local."""
    dx = ecef[0] - origin_ecef[0]
    dy = ecef[1] - origin_ecef[1]
    dz = ecef[2] - origin_ecef[2]

    lat = math.radians(origin_latitude)
    lon = math.radians(origin_longitude)

    east = -math.sin(lon) * dx + math.cos(lon) * dy
    north = (
        -math.sin(lat) * math.cos(lon) * dx
        - math.sin(lat) * math.sin(lon) * dy
        + math.cos(lat) * dz
    )
    up = (
        math.cos(lat) * math.cos(lon) * dx
        + math.cos(lat) * math.sin(lon) * dy
        + math.sin(lat) * dz
    )

    return east, north, up


def latlon_to_enu(
    latitude: float,
    longitude: float,
    height_m: float,
    origin_latitude: float,
    origin_longitude: float,
    origin_height_m: float = 0.0,
) -> tuple[float, float, float]:
    origin = geodetic_to_ecef(
        origin_latitude,
        origin_longitude,
        origin_height_m,
    )
    point = geodetic_to_ecef(latitude, longitude, height_m)
    return ecef_to_enu(
        point,
        origin,
        origin_latitude,
        origin_longitude,
    )
