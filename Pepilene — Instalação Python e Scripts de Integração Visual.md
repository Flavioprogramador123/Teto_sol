# Pepilene — Instalação Python e Scripts de Integração Visual

## 1. Objetivo

Este documento complementa o arquivo `pepilene_melhoria_imagem_integracao.md`. Ele orienta a IA de desenvolvimento sobre quais dependências Python instalar, como organizar o módulo visual e quais scripts-base podem ser utilizados para melhorar a imagem do telhado e reaplicar o layout dos módulos.

A implementação deve ser incorporada ao Pepilene existente. Os exemplos abaixo são uma base inicial e precisam ser adaptados à estrutura real do projeto, aos nomes das entidades e à tecnologia já utilizada.

> **A melhoria visual deve ser opcional. Se o processamento falhar, o Pepilene deve continuar exibindo a imagem original e o layout técnico.**

## 2. Arquitetura recomendada

O Python deve funcionar como um módulo de processamento visual, não como substituto do motor geométrico. A separação recomendada é:

```text
Pepilene existente
    ↓
Serviço de visualização
    ↓
Python: preparação, máscara, melhoria e composição
    ↓
Imagem aprimorada + overlays técnicos
```

Se o programa atual já for Python, o módulo pode ser incorporado diretamente. Se o programa atual for React, Node.js, PHP ou outra tecnologia, o Python deverá funcionar como serviço interno ou worker acessado por API.

## 3. Dependências Python

### 3.1 Dependências mínimas

Para a primeira versão, instalar:

| Pacote | Função |
|---|---|
| `Pillow` | Abrir, salvar, redimensionar e compor imagens |
| `numpy` | Manipulação de matrizes e máscaras |
| `opencv-python-headless` | Filtros, nitidez, contraste e operações tradicionais de imagem |
| `shapely` | Validação de polígonos, interseções e geometria dos overlays |
| `pydantic` | Validação dos dados de entrada e saída |
| `python-multipart` | Upload de imagens em endpoints HTTP |
| `FastAPI` | API opcional para integrar o módulo ao Pepilene |
| `uvicorn` | Servidor local para executar a API |

O pacote `opencv-python-headless` é preferível em servidores porque não exige componentes gráficos. Em ambiente desktop, pode-se usar `opencv-python` no lugar dele, mas não é necessário instalar os dois.

### 3.2 Arquivo `requirements-visual.txt`

Criar este arquivo na raiz do módulo Python:

```txt
Pillow>=10.0,<13.0
numpy>=1.26,<3.0
opencv-python-headless>=4.8,<5.0
shapely>=2.0,<3.0
pydantic>=2.0,<3.0
python-multipart>=0.0.9,<1.0
fastapi>=0.110,<1.0
uvicorn[standard]>=0.29,<1.0
```

As versões devem ser ajustadas às versões já utilizadas pelo Pepilene. A IA de desenvolvimento deve verificar primeiro se o projeto possui um `requirements.txt`, `pyproject.toml`, `poetry.lock` ou outro gerenciador de dependências. Não criar conflitos instalando versões incompatíveis sem revisar o ambiente atual.

### 3.3 Dependências opcionais

Se o programa precisar fazer leitura automática de textos na imagem, adicionar OCR somente quando essa função for realmente necessária:

```txt
pytesseract>=0.3.10,<1.0
```

Nesse caso, o executável do Tesseract também deverá ser instalado no sistema operacional. OCR não deve ser obrigatório para a primeira versão do layout, porque escala e geometria devem ser confirmadas pelo projetista.

Se for utilizado um provedor externo de geração ou edição visual, a integração deve ficar atrás de uma interface opcional. Não incluir chaves de API no código, no `requirements` ou no repositório. As credenciais devem ser carregadas por variáveis de ambiente ou pelo mecanismo de configuração já existente no Pepilene.

## 4. Instalação local

Executar os comandos a partir da pasta do módulo visual:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements-visual.txt
```

No Windows, a ativação equivalente é:

```powershell
.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements-visual.txt
```

Validar a instalação com:

```bash
python -c "from PIL import Image; import cv2; import numpy; import shapely; print('Dependências visuais OK')"
```

Se a aplicação existente já tiver ambiente virtual, utilizar o ambiente do projeto em vez de criar outro. A IA deverá registrar no README qual ambiente foi usado para executar os scripts.

## 5. Estrutura de pastas sugerida

```text
pepilene/
├── app/
│   ├── api/
│   ├── models/
│   ├── services/
│   └── ...
├── visual_engine/
│   ├── __init__.py
│   ├── models.py
│   ├── enhance.py
│   ├── geometry.py
│   ├── compositor.py
│   ├── service.py
│   └── api.py
├── storage/
│   ├── original/
│   ├── enhanced/
│   ├── overlays/
│   └── previews/
├── tests/
│   ├── test_enhance.py
│   ├── test_compositor.py
│   └── test_geometry_preservation.py
├── requirements-visual.txt
└── README-visual.md
```

Se o Pepilene possuir uma estrutura diferente, manter a organização atual e apenas separar responsabilidades equivalentes. A pasta `visual_engine` é uma sugestão de isolamento, não uma exigência de nomenclatura.

## 6. Modelo de dados Python

Criar `visual_engine/models.py`:

```python
from __future__ import annotations

from typing import Literal
from pydantic import BaseModel, Field

VisualMode = Literal["technical", "presentation", "photorealistic"]


class Point(BaseModel):
    x: float
    y: float


class ModuleOverlay(BaseModel):
    id: str
    row: int
    column: int
    polygon_px: list[Point]
    rotation_deg: float = 0.0
    power_w: float = 680.0
    status: str = "valid"


class ObstacleOverlay(BaseModel):
    id: str
    name: str = "Obstáculo"
    polygon_px: list[Point]
    visible: bool = True


class VisualizationRequest(BaseModel):
    project_id: str
    source_image_path: str
    output_dir: str
    mode: VisualMode = "presentation"
    modules: list[ModuleOverlay] = Field(default_factory=list)
    obstacles: list[ObstacleOverlay] = Field(default_factory=list)
    show_modules: bool = True
    show_obstacles: bool = True
    show_dimensions: bool = True
    include_warning: bool = True


class VisualizationResult(BaseModel):
    status: Literal["completed", "fallback", "error"]
    source_image_path: str
    enhanced_image_path: str | None = None
    composite_image_path: str | None = None
    technical_image_path: str | None = None
    warnings: list[str] = Field(default_factory=list)
    geometry_preserved: bool = True
    layout_reapplied: bool = True
```

Os nomes dos campos devem ser adaptados aos modelos já existentes. O importante é que a camada visual receba as coordenadas do layout, e não tente recalculá-las.

## 7. Script de melhoria visual básica

Criar `visual_engine/enhance.py`. Este script realiza um tratamento conservador usando Pillow e OpenCV. Ele não gera novos elementos e pode funcionar como fallback quando não houver serviço externo de edição visual.

```python
from __future__ import annotations

from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageEnhance


def enhance_image(
    source_path: str | Path,
    output_path: str | Path,
    mode: str = "presentation",
) -> Path:
    """Melhora a aparência sem modificar a geometria da imagem."""

    source_path = Path(source_path)
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with Image.open(source_path) as source:
        image = source.convert("RGB")

    if mode == "technical":
        contrast = 1.08
        color = 1.02
        sharpness = 1.10
        brightness = 1.02
    elif mode == "photorealistic":
        contrast = 1.12
        color = 1.08
        sharpness = 1.18
        brightness = 1.03
    else:
        contrast = 1.10
        color = 1.06
        sharpness = 1.15
        brightness = 1.03

    image = ImageEnhance.Contrast(image).enhance(contrast)
    image = ImageEnhance.Color(image).enhance(color)
    image = ImageEnhance.Brightness(image).enhance(brightness)
    image = ImageEnhance.Sharpness(image).enhance(sharpness)

    # Redução discreta de ruído, sem alterar a dimensão da imagem.
    array = np.asarray(image)
    denoised = cv2.fastNlMeansDenoisingColored(
        array,
        None,
        h=3,
        hColor=3,
        templateWindowSize=7,
        searchWindowSize=21,
    )

    result = Image.fromarray(cv2.cvtColor(denoised, cv2.COLOR_BGR2RGB))
    result.save(output_path, quality=95)
    return output_path
```

Esse tratamento é deliberadamente conservador. O script não deve preencher telhados, remover obstáculos nem criar aparência estrutural que não esteja na imagem original.

## 8. Script para renderizar os módulos

Criar `visual_engine/compositor.py`. O script abaixo usa os polígonos do layout e desenha os módulos no mesmo sistema de coordenadas da imagem.

```python
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

from .models import ModuleOverlay, ObstacleOverlay


def _points(points):
    return [(round(p.x), round(p.y)) for p in points]


def compose_preview(
    background_path: str | Path,
    output_path: str | Path,
    modules: list[ModuleOverlay],
    obstacles: list[ObstacleOverlay] | None = None,
    show_modules: bool = True,
    show_obstacles: bool = True,
    warning: bool = True,
) -> Path:
    """Compõe a apresentação usando coordenadas já calculadas pelo Pepilene."""

    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    image = Image.open(background_path).convert("RGBA")
    draw = ImageDraw.Draw(image, "RGBA")

    if show_obstacles and obstacles:
        for obstacle in obstacles:
            if obstacle.visible:
                points = _points(obstacle.polygon_px)
                draw.polygon(points, fill=(220, 40, 40, 65), outline=(180, 20, 20, 220), width=3)

    if show_modules:
        for module in modules:
            points = _points(module.polygon_px)
            draw.polygon(points, fill=(20, 115, 210, 125), outline=(5, 35, 80, 235), width=3)

    if warning:
        label = "SIMULAÇÃO VISUAL — layout calculado pelo Pepilene"
        draw.rectangle((20, 20, 570, 56), fill=(0, 0, 0, 150))
        draw.text((30, 30), label, fill=(255, 255, 255, 255))

    image.convert("RGB").save(output_path, quality=95)
    return output_path
```

Na versão final, o desenho dos módulos poderá ser substituído por uma representação mais realista, mas o polígono técnico deve continuar disponível para conferência.

## 9. Serviço de integração

Criar `visual_engine/service.py`:

```python
from __future__ import annotations

from pathlib import Path

from .compositor import compose_preview
from .enhance import enhance_image
from .models import VisualizationRequest, VisualizationResult


def create_visualization(request: VisualizationRequest) -> VisualizationResult:
    output_dir = Path(request.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    source_path = Path(request.source_image_path)
    enhanced_path = output_dir / f"{request.project_id}-enhanced.jpg"
    composite_path = output_dir / f"{request.project_id}-presentation.jpg"
    technical_path = output_dir / f"{request.project_id}-technical.jpg"

    if not source_path.exists():
        return VisualizationResult(
            status="error",
            source_image_path=str(source_path),
            warnings=["Imagem original não encontrada."],
            geometry_preserved=True,
            layout_reapplied=False,
        )

    try:
        enhance_image(source_path, enhanced_path, request.mode)

        compose_preview(
            enhanced_path,
            composite_path,
            modules=request.modules,
            obstacles=request.obstacles,
            show_modules=request.show_modules,
            show_obstacles=request.show_obstacles,
            warning=request.include_warning,
        )

        compose_preview(
            source_path,
            technical_path,
            modules=request.modules,
            obstacles=request.obstacles,
            show_modules=True,
            show_obstacles=True,
            warning=False,
        )

        return VisualizationResult(
            status="completed",
            source_image_path=str(source_path),
            enhanced_image_path=str(enhanced_path),
            composite_image_path=str(composite_path),
            technical_image_path=str(technical_path),
            warnings=[],
            geometry_preserved=True,
            layout_reapplied=True,
        )

    except Exception as exc:
        # Fallback seguro: o projeto não pode ficar sem visualização técnica.
        fallback_path = output_dir / f"{request.project_id}-fallback.jpg"
        compose_preview(
            source_path,
            fallback_path,
            modules=request.modules,
            obstacles=request.obstacles,
            show_modules=True,
            show_obstacles=True,
            warning=True,
        )

        return VisualizationResult(
            status="fallback",
            source_image_path=str(source_path),
            composite_image_path=str(fallback_path),
            warnings=[f"Melhoria visual indisponível: {exc}"],
            geometry_preserved=True,
            layout_reapplied=True,
        )
```

## 10. Endpoint opcional com FastAPI

Se o Pepilene atual utilizar uma API, criar um endpoint equivalente em `visual_engine/api.py`. O endpoint real deve usar autenticação, autorização e armazenamento já existentes no programa.

```python
from fastapi import FastAPI, HTTPException

from .models import VisualizationRequest, VisualizationResult
from .service import create_visualization

app = FastAPI(title="Pepilene Visual Engine")


@app.post("/visualizations", response_model=VisualizationResult)
def generate_visualization(request: VisualizationRequest):
    try:
        return create_visualization(request)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
```

Executar localmente apenas para teste:

```bash
uvicorn visual_engine.api:app --reload --host 127.0.0.1 --port 8010
```

Em produção, não expor esse serviço sem autenticação e sem validar os caminhos dos arquivos. O usuário do sistema não deve conseguir solicitar leitura de arquivos arbitrários do servidor.

## 11. Integração com o programa atual

A IA de desenvolvimento deverá adaptar a chamada ao fluxo existente. Um exemplo genérico seria:

```python
request = VisualizationRequest(
    project_id=project.id,
    source_image_path=project.original_image_path,
    output_dir=project.visualization_directory,
    mode="presentation",
    modules=load_modules_from_existing_layout(project.layout_id),
    obstacles=load_obstacles(project.id),
    show_modules=True,
    show_obstacles=True,
    show_dimensions=True,
)

result = create_visualization(request)

save_visualization_result(project.id, result)
```

Se o frontend for React ou outra aplicação web, ele deverá chamar a API e exibir `composite_image_path`, `technical_image_path` e `source_image_path` de acordo com o modo escolhido.

## 12. Teste de preservação geométrica

Criar `tests/test_geometry_preservation.py`:

```python
from pathlib import Path

from PIL import Image

from visual_engine.compositor import compose_preview
from visual_engine.models import ModuleOverlay, Point


def test_overlay_preserves_module_coordinates(tmp_path: Path):
    source = tmp_path / "source.png"
    output = tmp_path / "output.png"

    Image.new("RGB", (800, 600), "white").save(source)

    module = ModuleOverlay(
        id="module-01",
        row=1,
        column=1,
        polygon_px=[
            Point(x=100, y=100),
            Point(x=300, y=100),
            Point(x=300, y=220),
            Point(x=100, y=220),
        ],
        rotation_deg=0,
        power_w=680,
    )

    compose_preview(source, output, [module])

    assert output.exists()
    assert module.polygon_px[0].x == 100
    assert module.polygon_px[0].y == 100
    assert module.power_w == 680
```

O teste deve ser ampliado para comparar todos os módulos antes e depois do processamento. A alteração permitida é nos pixels da imagem de fundo; não é permitida alteração nos dados do layout.

## 13. Comandos de teste

```bash
python -m pytest tests/test_geometry_preservation.py -q
python -m compileall visual_engine
python -m uvicorn visual_engine.api:app --host 127.0.0.1 --port 8010
```

Se `pytest` ainda não estiver instalado no ambiente de desenvolvimento, adicionar apenas para testes:

```bash
python -m pip install pytest
```

O pacote de testes não precisa ser instalado no ambiente de produção se o projeto possuir etapas separadas de desenvolvimento e deploy.

## 14. Cuidados de segurança e operação

Não armazenar chaves de API em scripts. Não aceitar caminhos de arquivos fornecidos diretamente pelo usuário sem validação. Limitar o tamanho e os formatos de imagem recebidos. Manter a imagem original somente nos armazenamentos autorizados pelo sistema existente.

Os arquivos de saída devem receber nomes vinculados ao projeto e à versão da visualização. Nunca sobrescrever a imagem original. Quando o layout mudar, marcar a composição antiga como desatualizada.

O módulo visual também deve registrar logs suficientes para descobrir se a falha ocorreu na abertura da imagem, na melhoria, na composição, no armazenamento ou na chamada da API.

## 15. Resultado esperado

Ao terminar, o Pepilene deverá permitir o seguinte fluxo:

```text
1. Importar imagem do telhado.
2. Calibrar escala e desenhar áreas úteis.
3. Cadastrar obstáculos.
4. Calcular os módulos pelo motor geométrico.
5. Clicar em Melhorar apresentação.
6. Selecionar modo técnico ou apresentação.
7. Gerar imagem aprimorada sem alterar o layout.
8. Comparar original, técnico e comercial.
9. Exportar a composição com quantidade, potência e aviso de simulação.
```

Para os 18 módulos de 680 W, a potência exibida deve ser calculada pelo próprio sistema como 12,24 kWp. Nenhum número técnico deve ser inventado pelo módulo visual.

## 16. Prompt final para a IA de desenvolvimento

```text
Adicione ao Pepilene existente um módulo Python de melhoria visual de imagens de telhado.
Antes de alterar o código, inspecione o projeto e reutilize sua arquitetura, seus modelos,
seu armazenamento e seu sistema de autenticação.

Instale somente as dependências necessárias: Pillow, NumPy, OpenCV, Shapely, Pydantic e,
se o projeto precisar de API, FastAPI, Uvicorn e python-multipart. Verifique primeiro as
versões já instaladas para evitar conflitos.

Separe imagem original, imagem aprimorada, overlays e composição final. A IA visual deve
melhorar iluminação, contraste, cores, nitidez e ruído, mas não pode inventar, remover ou
mover telhados, paredes, obstáculos, cotas ou módulos.

Os módulos devem ser desenhados pelo Pepilene usando as coordenadas do layout já calculado.
Crie fallback para a imagem original caso qualquer processamento falhe. Adicione testes para
provar que quantidade, posição, rotação, potência e identificadores dos módulos permanecem
iguais antes e depois da melhoria.

Integre a funcionalidade à tela e ao fluxo já existentes. Não crie um segundo aplicativo.
Ao finalizar, informe os arquivos alterados, os comandos de instalação, os comandos de execução,
os testes realizados e qualquer adaptação necessária por causa da arquitetura atual.
```

## 17. Limite deste documento

Os scripts fornecidos são uma base funcional e segura para iniciar a integração, mas os caminhos, modelos, armazenamento, autenticação e nomes de rotas precisam ser ajustados depois que o código real do Pepilene estiver disponível. Sem o repositório ou os arquivos atuais, não é possível indicar quais arquivos existentes devem ser editados com precisão.
