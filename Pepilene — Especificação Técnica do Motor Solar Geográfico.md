# Pepilene — Especificação Técnica do Motor Solar Geográfico

## 1. Objetivo

Este documento define a arquitetura do **Motor Solar Geográfico do Pepilene**, responsável por calcular a posição do Sol, projetar sombras e avaliar a interferência sobre áreas úteis, módulos fotovoltaicos, telhados, obstáculos e estruturas vizinhas.

O motor deve funcionar a partir do local real do projeto, utilizando latitude, longitude, fuso horário, orientação Norte, data, hora, inclinação das águas, alturas relativas e geometrias desenhadas pelo projetista.

> **A imagem do Google Earth será utilizada como base visual georreferenciada. O cálculo solar e geométrico deverá ocorrer em coordenadas métricas locais, não diretamente em pixels.**

A posição do Sol deve ser obtida por azimute e elevação. O azimute será medido no sentido horário a partir do Norte verdadeiro, e a elevação será medida acima do horizonte [1]. Para o cálculo programático, o Pepilene utilizará `pvlib`, que oferece funções de posição solar baseadas no algoritmo NREL SPA, além de horários de nascer, trânsito e pôr do Sol [2].

## 2. Problema que o motor deve resolver

A projeção de módulos sobre uma imagem plana não é suficiente para representar a sombra real. A sombra muda conforme:

| Fator | Efeito |
|---|---|
| Latitude | Altera a trajetória anual do Sol |
| Longitude | Altera a relação entre hora oficial e hora solar |
| Data | Altera a declinação solar e a trajetória diária |
| Hora | Altera azimute, elevação e comprimento da sombra |
| Fuso horário | Converte o horário local para o cálculo solar |
| Altura do obstáculo | Determina o comprimento potencial da sombra |
| Posição do obstáculo | Determina onde a sombra será projetada |
| Inclinação do telhado | Altera o plano de interseção da sombra |
| Direção da água | Altera a orientação da superfície e dos módulos |
| Geometria do módulo | Permite calcular a área efetivamente sombreada |

Assim, Anápolis-GO e São Paulo-SP não podem usar uma mesma tabela fixa de sombras. Em Anápolis, aproximadamente 16,3° Sul, e em São Paulo, aproximadamente 23,6° Sul, o Sol atinge alturas diferentes nas mesmas datas. No solstício de junho, por exemplo, a altura solar ao meio-dia solar é aproximadamente 50° em Anápolis e 43° em São Paulo, produzindo sombras mais longas em São Paulo para o mesmo obstáculo.

## 3. Arquitetura geral

O sistema deve ser dividido em quatro motores independentes:

```text
MOTOR DE GEOREFERENCIAMENTO
    → imagem, latitude, longitude, escala e orientação Norte

MOTOR GEOMÉTRICO
    → águas, módulos, obstáculos, planos e alturas

MOTOR SOLAR
    → azimute, elevação, declinação e horários solares

MOTOR DE SOMBRAS
    → raios, interseções, áreas sombreadas e relatórios
```

O fluxo completo será:

```text
Google Earth / coordenadas do projeto
    ↓
Imagem orientada pelo Norte verdadeiro
    ↓
Transformação para coordenadas locais ENU
    ↓
Águas, módulos, obstáculos e alturas 3D
    ↓
Posição solar por latitude, data e hora
    ↓
Projeção geométrica das sombras
    ↓
Interseção com módulos e áreas úteis
    ↓
Mapa visual, indicadores e relatório
```

## 4. Sistema de coordenadas ENU

O motor deve utilizar um sistema local métrico **ENU — East, North, Up**:

```text
E = eixo Leste-Oeste, em metros
N = eixo Norte-Sul, em metros
U = eixo vertical, em metros
```

A origem pode ser o centro do projeto ou um ponto escolhido pelo usuário. Latitude e longitude devem ser preservadas para o cálculo solar, enquanto o sistema ENU será usado para geometria e sombras.

O Pepilene deve manter a distinção entre:

| Dado | Uso |
|---|---|
| Latitude/longitude | Cálculo da posição solar e localização geográfica |
| Coordenada de pixel | Desenho sobre a imagem |
| Coordenada ENU | Geometria métrica e sombras |
| Altura relativa | Diferença vertical entre terreno, telhado e obstáculos |
| Altitude absoluta | Integração com dados topográficos ou geodésicos |

## 5. Georreferenciamento da imagem

Quando o Google Earth estiver com o Norte para cima, o sistema deve registrar essa condição, mas não deve depender apenas dela. A imagem também precisa armazenar escala, origem geográfica e pontos de controle.

```json
{
  "image_georeference": {
    "image_id": "img-001",
    "north_up": true,
    "north_reference": "true_north",
    "rotation_deg": 0.0,
    "scale_m_per_pixel": 0.25,
    "origin_latitude": -16.328,
    "origin_longitude": -48.953,
    "projection": "local_enu",
    "ground_reference": "local_ground",
    "control_points": [
      {
        "pixel": [120, 180],
        "latitude": -16.32795,
        "longitude": -48.95290,
        "east_m": 0.0,
        "north_m": 0.0
      },
      {
        "pixel": [920, 180],
        "latitude": -16.32795,
        "longitude": -48.94380,
        "east_m": 950.0,
        "north_m": 0.0
      }
    ]
  }
}
```

Em imagens oblíquas ou em perspectiva, a escala não será uniforme em todos os pontos. Nesse caso, o Pepilene deve utilizar pontos de controle e uma transformação projetiva, como homografia, somente para converter a geometria para a imagem.

## 6. Configuração do projeto

Exemplo para um projeto em Anápolis-GO:

```json
{
  "project": {
    "id": "project-anapolis-001",
    "name": "Residência Anápolis",
    "location": {
      "latitude": -16.328,
      "longitude": -48.953,
      "timezone": "America/Sao_Paulo",
      "country": "BR",
      "state": "GO",
      "city": "Anápolis"
    },
    "north_reference": "true_north",
    "coordinate_system": "local_enu",
    "origin": {
      "latitude": -16.328,
      "longitude": -48.953,
      "height_m": 0.0
    },
    "terrain_reference": "local_ground",
    "source": "google_earth_image",
    "image_id": "img-001"
  }
}
```

Exemplo equivalente para São Paulo-SP:

```json
{
  "project": {
    "id": "project-sao-paulo-001",
    "name": "Residência São Paulo",
    "location": {
      "latitude": -23.550,
      "longitude": -46.633,
      "timezone": "America/Sao_Paulo",
      "country": "BR",
      "state": "SP",
      "city": "São Paulo"
    },
    "north_reference": "true_north",
    "coordinate_system": "local_enu",
    "origin": {
      "latitude": -23.550,
      "longitude": -46.633,
      "height_m": 0.0
    },
    "terrain_reference": "local_ground",
    "source": "google_earth_image",
    "image_id": "img-002"
  }
}
```

## 7. Modelagem das águas do telhado

Cada água deve ser um plano independente. O campo `material` pode sugerir uma inclinação inicial, mas nunca deve determinar automaticamente a inclinação final. A inclinação deve vir de medição, projeto, ficha técnica ou confirmação do usuário.

```json
{
  "roof_planes": [
    {
      "id": "agua-01",
      "name": "Água frontal",
      "base_height_m": 7.20,
      "height_reference": "relative_to_local_ground",
      "slope_percent": 30.0,
      "slope_angle_deg": 16.699,
      "fall_direction_deg": 90.0,
      "azimuth_plane_deg": 270.0,
      "material": "fibrocimento",
      "tile_model": "não informado",
      "polygon_local_m": [
        [0.0, 0.0],
        [12.0, 0.0],
        [12.0, 8.0],
        [0.0, 8.0]
      ],
      "projection_mode": "orthographic",
      "slope_source": "manual",
      "slope_confidence": "confirmed"
    }
  ]
}
```

A relação entre inclinação percentual e ângulo é:

```text
ângulo = arctan(inclinação_percentual / 100)
```

O comprimento real sobre a água inclinada é:

```text
comprimento_real = comprimento_horizontal / cos(ângulo)
```

O layout deve ser calculado no plano real da água. Só depois o resultado deve ser projetado para a imagem.

## 8. Modelagem de módulos

```json
{
  "module_catalog": {
    "brand": "RENEPV",
    "model": "680W",
    "power_w": 680,
    "width_m": 1.303,
    "height_m": 2.384,
    "gap_m": 0.020,
    "rotation_allowed": true,
    "dimensions_reference": "roof_surface_plane"
  },
  "layout": {
    "id": "layout-001",
    "roof_plane_id": "agua-01",
    "quantity_requested": 18,
    "quantity_installed": 18,
    "total_power_kwp": 12.24,
    "coordinate_system": "roof_surface_plane",
    "modules": [
      {
        "id": "module-01",
        "row": 1,
        "column": 1,
        "polygon_surface_m": [
          [0.50, 0.50],
          [1.803, 0.50],
          [1.803, 2.884],
          [0.50, 2.884]
        ],
        "rotation_deg": 0.0,
        "power_w": 680,
        "status": "valid"
      }
    ]
  }
}
```

As dimensões devem ser confirmadas pela ficha técnica do modelo exato. A potência de 18 módulos de 680 W deve ser calculada pelo sistema como 12,24 kWp.

## 9. Modelagem de obstáculos e alturas

Cada obstáculo precisa de geometria, altura-base, altura própria e referência vertical.

```json
{
  "obstacles": [
    {
      "id": "obstaculo-01",
      "name": "Caixa d'água",
      "type": "water_tank",
      "roof_plane_id": "agua-01",
      "polygon_local_m": [
        [4.0, 3.0],
        [5.5, 3.0],
        [5.5, 4.5],
        [4.0, 4.5]
      ],
      "base_height_m": 7.20,
      "height_m": 2.00,
      "top_height_m": 9.20,
      "height_reference": "relative_to_local_ground",
      "safety_margin_m": 0.80,
      "casts_shadow": true,
      "excluded_from_layout": true
    },
    {
      "id": "building-neighbor-01",
      "name": "Edificação vizinha",
      "type": "building",
      "polygon_local_m": [
        [-18.0, 4.0],
        [-6.0, 4.0],
        [-6.0, 18.0],
        [-18.0, 18.0]
      ],
      "base_height_m": 0.00,
      "height_m": 8.50,
      "top_height_m": 8.50,
      "height_reference": "relative_to_local_ground",
      "safety_margin_m": 0.00,
      "casts_shadow": true,
      "excluded_from_layout": false
    }
  ]
}
```

O motor deve perguntar ou registrar explicitamente se a altura é:

```text
altura absoluta acima do nível do mar;
altura relativa ao solo local;
altura relativa ao plano-base do projeto;
altura relativa à água do telhado.
```

## 10. Cenários sazonais

O sistema deve oferecer os seguintes cenários mínimos:

```json
{
  "solar_scenarios": [
    {
      "id": "summer_solstice",
      "label": "Solstício de verão",
      "date_rule": "astronomical_summer_solstice"
    },
    {
      "id": "march_equinox",
      "label": "Equinócio de março",
      "date_rule": "march_equinox"
    },
    {
      "id": "winter_solstice",
      "label": "Solstício de inverno",
      "date_rule": "astronomical_winter_solstice"
    },
    {
      "id": "september_equinox",
      "label": "Equinócio de setembro",
      "date_rule": "september_equinox"
    }
  ],
  "default_time_range": {
    "start": "07:00",
    "end": "17:00",
    "step_minutes": 15
  }
}
```

As datas devem ser calculadas astronomicamente ou definidas pelo usuário. Não se deve assumir que verão e inverno possuem as mesmas datas ou efeitos nos dois hemisférios.

## 11. Configuração completa da simulação

```json
{
  "solar_simulation": {
    "id": "simulation-001",
    "project_id": "project-anapolis-001",
    "latitude": -16.328,
    "longitude": -48.953,
    "timezone": "America/Sao_Paulo",
    "north_reference": "true_north",
    "date": "2026-06-21",
    "time_start": "07:00",
    "time_end": "17:00",
    "time_step_minutes": 15,
    "scenario": "winter_solstice",
    "solar_position_method": "nrel_spa",
    "terrain_reference": "local_ground",
    "include_diffuse_shading": false,
    "include_direct_shading": true,
    "shadow_threshold_percent": 1.0,
    "output": {
      "save_sun_path": true,
      "save_shadow_polygons": true,
      "save_module_results": true,
      "render_image_overlay": true
    }
  }
}
```

## 12. Instalação Python

Criar `requirements-solar.txt`:

```txt
pvlib>=0.10,<1.0
pandas>=2.0,<3.0
numpy>=1.26,<3.0
shapely>=2.0,<3.0
pyproj>=3.6,<4.0
Pillow>=10.0,<13.0
opencv-python-headless>=4.8,<5.0
pydantic>=2.0,<3.0
python-dateutil>=2.8,<3.0
```

Instalar:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements-solar.txt
```

Validar:

```bash
python -c "import pvlib, pandas, numpy, shapely, pyproj; print('Motor solar instalado')"
```

## 13. Script de posição solar com pvlib

Criar `solar_engine/solar_position.py`:

```python
from __future__ import annotations

from datetime import date, datetime, time
from zoneinfo import ZoneInfo

import pandas as pd
import pvlib
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
    """Calcula posição solar para o local e período informados."""
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
    day_index = pd.DatetimeIndex([
        pd.Timestamp(day, tz=timezone_name)
    ])

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
```

O resultado fornece, entre outros campos, `azimuth`, `elevation`, `zenith` e `apparent_zenith`. Para sombra geométrica, usar a posição solar apenas quando `elevation > 0`.

## 14. Conversão de latitude/longitude para ENU

Criar `solar_engine/coordinates.py`:

```python
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
```

Para projetos pequenos, o sistema ENU local é suficiente para converter os elementos desenhados em coordenadas métricas. Para projetos extensos, considerar uma projeção cartográfica apropriada, como UTM, antes de realizar a geometria.

## 15. Vetor solar em ENU

O azimute solar é contado no sentido horário a partir do Norte. Para um azimute `A` e elevação `E`, o vetor que aponta **do observador para o Sol** é:

```text
East  = cos(E) × sin(A)
North = cos(E) × cos(A)
Up    = sin(E)
```

Criar `solar_engine/vectors.py`:

```python
from __future__ import annotations

import math

import numpy as np


def sun_vector_enu(
    azimuth_deg: float,
    elevation_deg: float,
) -> np.ndarray:
    """Vetor unitário apontando do ponto para o Sol."""
    azimuth = math.radians(azimuth_deg)
    elevation = math.radians(elevation_deg)

    east = math.cos(elevation) * math.sin(azimuth)
    north = math.cos(elevation) * math.cos(azimuth)
    up = math.sin(elevation)

    vector = np.array([east, north, up], dtype=float)
    norm = np.linalg.norm(vector)
    return vector / norm


def shadow_direction_enu(
    azimuth_deg: float,
    elevation_deg: float,
) -> np.ndarray:
    """Vetor horizontal/descendente na direção oposta ao Sol."""
    if elevation_deg <= 0:
        raise ValueError("Não existe sombra solar útil com o Sol abaixo do horizonte.")

    return -sun_vector_enu(azimuth_deg, elevation_deg)
```

## 16. Interseção da sombra com um plano horizontal

Para uma primeira versão, o plano horizontal local pode representar o solo ou uma laje-base. O ponto da sombra é obtido pela interseção do raio que sai do topo do obstáculo com `z = plano_z`.

Criar `solar_engine/shadow_geometry.py`:

```python
from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from shapely.geometry import Polygon

from .vectors import shadow_direction_enu


@dataclass(frozen=True)
class ShadowProjection:
    polygon_enu: list[tuple[float, float]]
    source_id: str
    solar_azimuth_deg: float
    solar_elevation_deg: float


def ray_to_horizontal_plane(
    origin_enu: np.ndarray,
    direction_enu: np.ndarray,
    plane_z: float,
) -> np.ndarray | None:
    """Calcula a interseção do raio com z = plane_z."""
    dz = direction_enu[2]
    if abs(dz) < 1e-12:
        return None

    t = (plane_z - origin_enu[2]) / dz
    if t < 0:
        return None

    return origin_enu + t * direction_enu


def project_polygon_shadow_to_horizontal(
    polygon_xy: list[tuple[float, float]],
    base_height_m: float,
    top_height_m: float,
    plane_z: float,
    solar_azimuth_deg: float,
    solar_elevation_deg: float,
    source_id: str,
) -> ShadowProjection | None:
    """Projeta os vértices superiores de um obstáculo no plano horizontal."""
    direction = shadow_direction_enu(
        azimuth_deg=solar_azimuth_deg,
        elevation_deg=solar_elevation_deg,
    )

    projected: list[tuple[float, float]] = []
    for x, y in polygon_xy:
        origin = np.array([x, y, top_height_m], dtype=float)
        intersection = ray_to_horizontal_plane(origin, direction, plane_z)
        if intersection is None:
            return None
        projected.append((float(intersection[0]), float(intersection[1])))

    return ShadowProjection(
        polygon_enu=projected,
        source_id=source_id,
        solar_azimuth_deg=solar_azimuth_deg,
        solar_elevation_deg=solar_elevation_deg,
    )


def shadow_intersects_module(
    shadow_polygon: list[tuple[float, float]],
    module_polygon: list[tuple[float, float]],
    threshold_percent: float = 1.0,
) -> dict[str, float | bool]:
    """Calcula interseção simples entre sombra e módulo no mesmo plano."""
    shadow = Polygon(shadow_polygon)
    module = Polygon(module_polygon)

    if not shadow.is_valid or not module.is_valid or module.area <= 0:
        return {
            "intersects": False,
            "shadowed_area_percent": 0.0,
        }

    intersection_area = shadow.intersection(module).area
    percent = 100.0 * intersection_area / module.area

    return {
        "intersects": percent >= threshold_percent,
        "shadowed_area_percent": percent,
    }
```

Esse cálculo representa a sombra em um plano horizontal. Para um telhado inclinado, o plano de interseção deve ser substituído pelo plano da água, conforme a seção seguinte.

## 17. Interseção com plano inclinado da água

Uma água pode ser definida por um ponto `p0` e dois vetores de base `u` e `v`. O vetor normal do plano é:

```text
normal = normalize(cross(u, v))
```

Para um raio `r(t) = origem + t × direção`, a interseção com o plano é:

```text
t = dot(p0 - origem, normal) / dot(direção, normal)
```

Criar `solar_engine/inclined_plane.py`:

```python
from __future__ import annotations

import numpy as np


def intersect_ray_with_plane(
    ray_origin: np.ndarray,
    ray_direction: np.ndarray,
    plane_origin: np.ndarray,
    plane_u: np.ndarray,
    plane_v: np.ndarray,
) -> np.ndarray | None:
    """Intersecciona um raio com um plano 3D."""
    normal = np.cross(plane_u, plane_v)
    norm = np.linalg.norm(normal)
    if norm < 1e-12:
        raise ValueError("Os vetores do plano são colineares.")
    normal = normal / norm

    denominator = float(np.dot(ray_direction, normal))
    if abs(denominator) < 1e-12:
        return None

    t = float(np.dot(plane_origin - ray_origin, normal) / denominator)
    if t < 0:
        return None

    return ray_origin + t * ray_direction


def plane_coordinates(
    point: np.ndarray,
    plane_origin: np.ndarray,
    plane_u: np.ndarray,
    plane_v: np.ndarray,
) -> tuple[float, float]:
    """Obtém coordenadas locais aproximadas do ponto no plano."""
    delta = point - plane_origin
    u_norm = plane_u / np.linalg.norm(plane_u)
    v_norm = plane_v / np.linalg.norm(plane_v)
    return float(np.dot(delta, u_norm)), float(np.dot(delta, v_norm))
```

A interseção no plano inclinado permite calcular a sombra sobre a própria água, e não somente sobre o solo. Isso é essencial quando uma água está acima de outra ou quando obstáculos estão em alturas diferentes.

## 18. Motor de simulação temporal

Criar `solar_engine/simulation.py`:

```python
from __future__ import annotations

from dataclasses import dataclass
from datetime import date

import pandas as pd

from .shadow_geometry import project_polygon_shadow_to_horizontal
from .solar_position import calculate_solar_position


@dataclass(frozen=True)
class ShadowSimulationConfig:
    latitude: float
    longitude: float
    timezone: str
    day: date
    time_start: str
    time_end: str
    step_minutes: int
    plane_z: float = 0.0
    threshold_percent: float = 1.0


def simulate_horizontal_shadows(
    config: ShadowSimulationConfig,
    obstacles: list[dict],
    modules: list[dict],
) -> list[dict]:
    """Simula sombra para obstáculos e módulos em plano horizontal."""
    positions = calculate_solar_position(
        latitude=config.latitude,
        longitude=config.longitude,
        timezone_name=config.timezone,
        day=config.day,
        time_start=config.time_start,
        time_end=config.time_end,
        step_minutes=config.step_minutes,
    )

    results: list[dict] = []

    for row in positions.itertuples(index=False):
        if row.elevation <= 0:
            continue

        for obstacle in obstacles:
            if not obstacle.get("casts_shadow", True):
                continue

            shadow = project_polygon_shadow_to_horizontal(
                polygon_xy=obstacle["polygon_local_m"],
                base_height_m=obstacle["base_height_m"],
                top_height_m=obstacle["top_height_m"],
                plane_z=config.plane_z,
                solar_azimuth_deg=float(row.azimuth),
                solar_elevation_deg=float(row.elevation),
                source_id=obstacle["id"],
            )

            if shadow is None:
                continue

            for module in modules:
                # O módulo deve estar no mesmo plano do polígono de sombra nesta versão.
                from .shadow_geometry import shadow_intersects_module

                impact = shadow_intersects_module(
                    shadow_polygon=shadow.polygon_enu,
                    module_polygon=module["polygon_local_m"],
                    threshold_percent=config.threshold_percent,
                )

                results.append({
                    "module_id": module["id"],
                    "obstacle_id": obstacle["id"],
                    "timestamp": row.timestamp.isoformat(),
                    "solar_azimuth_deg": float(row.azimuth),
                    "solar_elevation_deg": float(row.elevation),
                    "shadowed_area_percent": impact["shadowed_area_percent"],
                    "status": (
                        "partial_shadow"
                        if impact["intersects"]
                        else "no_shadow"
                    ),
                })

    return results
```

Para a versão de produção, substituir o cálculo horizontal por uma rotina que faça a interseção no plano da água correspondente a cada módulo.

## 19. Resultado por módulo

```json
{
  "module_shadow_results": [
    {
      "module_id": "module-01",
      "date": "2026-06-21",
      "time_local": "09:00",
      "solar_azimuth_deg": 54.20,
      "solar_elevation_deg": 22.80,
      "shadowed_area_percent": 37.5,
      "shadow_source_ids": [
        "building-neighbor-01"
      ],
      "status": "partial_shadow"
    }
  ]
}
```

Classificação recomendada:

| Status | Critério |
|---|---|
| `no_shadow` | Interseção abaixo do limite configurado |
| `partial_shadow` | Parte do módulo atingida |
| `full_shadow` | Quase toda a área atingida |
| `sun_below_horizon` | Sol abaixo do horizonte |
| `insufficient_data` | Falta altura, localização ou geometria |

## 20. Mapa de frequência de sombra

Além do resultado instante a instante, criar um resumo por módulo:

```json
{
  "module_shadow_summary": {
    "module_id": "module-01",
    "period_start": "2026-01-01",
    "period_end": "2026-12-31",
    "sunlit_hours": 1840.5,
    "partial_shadow_hours": 320.25,
    "full_shadow_hours": 42.75,
    "worst_case": {
      "date": "2026-06-21",
      "time_local": "08:15",
      "shadowed_area_percent": 88.2,
      "source_ids": ["building-neighbor-01"]
    }
  }
}
```

A versão inicial pode calcular apenas cenários de solstícios, equinócios e horários configurados. A análise anual completa deve ser adicionada depois que a geometria básica for validada.

## 21. Exportação visual

A composição sobre a imagem do Google Earth deve conter:

```text
1. imagem original;
2. áreas úteis;
3. módulos;
4. obstáculos;
5. sombra no horário selecionado;
6. seta Norte;
7. data e horário local;
8. azimute e elevação solar;
9. legenda de altura dos obstáculos;
10. aviso de que é uma simulação.
```

Exemplo de metadados da renderização:

```json
{
  "shadow_render": {
    "image_id": "img-001",
    "simulation_id": "simulation-001",
    "date": "2026-06-21",
    "time_local": "09:00",
    "timezone": "America/Sao_Paulo",
    "solar_azimuth_deg": 54.20,
    "solar_elevation_deg": 22.80,
    "north_arrow_visible": true,
    "shadow_source_ids": ["obstaculo-01"],
    "warning": "Simulação geométrica de sombra; validar medidas em vistoria técnica."
  }
}
```

## 22. API interna recomendada

O programa existente pode chamar uma função equivalente a:

```text
simulate_solar_shadows(project_id, simulation_config) -> ShadowSimulationResult
```

Entrada:

```json
{
  "project_id": "project-anapolis-001",
  "simulation_config_id": "simulation-001",
  "roof_plane_ids": ["agua-01", "agua-02"],
  "obstacle_ids": ["obstaculo-01", "building-neighbor-01"],
  "module_layout_id": "layout-001"
}
```

Saída:

```json
{
  "status": "completed",
  "simulation_id": "simulation-001",
  "location": {
    "latitude": -16.328,
    "longitude": -48.953,
    "timezone": "America/Sao_Paulo"
  },
  "samples": 41,
  "module_results_url": "...",
  "shadow_polygons_url": "...",
  "rendered_preview_url": "...",
  "warnings": [],
  "geometry_reference": "local_enu",
  "solar_position_method": "nrel_spa"
}
```

## 23. Testes obrigatórios

Criar os seguintes testes:

```text
1. Anápolis e São Paulo devem produzir posições solares diferentes na mesma data/hora.
2. O aumento da altura de um obstáculo deve aumentar o alcance potencial da sombra.
3. Com o Sol abaixo do horizonte, não deve ser criada sombra solar direta.
4. A sombra deve mudar de direção quando o azimute solar mudar.
5. A mesma geometria deve produzir resultados diferentes em solstício e equinócio.
6. Um módulo fora do polígono de sombra deve retornar no_shadow.
7. Um módulo totalmente coberto deve retornar full_shadow.
8. O layout fotovoltaico não pode ser alterado pelo motor de sombras.
9. A origem ENU deve permanecer vinculada à latitude e longitude do projeto.
10. A imagem final deve manter a seta Norte e a escala georreferenciada.
```

Exemplo de teste:

```python
from datetime import date

from solar_engine.solar_position import calculate_solar_position


def test_latitudes_produce_different_solar_positions():
    anapolis = calculate_solar_position(
        latitude=-16.328,
        longitude=-48.953,
        timezone_name="America/Sao_Paulo",
        day=date(2026, 6, 21),
        time_start="12:00",
        time_end="12:00",
        step_minutes=15,
    )

    sao_paulo = calculate_solar_position(
        latitude=-23.550,
        longitude=-46.633,
        timezone_name="America/Sao_Paulo",
        day=date(2026, 6, 21),
        time_start="12:00",
        time_end="12:00",
        step_minutes=15,
    )

    assert not anapolis.empty
    assert not sao_paulo.empty
    assert float(anapolis.iloc[0]["elevation"]) != float(sao_paulo.iloc[0]["elevation"])
```

## 24. Requisitos de interface

A tela do Pepilene deve permitir:

| Controle | Função |
|---|---|
| Local do projeto | Editar ou confirmar latitude e longitude |
| Fuso horário | Selecionar `America/Sao_Paulo` ou outro fuso correto |
| Norte da imagem | Confirmar Norte verdadeiro e rotação |
| Altura | Informar altura do solo, telhado ou obstáculo |
| Inclinação | Informar inclinação percentual ou ângulo |
| Data | Selecionar data personalizada ou cenário sazonal |
| Horário | Escolher instante ou intervalo |
| Passo | Definir intervalo entre amostras |
| Mostrar sombra | Exibir ou ocultar a sombra projetada |
| Mostrar dados | Exibir azimute, elevação e fonte da sombra |
| Exportar | Gerar imagem, relatório ou dados JSON |

## 25. Limitações e confiabilidade

A simulação deve mostrar a fonte e o nível de confiança de cada entrada. Uma altura digitada manualmente pelo usuário deve ser marcada como `manual`. Uma altura obtida de levantamento deve ser marcada como `surveyed`. Uma altura estimada de imagem ou modelo externo deve ser marcada como `estimated`.

A imagem do Google Earth pode possuir perspectiva, diferenças de data, resolução limitada e deslocamentos cartográficos. Ela deve ser usada como fundo de apresentação e referência espacial, mas o sistema não deve apresentar uma sombra visual como validação estrutural definitiva.

O resultado deve ser identificado como:

```text
Simulação geométrica de trajetória solar e sombras.
Confirmar dimensões, alturas, estrutura e condições locais em vistoria técnica.
```

## 26. Ordem de implementação

```text
1. Cadastrar latitude, longitude e fuso.
2. Registrar Norte verdadeiro e georreferenciamento da imagem.
3. Criar conversão para coordenadas ENU.
4. Cadastrar águas, inclinações e direções de queda.
5. Cadastrar alturas de solo, telhado e obstáculos.
6. Instalar e validar pvlib.
7. Calcular posição solar para datas e horários.
8. Criar vetor solar em ENU.
9. Projetar sombra sobre plano horizontal.
10. Projetar sombra sobre planos inclinados.
11. Intersectar sombras com módulos.
12. Criar resultados por módulo.
13. Criar cenários de solstícios e equinócios.
14. Renderizar sombra na imagem georreferenciada.
15. Criar relatório e exportação.
16. Só depois integrar perdas energéticas avançadas.
```

## 27. Prompt para a IA de desenvolvimento

```text
Implemente no Pepilene um Motor Solar Geográfico separado do motor geométrico.

O sistema deve usar latitude, longitude, fuso horário, Norte verdadeiro, data e hora
para calcular posição solar. Utilize pvlib com o método NREL SPA para obter azimute,
elevação, zênite, nascer, trânsito e pôr do Sol.

Converta os elementos do projeto para coordenadas métricas locais ENU: East, North,
Up. A imagem do Google Earth deve ser mantida como fundo georreferenciado, mas o
cálculo das sombras deve ocorrer no espaço ENU, não diretamente em pixels.

Cada água do telhado deve possuir polígono, altura-base, inclinação percentual,
ângulo, direção de queda e fonte da medição. Cada obstáculo deve possuir polígono,
altura-base, altura total, referência vertical, margem de segurança e indicador
casts_shadow. Cada módulo deve possuir polígono no plano real da água.

Calcule a posição do Sol para qualquer data, horário e localização. Adicione cenários
de solstício de verão, solstício de inverno, equinócio de março e equinócio de setembro.
Permita intervalos de horário e passo configurável.

Para cada instante com Sol acima do horizonte, crie o vetor solar em ENU e projete as
sombras dos obstáculos sobre o plano do solo ou sobre o plano inclinado da água.
Calcule a interseção da sombra com cada módulo e retorne no_shadow, partial_shadow,
full_shadow, sun_below_horizon ou insufficient_data.

Não altere a quantidade, a posição ou a potência dos módulos. O motor solar deve apenas
calcular posição solar, sombra e impacto. Preserve a imagem original, os dados técnicos,
a escala, a seta Norte e os metadados da simulação.

Crie testes que comprovem que Anápolis-GO e São Paulo-SP produzem posições solares
diferentes na mesma data e horário. Registre sempre latitude, longitude, fuso, data,
hora, azimute, elevação, fonte da altura e nível de confiança.

Ao finalizar, informe arquivos alterados, dependências instaladas, comandos de execução,
exemplos JSON, testes realizados e limitações conhecidas.
```

## 28. Referências técnicas

[1]: [NOAA — Solar Position Calculator](https://gml.noaa.gov/grad/solcalc/azel.html)

[2]: [pvlib — Solar Position](https://pvlib-python.readthedocs.io/en/stable/reference/solarposition.html)

[3]: [pvlib — Shading](https://pvlib-python.readthedocs.io/en/stable/reference/effects_on_pv_system_output/shading.html)

[4]: [Google Developers — KML Reference](https://developers.google.com/kml/documentation/kmlreference)

## 29. Critério de conclusão

O motor será considerado funcional quando o Pepilene conseguir receber um projeto georreferenciado, converter suas áreas para ENU, calcular a posição solar em uma data e horário, projetar a sombra de pelo menos um obstáculo, identificar os módulos afetados e renderizar o resultado na imagem com data, hora, azimute, elevação e aviso de simulação.

A versão inicial não precisa realizar uma análise energética anual completa. Primeiro deve demonstrar que a geometria solar e a sombra estão corretas para um conjunto controlado de locais, datas, horários, alturas e inclinações. Depois disso, o sistema poderá evoluir para perdas de irradiância, produção estimada e relatórios de desempenho.
