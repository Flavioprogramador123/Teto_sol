from __future__ import annotations

import re
from pathlib import Path

import cv2
import numpy as np


# Formatos do Earth: DM (16°19.4580'S), DMS (16°19'27.48"S), DD (-16.3243, -48.9255)

COORD_DMS_RE = re.compile(
    r"(\d{1,3})\s*[°º]?\s*(\d{1,2})\s*['′’]\s*(\d{1,2}(?:[.,]\d+)?)\s*(?:[\"″]|''|″)?\s*([NSns])"
    r"\s+(\d{1,3})\s*[°º]?\s*(\d{1,2})\s*['′’]\s*(\d{1,2}(?:[.,]\d+)?)\s*(?:[\"″]|''|″)?\s*([EWOLeolo])"
)

COORD_DM_RE = re.compile(
    r"(\d{1,3})\s*[°ºoO?]?\s*(\d{1,2}[.,]\d+)\s*['′’`]?\s*([NSns])"
    r"\s+(\d{1,3})\s*[°ºoO?]?\s*(\d{1,2}[.,]\d+)\s*['′’`]?\s*([EWOLeolo])"
)

COORD_DM_INT_RE = re.compile(
    r"(\d{1,3})\s*[°º]?\s*(\d{1,2})\s*['′’]\s*([NSns])"
    r"\s+(\d{1,3})\s*[°º]?\s*(\d{1,2})\s*['′’]\s*([EWOLeolo])"
)

COORD_DD_RE = re.compile(
    r"([+-]?\d{1,2}[.,]\d{3,8})\s*[,;\s]\s*([+-]?\d{1,3}[.,]\d{3,8})"
)

COORD_LOOSE_RE = re.compile(
    r"(\d{1,2})\s*[°ºoO?\s]\s*(\d{1,2}[.,]\d{2,6})\s*['′’`]?\s*([NSns])"
    r"\s+(\d{1,3})\s*[°ºoO?\s]\s*(\d{1,2}[.,]\d{2,6})\s*['′’`]?\s*([EWOLeolo])"
)

CAMERA_RE = re.compile(
    r"(?:c[aâáàãä]?mera|camera|cam)\s*[.:]?\s*([\d]{1,2}[.,]\d{3}|\d{3,5}(?:[.,]\d+)?)\s*m",
    re.I,
)


def _hemi_sign(hemi: str) -> float:
    return -1.0 if hemi.upper() in {"S", "W", "O"} else 1.0


def parse_earth_meters(raw: str, kind: str) -> float:
    n = float(raw.replace(",", "."))
    if kind != "scale" and re.fullmatch(r"\d{1,2}[.,]\d{3}", raw.strip()) and 0 < n < 20:
        return float(round(n * 1000))
    return n


def normalize_ocr_text(text: str) -> str:
    """Corrige ruído típico do OCR no rodapé fixo do Earth Web."""
    raw = text.replace("\n", " ").replace("\t", " ")
    raw = re.sub(r"(\d)\s*[?:]\s*(\d)", r"\1°\2", raw)
    raw = re.sub(r"(\d)\s+[oO]\s+(\d)", r"\1°\2", raw)
    raw = raw.replace("′", "'").replace("’", "'").replace("`", "'").replace("ʹ", "'")
    raw = raw.replace("″", '"').replace("“", '"').replace("”", '"')
    raw = re.sub(r'(\d)\s*"\s*([NSns])\b', r'\1"\2', raw)
    raw = re.sub(r'(\d)\s*"\s*([EWOLeolo])\b', r'\1"\2', raw)
    raw = re.sub(
        r"\b(\d{1,3})'\s*(\d{1,2}[.,]\d{2,6})\s*'\s*([EWOLeolo])\b",
        r"\1°\2'\3",
        raw,
    )
    raw = re.sub(
        r"\b(\d{1,3})'\s*(\d{1,2}[.,]\d{2,6})\s+([EWOLeolo])\b",
        r"\1°\2'\3",
        raw,
    )
    raw = re.sub(
        r"\b(\d{1,2})'\s*(\d{1,2}[.,]\d{2,6})\s*'\s*([NSns])\b",
        r"\1°\2'\3",
        raw,
    )
    raw = re.sub(
        r"\b(\d{1,2})'\s*(\d{1,2}[.,]\d{2,6})\s+([NSns])\b",
        r"\1°\2'\3",
        raw,
    )
    raw = re.sub(
        r"(\d{1,2})\s*'\s*(\d{1,2}(?:[.,]\d+)?)\s*\"\s*([NSns])\b",
        lambda m: f"{m.group(1)}'{m.group(2)}\"{m.group(3)}",
        raw,
    )
    raw = re.sub(
        r"(\d{1,2})\s*'\s*(\d{1,2}(?:[.,]\d+)?)\s*\"\s*([EWOLeolo])\b",
        lambda m: f"{m.group(1)}'{m.group(2)}\"{m.group(3)}",
        raw,
    )
    raw = re.sub(r"(\d)\s*'\s*([NSns])\b", r"\1'\2", raw)
    raw = re.sub(r"(\d)\s*'\s*([EWOLeolo])\b", r"\1'\2", raw)
    raw = re.sub(r"'\s*(?:VV|W)\b", "'W", raw, flags=re.I)
    raw = re.sub(r"c[aâ]?mera", "Câmera", raw, flags=re.I)
    raw = re.sub(r"\s+", " ", raw).strip()
    return raw


def _apply_dm(result: dict, lat_d: str, lat_m: str, lat_h: str, lon_d: str, lon_m: str, lon_h: str) -> None:
    lat = _hemi_sign(lat_h) * (int(lat_d) + float(lat_m.replace(",", ".")) / 60.0)
    lon = _hemi_sign(lon_h) * (int(lon_d) + float(lon_m.replace(",", ".")) / 60.0)
    result["latitude_deg"] = lat
    result["longitude_deg"] = lon
    result["lat_text"] = f"{lat_d}°{lat_m}'{lat_h.upper()}"
    result["lon_text"] = f"{lon_d}°{lon_m}'{lon_h.upper()}"
    result["coord_format"] = "dm"


def _apply_dms(
    result: dict,
    lat_d: str,
    lat_m: str,
    lat_s: str,
    lat_h: str,
    lon_d: str,
    lon_m: str,
    lon_s: str,
    lon_h: str,
) -> None:
    lat = _hemi_sign(lat_h) * (
        int(lat_d) + int(lat_m) / 60.0 + float(lat_s.replace(",", ".")) / 3600.0
    )
    lon = _hemi_sign(lon_h) * (
        int(lon_d) + int(lon_m) / 60.0 + float(lon_s.replace(",", ".")) / 3600.0
    )
    result["latitude_deg"] = lat
    result["longitude_deg"] = lon
    result["lat_text"] = f'{lat_d}°{lat_m}\'{lat_s}"{lat_h.upper()}'
    result["lon_text"] = f'{lon_d}°{lon_m}\'{lon_s}"{lon_h.upper()}'
    result["coord_format"] = "dms"


def parse_georef_text(text: str) -> dict:
    raw = normalize_ocr_text(text)
    result = {
        "source": "google_earth_web",
        "north_up": True,
        "heading_deg": 0.0,
        "latitude_deg": None,
        "longitude_deg": None,
        "lat_text": None,
        "lon_text": None,
        "elevation_m": None,
        "camera_m": None,
        "scale_bar_m": None,
        "imagery_date": None,
        "raw_text": raw,
        "confidence": "none",
        "coord_format": "unknown",
    }

    # DMS antes de DM — minutos decimais não podem engolir segundos.
    dms = COORD_DMS_RE.search(raw)
    dm = COORD_DM_RE.search(raw) or COORD_LOOSE_RE.search(raw) or COORD_DM_INT_RE.search(raw)
    dd = COORD_DD_RE.search(raw)
    if dms:
        _apply_dms(result, *dms.groups())
    elif dm:
        _apply_dm(result, *dm.groups())
    elif dd:
        lat = float(dd.group(1).replace(",", "."))
        lon = float(dd.group(2).replace(",", "."))
        if abs(lat) <= 90 and abs(lon) <= 180:
            result["latitude_deg"] = lat
            result["longitude_deg"] = lon
            result["lat_text"] = f"{lat:.6f}°"
            result["lon_text"] = f"{lon:.6f}°"
            result["coord_format"] = "dd"

    cam = CAMERA_RE.search(raw)
    if cam:
        result["camera_m"] = parse_earth_meters(cam.group(1), "camera")

    date = re.search(r"(\d{1,2}/\d{1,2}/\d{4})", raw)
    if date:
        result["imagery_date"] = date.group(1)

    # Ordem fixa do rodapé: escala pequena → câmera → coords → elevação (milhar PT-BR)
    tokens = re.findall(r"(?<![\d.,])(\d{1,3}(?:[.,]\d+)?)\s*m\b", raw, flags=re.I)
    thousand = [t for t in tokens if re.fullmatch(r"\d{1,2}[.,]\d{3}", t.strip())]
    if result["camera_m"] is None and thousand:
        result["camera_m"] = parse_earth_meters(thousand[0], "camera")

    scale_vals = []
    for t in tokens:
        if re.fullmatch(r"\d{1,2}[.,]\d{3}", t.strip()):
            continue
        m = parse_earth_meters(t, "scale")
        if 1 <= m <= 200 and m != result["camera_m"]:
            scale_vals.append(m)
    if scale_vals:
        result["scale_bar_m"] = scale_vals[0]

    if len(thousand) >= 2:
        result["elevation_m"] = parse_earth_meters(thousand[-1], "elevation")
    else:
        elev_vals = []
        for t in tokens:
            m = parse_earth_meters(t, "elevation")
            if m >= 50 and m != result["camera_m"] and m != result["scale_bar_m"]:
                elev_vals.append(m)
        if elev_vals:
            result["elevation_m"] = elev_vals[-1]

    if result["latitude_deg"] is not None and result["longitude_deg"] is not None:
        result["confidence"] = "high"
    elif result["scale_bar_m"] is not None or result["camera_m"] is not None:
        result["confidence"] = "low"
    elif raw:
        result["confidence"] = "low"
    return result


def _prepare_band(gray: np.ndarray) -> np.ndarray:
    up = cv2.resize(gray, None, fx=2.6, fy=2.6, interpolation=cv2.INTER_CUBIC)
    blur = cv2.GaussianBlur(up, (3, 3), 0)
    _, thr = cv2.threshold(blur, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    if np.mean(thr) > 127:
        thr = cv2.bitwise_not(thr)
    return thr


def footer_bands(image: np.ndarray) -> list[np.ndarray]:
    """Gera recortes do rodapé fixo (barra cinza inferior / canto direito)."""
    h, w = image.shape[:2]
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if image.ndim == 3 else image
    bands: list[np.ndarray] = []

    # Imagem já é um crop do rodapé
    if h <= 420 or h / max(w, 1) < 0.55:
        bands.append(_prepare_band(gray))
        bands.append(_prepare_band(gray[:, int(w * 0.08) :]))
        return bands

    # Faixa inferior completa (barra cinza)
    for top_frac in (0.90, 0.86, 0.82):
        band = gray[int(h * top_frac) : h, 0:w]
        bands.append(_prepare_band(band))
        # metade direita: escala + câmera + coords + elevação
        bands.append(_prepare_band(band[:, int(w * 0.35) :]))
        # terço direito: coords + elevação
        bands.append(_prepare_band(band[:, int(w * 0.52) :]))
    return bands


def footer_crop(image: np.ndarray) -> np.ndarray:
    bands = footer_bands(image)
    return bands[0] if bands else image


def _ocr_text(image: np.ndarray) -> str:
    try:
        from rapidocr_onnxruntime import RapidOCR

        engine = RapidOCR()
        rgb = cv2.cvtColor(image, cv2.COLOR_GRAY2BGR) if image.ndim == 2 else image
        out, _ = engine(rgb)
        if not out:
            return ""
        # Ordena da esquerda para a direita (layout fixo do rodapé)
        items = sorted(out, key=lambda item: float(item[0][0][0]) if item and item[0] else 0.0)
        return " ".join(str(item[1]) for item in items if len(item) > 1)
    except Exception:
        return ""


def extract_georef(source_path: str | Path) -> dict:
    image = cv2.imread(str(source_path))
    if image is None:
        return parse_georef_text("")

    best = parse_georef_text("")
    best_score = -1
    for band in footer_bands(image):
        text = _ocr_text(band)
        parsed = parse_georef_text(text)
        score = 0
        if parsed["latitude_deg"] is not None:
            score += 100
        if parsed["longitude_deg"] is not None:
            score += 100
        if parsed["camera_m"] is not None:
            score += 20
        if parsed["scale_bar_m"] is not None:
            score += 10
        if parsed["elevation_m"] is not None:
            score += 10
        score += min(len(parsed.get("raw_text") or ""), 40)
        if score > best_score:
            best_score = score
            best = parsed

    best["north_up"] = True
    best["heading_deg"] = 0.0
    best["source"] = "google_earth_web"
    return best
