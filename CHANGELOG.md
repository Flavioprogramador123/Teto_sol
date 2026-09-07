# Changelog — PlanoSol / Teto_sol

Todas as mudanças relevantes do app ficam registradas aqui (mais recente em cima).
Formato inspirado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/).

---

## [Unreleased]

### Adicionado
- Config → CRUD do catálogo de módulos: grava `module_catalog.json` no PC; na nuvem persiste no navegador + «Baixar JSON».

### Em andamento
- (vazio)

---

## [0.2.1] — 2026-09-07

### Alterado
- Etapa Importar: caixas mais compactas; botões com texto menor (`img02.png` / `modelo01.png` / `Outro arquivo`).

---

## [0.2.0] — 2026-09-07

### Adicionado
- Versão semver na TopBar (`package.json` → `APP_VERSION`); scripts `bump:patch|minor|major`.
- Ao fechar área útil/restrita: 1º ponto em azul; após ~2 s sem clique, balão «Fecha aqui».

### Corrigido
- **Nuvem (Vercel):** importar figura / img02 / modelo01 sem `/api/persist` (data URL na sessão).

### Alterado
- Carimbo, etiqueta e logo um pouco maiores no PNG/PDF (~24% / ~13,5% / ~20% da largura).

---

## [2026-09-07] — Ponte PIENG Propostas + catálogo ERP

### Adicionado
- **Ponte A** com o app irmão **PIENG Propostas** (`GeradorProposta_OCR` / `pieng-propostas`):
  - `postMessage` `PIENG_TETO_BRIDGE` ao abrir `/?from=pieng`
  - Botão **PIENG JSON** na TopBar (import manual do arquivo baixado pelo Gerador)
  - `src/lib/piengBridge.ts` + `applyPiengBridge` no `ProjectContext`
- Catálogo alinhado ao quadro ERP (1 ficha por potência):

| W | Marca | mm (L×A×esp.) |
|---|--------|----------------|
| 600 | ZNSHINE | 2278 × 1134 × 30 |
| 625 | RENEPV | 2382 × 1134 × 30 |
| 630 | TSUN | 2382 × 1134 × 30 |
| 670 | RENEPV | 2384 × 1303 × 33 |
| 680 | RENEPV | 2384 × 1303 × 33 |
| 700 | RENEPV | 2384 × 1303 × 33 |

- Mantidos legados 400 / 450 / 550 / 575 no JSON (projetos antigos).

### Alterado
- `module_catalog.json` — dims em metros para packing 2D; espessura 30/33 mm conforme ERP.
- Núcleos **independentes**: Teto Sol e PIENG Propostas podem rodar/vender separados; a ponte só troca JSON ocasionalmente.

### Deploy
- Repo GitHub: https://github.com/Flavioprogramador123/Teto_sol (separado de `GeradorProposta_OCR` / `pieng-propostas`).
- Vercel projeto **`planosol`** (time `pieng`): **https://planosol.vercel.app**
- No PIENG: `NEXT_PUBLIC_TETO_SOL_URL=https://planosol.vercel.app`

---

## [2026-09-07] — Usina, carimbo e seleção

### Corrigido
- **Sobreposição de módulos** com azimute: occupied no packing usa polígono rotacionado; pós-filtro rejeita colisão; limpeza só no calcular (não ao clicar módulo).
- **Inserir bloco** “morto” com telhado cheio: clique em módulo virava seleção; agora o arraste sempre lança; Ctrl+clique seleciona.
- **Inserir bloco** não troca mais sozinho para Editar após o primeiro lançamento.
- **Caixa de seleção AutoCAD** no Editar/Seleção (arraste + Delete); removido o fluxo Grupo → pontos → Fechar polígono.
- **Retângulo de lançamento** alinhado ao desvio de azimute.
- **KPI Encaixados / etiqueta**: conta todos os módulos na usina (inclui vermelhos forçados); antes só os válidos.
- **Carimbo**: formulário manual restaurado (sem botão “Ler rodapé Earth” travado); bairro/cidade alinhados no CSS.
- **Etiqueta no JSON**: cliente/endereço etc. gravados no projeto; campos vazios → `null`; novo projeto limpa dados do cliente.
- **Falso positivo de validação** na borda/vão relaxado; vermelho por sombra de obstáculo permanece correto.

### Adicionado
- **Atualizar usina** renumera módulos 1…N na sequência do telhado (linha a linha no rumo do azimute).
- Aviso no Resultado quando há módulo(s) em alerta (vermelho) que ainda contam no total.
- Motivo do vermelho no card do módulo selecionado.
- Catálogo de módulos em `module_catalog.json`; seletor na etapa Usina.

### Alterado
- Ferramenta **Grupo** renomeada/uso como **Seleção** (mesma caixa de arraste do Editar).
- `refreshValidity` só revalida (marca vermelho); não apaga módulos.
- Reverse geocode atualiza `georef`, não sobrescreve a etiqueta do carimbo.
- Carimbo «Projeção», etiqueta e logo PIENG menores no PNG/PDF; logo com fundo transparente.
