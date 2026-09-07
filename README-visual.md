# Pepilene — módulo visual

O motor geométrico continua no app React. O Python só melhora a imagem e reaplica o layout já calculado.

## Ambiente

O projeto usa um venv local em `.venv`. Não instale pacotes no Python global.

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -r requirements-visual.txt
```

Validar:

```powershell
.\.venv\Scripts\python.exe -c "from PIL import Image; import cv2; import numpy; import shapely; print('Dependências visuais OK')"
```

## Testes

```powershell
.\.venv\Scripts\python.exe -m pytest tests -q
.\.venv\Scripts\python.exe -m compileall visual_engine
```

## API local (opcional)

```powershell
.\.venv\Scripts\python.exe -m uvicorn visual_engine.api:app --host 127.0.0.1 --port 8010
```

O app Vite chama o mesmo motor por `POST /api/visualizations` (plugin interno). Se o Python falhar, a imagem original e o layout técnico permanecem.

## Pastas

```text
storage/original
storage/enhanced
storage/overlays
storage/previews
```

A imagem original nunca é sobrescrita.
