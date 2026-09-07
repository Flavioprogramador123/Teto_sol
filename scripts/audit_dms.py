"""Audita conversão DMS → graus decimais."""
from __future__ import annotations

from visual_engine.georef import parse_georef_text


def dms_to_dd(deg: float, minutes: float, seconds: float, hemi: str) -> float:
    sign = -1.0 if hemi.upper() in {"S", "W", "O"} else 1.0
    return sign * (deg + minutes / 60.0 + seconds / 3600.0)


cases = [
    {
        "text": "16°19'27.8\"S 48°55'31.9\"W",
        "parts": ((16, 19, 27.8, "S"), (48, 55, 31.9, "W")),
        "expected": (-16.324392, -48.925526),
    },
    {
        "text": "16°43'33.4\"S 49°09'50.2\"W",
        "parts": ((16, 43, 33.4, "S"), (49, 9, 50.2, "W")),
        "expected": (-16.725952, -49.163954),
    },
]

print("Fórmula: decimal = ±(graus + minutos/60 + segundos/3600)")
print("Hemisfério S / W / O => sinal negativo\n")

ok = True
for case in cases:
    (lat_p, lon_p) = case["parts"]
    exp_lat, exp_lon = case["expected"]
    m_lat = dms_to_dd(*lat_p)
    m_lon = dms_to_dd(*lon_p)
    parsed = parse_georef_text(case["text"])
    print(case["text"])
    print(f"  esperado:   {exp_lat:.6f}, {exp_lon:.6f}")
    print(f"  fórmula:    {m_lat:.6f}, {m_lon:.6f}")
    print(f"  Δ fórmula:  {abs(m_lat - exp_lat):.9f}, {abs(m_lon - exp_lon):.9f}")
    print(
        f"  parser:     {parsed['latitude_deg']:.6f}, {parsed['longitude_deg']:.6f}"
        f"  [{parsed.get('coord_format')}]"
    )
    print(
        f"  Δ parser:   {abs(parsed['latitude_deg'] - exp_lat):.9f}, "
        f"{abs(parsed['longitude_deg'] - exp_lon):.9f}"
    )
    if abs(m_lat - exp_lat) > 5e-7 or abs(m_lon - exp_lon) > 5e-7:
        ok = False
        print("  FALHA fórmula")
    if abs(parsed["latitude_deg"] - exp_lat) > 5e-7 or abs(parsed["longitude_deg"] - exp_lon) > 5e-7:
        ok = False
        print("  FALHA parser")
    print()

print("RESULTADO:", "OK" if ok else "DIVERGÊNCIA")
