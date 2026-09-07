# Pepilene — Plano Inclinado, Projeção 2D, Scripts Python e JSON

## Conclusão rápida

**A preocupação está correta:** uma projeção plana em 2D não representa exatamente a superfície real de um telhado inclinado. Porém, os percentuais precisam ser tratados como **referências iniciais**, não como regras universais para cada tipo de telha.

A Eternit informa que suas telhas de fibrocimento podem ter inclinação mínima variando de **5° a 15°**, aproximadamente **9% a 27%**, dependendo do modelo. A Multilit também confirma que a inclinação mínima do fibrocimento varia conforme o produto, citando exemplos de **9%, 18% e 27%**. Portanto, **10% para fibrocimento é plausível para alguns modelos**, mas a IA deve exigir a ficha técnica da telha específica antes de considerar o valor definitivo [1] [2].

Para telha cerâmica ou de concreto, **20% não deve ser usado automaticamente como padrão**. Há modelos que trabalham com aproximadamente 30% ou mais. A Eternit, por exemplo, informa **30% como inclinação mínima para sua telha de concreto EternitMax** [1]. Em referências de telhas cerâmicas, valores de 30% a 35% aparecem com frequência, mas a inclinação correta depende do modelo, do comprimento da água, do encaixe, da sobreposição e das recomendações do fabricante.

## Conversão correta entre porcentagem e graus

É importante não confundir **30% de inclinação** com **30 graus**.

| Inclinação | Ângulo aproximado | Desnível a cada 1 m horizontal | Fator de comprimento sobre a água |
|---:|---:|---:|---:|
| 10% | 5,71° | 10 cm | 1,005 |
| 20% | 11,31° | 20 cm | 1,020 |
| 30% | 16,70° | 30 cm | 1,044 |

A fórmula é:

```text
inclinação_percentual = 100 × altura_vertical / distância_horizontal
ângulo = arctan(inclinação_percentual / 100)
comprimento_real_da_água = comprimento_horizontal / cos(ângulo)
```

Assim, em uma água com 30% de inclinação, o comprimento real sobre o telhado é aproximadamente **4,4% maior** que sua projeção horizontal. A diferença não é enorme, mas precisa ser incorporada quando o programa calcula o encaixe, as dimensões e a visualização dos módulos.

## Como adaptar o Pepilene

O Pepilene deve deixar de tratar cada telhado apenas como uma imagem plana. Cada água precisa possuir um **plano inclinado próprio**, com inclinação e direção de queda.

O cadastro da água deve passar a incluir:

```json
{
  "roof_plane": {
    "id": "agua-01",
    "slope_percent": 30.0,
    "slope_angle_deg": 16.699,
    "fall_direction_deg": 90.0,
    "material": "fibrocimento",
    "slope_source": "manual",
    "slope_confidence": "confirmed"
  }
}
```

O campo `material` não deve determinar sozinho a inclinação. Ele serve apenas como referência e sugestão inicial. O valor final deve vir de medição, projeto, ficha técnica ou confirmação do usuário.

## 1. Separar dois sistemas de coordenadas

O motor deve trabalhar com duas representações:

```text
Plano real da água inclinada
    ↓
Layout técnico dos módulos
    ↓
Projeção horizontal ou projeção na imagem
    ↓
Renderização visual
```

No **plano real**, o módulo conserva suas dimensões verdadeiras, por exemplo, largura e comprimento informados na ficha técnica. É nesse plano que o motor deve verificar bordas, afastamentos e obstáculos.

Na **projeção 2D**, o módulo será visualizado com uma deformação correspondente à inclinação. Se a dimensão do módulo estiver alinhada com a direção de queda, sua projeção horizontal será:

```text
comprimento_projetado = comprimento_real × cos(ângulo)
```

A dimensão transversal à queda permanece praticamente igual em uma projeção ortogonal simples. Para 30% de inclinação, a dimensão alinhada com a queda aparece aproximadamente **4,2% menor** na projeção horizontal, porque `cos(16,70°) ≈ 0,958`.

## 2. Não corrigir apenas aumentando ou diminuindo a imagem inteira

A IA não deve aplicar um simples `scaleX` ou `scaleY` em toda a imagem sem saber a direção de queda. Isso deformaria paredes, obstáculos e áreas que não pertencem ao plano do telhado.

A correção deve ser aplicada somente à geometria da água inclinada. Em imagem aérea ou planta ortogonal, pode-se usar uma transformação específica na direção da queda. Em imagem oblíqua ou perspectiva, o correto é usar uma **homografia**, calibrada com pontos correspondentes do plano do telhado.

A homografia deve ser usada quando houver quatro ou mais pontos de referência na mesma água, por exemplo:

```text
canto superior esquerdo
canto superior direito
canto inferior direito
canto inferior esquerdo
```

A imagem original, a máscara do telhado e os overlays precisam usar a mesma transformação. Caso contrário, os módulos ficarão desalinhados visualmente mesmo que o cálculo geométrico esteja correto.

## 3. Fórmula simplificada para uma água regular

Para uma primeira versão, quando a água for retangular e a direção da queda estiver claramente definida, usar:

```python
import math


def slope_to_angle(slope_percent: float) -> float:
    return math.atan(slope_percent / 100.0)


def surface_length_from_plan(plan_length_m: float, slope_percent: float) -> float:
    angle = slope_to_angle(slope_percent)
    return plan_length_m / math.cos(angle)


def projected_length_from_surface(surface_length_m: float, slope_percent: float) -> float:
    angle = slope_to_angle(slope_percent)
    return surface_length_m * math.cos(angle)
```

O cálculo deve ser usado apenas para uma água plana e com queda uniforme. Para águas quebradas, mansardas, telhados com várias inclinações ou imagens em perspectiva, o Pepilene deve trabalhar com planos independentes e transformação projetiva.

## 4. Regra para o encaixe dos módulos

O encaixe deve ocorrer no plano real da água, e não diretamente na imagem em pixels.

```text
1. Criar o polígono da água em coordenadas do plano.
2. Informar inclinação e direção de queda.
3. Aplicar margem de segurança no plano real.
4. Inserir o módulo com suas dimensões verdadeiras.
5. Testar obstáculos no mesmo plano.
6. Validar sobreposição e afastamentos.
7. Projetar o layout aprovado para a imagem.
8. Renderizar o módulo seguindo a perspectiva da água.
```

Dessa forma, o programa não confunde uma distância de 1,00 m medida na imagem com uma distância de 1,00 m medida sobre a cobertura.

## 5. Modelos JSON completos

### 5.1 Plano inclinado da água

```json
{
  "roof_plane": {
    "id": "agua-01",
    "name": "Água frontal",
    "slope_percent": 30.0,
    "slope_angle_deg": 16.69924423399362,
    "fall_direction_deg": 90.0,
    "material": "fibrocimento",
    "tile_model": "não informado",
    "slope_source": "manual",
    "slope_confidence": "confirmed",
    "plan_polygon_m": [
      [0.0, 0.0],
      [12.0, 0.0],
      [12.0, 8.0],
      [0.0, 8.0]
    ],
    "surface_polygon_m": [
      [0.0, 0.0],
      [12.0, 0.0],
      [12.0, 8.348028],
      [0.0, 8.348028]
    ],
    "projection_mode": "orthographic",
    "homography": null
  }
}
```

### 5.2 Módulo fotovoltaico

```json
{
  "module": {
    "brand": "RENEPV",
    "model": "680W",
    "power_w": 680,
    "width_m": 1.303,
    "height_m": 2.384,
    "gap_m": 0.020,
    "rotation_allowed": true,
    "dimensions_reference": "surface_plane",
    "projection_rule": "apply_roof_plane_transform"
  }
}
```

As dimensões devem ser substituídas pelas medidas oficiais do modelo exato do módulo. O campo `dimensions_reference` informa que as dimensões pertencem ao plano real do módulo, e não à projeção horizontal.

### 5.3 Módulos após o cálculo

```json
{
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
        "polygon_plan_m": [
          [0.50, 0.50],
          [1.803, 0.50],
          [1.803, 2.782],
          [0.50, 2.782]
        ],
        "polygon_px": [
          [120, 180],
          [260, 180],
          [260, 420],
          [120, 420]
        ],
        "rotation_deg": 0.0,
        "power_w": 680,
        "status": "valid"
      }
    ]
  }
}
```

O array `polygon_surface_m` representa o módulo no plano real da cobertura. O array `polygon_plan_m` representa sua projeção horizontal simplificada. O array `polygon_px` representa sua posição final na imagem, depois da transformação de projeção.

### 5.4 Obstáculo

```json
{
  "obstacle": {
    "id": "obstaculo-01",
    "name": "Caixa d'água",
    "type": "water_tank",
    "roof_plane_id": "agua-01",
    "polygon_surface_m": [
      [4.00, 3.00],
      [5.50, 3.00],
      [5.50, 4.50],
      [4.00, 4.50]
    ],
    "safety_margin_m": 0.80,
    "excluded": true
  }
}
```

O obstáculo deve ser convertido para o mesmo sistema de coordenadas do plano dos módulos antes do teste de interseção.

### 5.5 Visualização

```json
{
  "visualization": {
    "id": "viz-001",
    "source_image_id": "img-001",
    "roof_plane_id": "agua-01",
    "layout_id": "layout-001",
    "mode": "presentation",
    "projection_mode": "orthographic",
    "enhanced_image_url": "...",
    "technical_overlay_url": "...",
    "module_overlay_url": "...",
    "composite_preview_url": "...",
    "geometry_preserved": true,
    "layout_reapplied": true,
    "warnings": []
  }
}
```

## 6. Scripts Python

### 6.1 Conversão de inclinação e projeção

Criar `visual_engine/roof_geometry.py`:

```python
from __future__ import annotations

import math
from dataclasses import dataclass


@dataclass(frozen=True)
class RoofSlope:
    slope_percent: float

    @property
    def angle_rad(self) -> float:
        return math.atan(self.slope_percent / 100.0)

    @property
    def angle_deg(self) -> float:
        return math.degrees(self.angle_rad)

    @property
    def cos_angle(self) -> float:
        return math.cos(self.angle_rad)

    @property
    def surface_factor(self) -> float:
        return 1.0 / self.cos_angle


def slope_to_angle(slope_percent: float) -> float:
    """Converte inclinação percentual para ângulo em radianos."""
    if slope_percent < 0:
        raise ValueError("A inclinação não pode ser negativa nesta versão.")
    return math.atan(slope_percent / 100.0)


def slope_to_degrees(slope_percent: float) -> float:
    return math.degrees(slope_to_angle(slope_percent))


def surface_length_from_plan(
    plan_length_m: float,
    slope_percent: float,
) -> float:
    """Retorna o comprimento real sobre a água inclinada."""
    if plan_length_m < 0:
        raise ValueError("O comprimento em planta não pode ser negativo.")
    angle = slope_to_angle(slope_percent)
    return plan_length_m / math.cos(angle)


def projected_length_from_surface(
    surface_length_m: float,
    slope_percent: float,
) -> float:
    """Retorna a projeção horizontal de uma dimensão sobre a queda."""
    if surface_length_m < 0:
        raise ValueError("O comprimento real não pode ser negativo.")
    angle = slope_to_angle(slope_percent)
    return surface_length_m * math.cos(angle)


def roof_plane_summary(slope_percent: float) -> dict[str, float]:
    slope = RoofSlope(slope_percent)
    return {
        "slope_percent": slope.slope_percent,
        "slope_angle_deg": slope.angle_deg,
        "cos_angle": slope.cos_angle,
        "surface_factor": slope.surface_factor,
    }


if __name__ == "__main__":
    for percent in (10.0, 20.0, 30.0):
        print(percent, roof_plane_summary(percent))
```

### 6.2 Transformação simplificada do módulo

Criar `visual_engine/module_projection.py`:

```python
from __future__ import annotations

from dataclasses import dataclass

from .roof_geometry import projected_length_from_surface


@dataclass(frozen=True)
class ModuleDimensions:
    width_m: float
    height_m: float


def project_module_dimensions(
    dimensions: ModuleDimensions,
    slope_percent: float,
    fall_axis: str = "height",
) -> ModuleDimensions:
    """Projeta dimensões para uma planta horizontal simplificada.

    A dimensão alinhada com a direção de queda é reduzida por cos(theta).
    Esta função não substitui homografia para imagens em perspectiva.
    """
    if fall_axis not in {"width", "height"}:
        raise ValueError("fall_axis deve ser 'width' ou 'height'.")

    if fall_axis == "width":
        return ModuleDimensions(
            width_m=projected_length_from_surface(dimensions.width_m, slope_percent),
            height_m=dimensions.height_m,
        )

    return ModuleDimensions(
        width_m=dimensions.width_m,
        height_m=projected_length_from_surface(dimensions.height_m, slope_percent),
    )
```

### 6.3 Validação do plano e dos módulos

Criar `visual_engine/validation.py`:

```python
from __future__ import annotations

from dataclasses import dataclass

from shapely.geometry import Polygon


@dataclass(frozen=True)
class ValidationResult:
    valid: bool
    reason: str | None = None


def validate_module_on_roof(
    roof_polygon_surface: list[tuple[float, float]],
    module_polygon_surface: list[tuple[float, float]],
    obstacle_polygons_surface: list[list[tuple[float, float]]] | None = None,
) -> ValidationResult:
    """Valida o módulo no plano real da água."""
    roof = Polygon(roof_polygon_surface)
    module = Polygon(module_polygon_surface)

    if not roof.is_valid or not module.is_valid:
        return ValidationResult(False, "Geometria inválida.")

    if not roof.covers(module):
        return ValidationResult(False, "Módulo fora da área útil.")

    for obstacle_points in obstacle_polygons_surface or []:
        obstacle = Polygon(obstacle_points)
        if module.intersects(obstacle):
            return ValidationResult(False, "Módulo intercepta obstáculo.")

    return ValidationResult(True)
```

### 6.4 Conversão de pontos do plano para a planta

Criar `visual_engine/plan_projection.py`:

```python
from __future__ import annotations

import math


def project_point_to_plan(
    x_surface_m: float,
    y_surface_m: float,
    slope_percent: float,
    fall_direction_deg: float,
    origin_x_m: float = 0.0,
    origin_y_m: float = 0.0,
) -> tuple[float, float]:
    """Projeta um ponto da superfície para uma planta horizontal.

    x_surface_m é considerado o eixo alinhado à queda antes da rotação.
    """
    theta = math.atan(slope_percent / 100.0)
    x_plan = x_surface_m * math.cos(theta)
    y_plan = y_surface_m

    angle = math.radians(fall_direction_deg)
    x_rotated = x_plan * math.cos(angle) - y_plan * math.sin(angle)
    y_rotated = x_plan * math.sin(angle) + y_plan * math.cos(angle)

    return origin_x_m + x_rotated, origin_y_m + y_rotated
```

### 6.5 Homografia para imagem em perspectiva

Quando a imagem for oblíqua, utilizar uma homografia. Criar `visual_engine/homography.py`:

```python
from __future__ import annotations

from pathlib import Path

import cv2
import numpy as np


def compute_homography(
    source_points: list[tuple[float, float]],
    destination_points: list[tuple[float, float]],
) -> np.ndarray:
    """Calcula transformação entre quatro ou mais pontos correspondentes."""
    if len(source_points) < 4 or len(destination_points) < 4:
        raise ValueError("São necessários pelo menos quatro pontos.")

    source = np.asarray(source_points, dtype=np.float32)
    destination = np.asarray(destination_points, dtype=np.float32)

    matrix, _ = cv2.findHomography(source, destination, method=0)
    if matrix is None:
        raise ValueError("Não foi possível calcular a homografia.")

    return matrix


def transform_polygon(
    polygon_px: list[tuple[float, float]],
    homography: np.ndarray,
) -> list[tuple[float, float]]:
    points = np.asarray([polygon_px], dtype=np.float32)
    transformed = cv2.perspectiveTransform(points, homography)[0]
    return [(float(x), float(y)) for x, y in transformed]


def warp_overlay(
    overlay_path: str | Path,
    output_path: str | Path,
    homography: np.ndarray,
    output_size: tuple[int, int],
) -> Path:
    overlay = cv2.imread(str(overlay_path), cv2.IMREAD_UNCHANGED)
    if overlay is None:
        raise FileNotFoundError(overlay_path)

    warped = cv2.warpPerspective(overlay, homography, output_size)
    cv2.imwrite(str(output_path), warped)
    return Path(output_path)
```

A homografia deve ser usada somente com pontos realmente correspondentes na mesma água do telhado. Não usar uma única homografia para toda a imagem quando existirem águas com inclinações ou perspectivas diferentes.

### 6.6 Exemplo de composição do overlay

Criar `visual_engine/compositor.py`:

```python
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw


def compose_module_overlay(
    background_path: str | Path,
    output_path: str | Path,
    module_polygons_px: list[list[tuple[float, float]]],
    obstacle_polygons_px: list[list[tuple[float, float]]] | None = None,
    show_obstacles: bool = True,
) -> Path:
    image = Image.open(background_path).convert("RGBA")
    draw = ImageDraw.Draw(image, "RGBA")

    if show_obstacles:
        for obstacle in obstacle_polygons_px or []:
            points = [(round(x), round(y)) for x, y in obstacle]
            draw.polygon(
                points,
                fill=(220, 40, 40, 65),
                outline=(180, 20, 20, 220),
                width=3,
            )

    for module in module_polygons_px:
        points = [(round(x), round(y)) for x, y in module]
        draw.polygon(
            points,
            fill=(20, 115, 210, 125),
            outline=(5, 35, 80, 235),
            width=3,
        )

    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    image.convert("RGB").save(output_path, quality=95)
    return output_path
```

## 7. Fluxo completo de implementação

```text
1. Importar a imagem do telhado.
2. Calibrar a escala.
3. Desenhar cada água como um polígono próprio.
4. Informar inclinação percentual e direção de queda.
5. Converter inclinação para graus.
6. Criar coordenadas do plano real inclinado.
7. Cadastrar módulos com dimensões verdadeiras.
8. Cadastrar obstáculos no mesmo plano.
9. Calcular encaixe no plano real.
10. Validar bordas, afastamentos e interseções.
11. Projetar os módulos para planta ou imagem.
12. Aplicar homografia quando houver perspectiva.
13. Renderizar a visualização técnica.
14. Renderizar a visualização comercial.
15. Comparar com a imagem original.
```

## 8. Prompt final para a IA de desenvolvimento

```text
Adapte o Pepilene para diferenciar projeção horizontal 2D de plano real inclinado.
Cada água do telhado deve possuir inclinação percentual, ângulo em graus, direção de
queda e fonte da medição. Não use o tipo de telha para definir automaticamente a
inclinação final; material e modelo devem servir apenas como sugestão inicial.

Converta percentual para ângulo usando angle = atan(slope_percent / 100). Para uma
água plana, o comprimento real sobre a cobertura é plan_length / cos(angle). O layout
dos módulos deve ser calculado no plano real inclinado, com as dimensões verdadeiras
do módulo, margens e obstáculos. Somente depois o layout aprovado deve ser projetado
para a imagem 2D.

Na projeção horizontal, a dimensão do módulo alinhada com a direção de queda deve
ser multiplicada por cos(angle). Em imagens em perspectiva, não aplique uma escala
uniforme na imagem inteira; use uma transformação de plano, preferencialmente uma
homografia calibrada por pontos de referência da água. Preserve paredes, obstáculos,
escala, cotas e áreas que não pertencem ao plano do telhado.

Crie modos de visualização para planta, projeção horizontal e perspectiva inclinada.
O módulo deve informar quando está usando uma aproximação simplificada e quando está
usando uma transformação projetiva calibrada. A inclinação não deve alterar por si só
a potência ou a quantidade de módulos; ela altera a geometria da representação, o
comprimento real da água e os cálculos solares.
```

## 9. Veredito técnico

**10% pode ser uma referência inicial para alguns telhados de fibrocimento; 20% não deve ser assumido como regra geral para telha de barro; 30% é uma referência comum para diversos modelos cerâmicos ou de concreto, mas deve ser confirmado pelo fabricante.**

A adaptação mais importante não é apenas “inclinar a imagem”. É calcular o layout no **plano real da cobertura** e, somente depois, projetar esse layout para a imagem 2D ou para uma visualização em perspectiva.

O sistema deve diferenciar claramente três situações:

```text
planta horizontal
    ↓
projeção ortogonal de uma água inclinada
    ↓
imagem fotográfica em perspectiva
```

Cada situação exige um tratamento geométrico diferente.

## Referências

[1]: [Eternit — Concreto ou fibrocimento: qual a telha ideal para minha obra?](https://www.eternit.com.br/dica-da-coruja-detalhe/concreto-ou-fibrocimento-qual-a-telha-ideal-para-minha-obra)

[2]: [Multilit — Como calcular a inclinação correta do telhado?](https://multilit.com.br/como-calcular-a-inclinacao-correta-do-telhado/)

[3]: [Brasilit — Defina a inclinação correta do telhado para cada tipo de telha](https://www.brasilit.com.br/blog/Definaainclina%C3%A7%C3%A3ocorretadotelhadoparacadatipodetelha)
