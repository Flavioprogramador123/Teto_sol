# Resumo — PlanoSol (Teto_sol)

Documento vivo do estado do produto e das mudanças recentes.
Atualizar sempre que houver alteração relevante (junto com `CHANGELOG.md`).

**Última atualização:** 2026-09-08 · **versão:** 0.3.3 (mobile)

---

## O que é

App web (React + Vite + TS) para projetar usina solar sobre captura (Google Earth): calibrar escala, desenhar área útil/restrita, lançar módulos, editar e gerar arquivo carimbado (PNG/PDF).

**Produto irmão (independente):** **PIENG Propostas** (`pieng-propostas`) — orçamento/proposta comercial.  
Deploy e repositório **separados**; vendáveis isolados ou usados juntos via ponte JSON.

Dev: `http://localhost:5173/`  
**Prod:** https://planosol.vercel.app · **versão:** ver TopBar (`vX.Y.Z` = `package.json`)

Bump local:
```bash
npm run bump:patch   # 0.2.0 → 0.2.1
npm run bump:minor   # 0.2.0 → 0.3.0
npm run bump:major   # 0.2.0 → 1.0.0
```
Depois commit/push para a nuvem refletir.
No PIENG Propostas (produção): `NEXT_PUBLIC_TETO_SOL_URL=https://planosol.vercel.app`

**Repos GitHub:** https://github.com/Flavioprogramador123/Teto_sol  
**PIENG Propostas:** https://github.com/Flavioprogramador123/GeradorProposta_OCR · https://pieng-propostas-pieng.vercel.app

---

## Fluxo de etapas

1. **Importar** — imagem / Earth  
2. **Editar** — recorte / ocultar UI  
3. **Calibrar** — escala + rumo (azimute)  
4. **Telhado** — área útil, restrita  
5. **Usina** — lançar / editar módulos  
6. **Sombreamento** (premium / Sol ON) — posição solar e simulação de sombra  
7. **Gerar arquivo** — card / ticket / logo / bússola (mover + tamanho) + etiqueta + PNG/PDF  

---

## Comportamentos importantes (estado atual)

| Tema | Comportamento |
|------|----------------|
| **Inserir bloco** | Arraste retângulo alinhado ao azimute; permanece na ferramenta após lançar; Ctrl+clique seleciona módulo |
| **Editar / Seleção** | Caixa estilo AutoCAD; polígono aceso no grupo; círculo gira o bloco; Delete apaga; clique fora desmarca |
| **Vermelho** | Alerta (fora da área, vão, sombra/obstáculo); módulo **permanece** e **conta** no total |
| **Encaixados** | `quantidade na usina / meta` (inclui vermelhos) |
| **Atualizar usina** | Revalida e **renumera** 1…N (área por área · cima→baixo · direita→esquerda) |
| **Azimute por água** | Card da área / Medir → Usar na água. Ortogonais ao muro (0°/90°/180°/270°): lançamento normal |
| **Inserir diagonal** | Caso especial: escolhe água(s) com o mesmo azimute fora do rumo ortogonal; trava grade em Inserir/Editar/Seleção; ±0,5°/±1° e **Alinhar ao traço**; desmarcar volta ao normal; muro intacto |
| **Catálogo de módulos** | CRUD em Config; `module_catalog.json` (PC) + localStorage/download (nuvem) |
| **Ponte PIENG** | `postMessage` ou **PIENG JSON** — só `ModuleSpec` + etiqueta |
| **Gerar arquivo (passo 7)** | Arraste/redimensione card, ticket, logo e bússola; etiqueta na barra; PNG/PDF; layout no JSON |
| **Rascunho nuvem** | IndexedDB ≤3 neste navegador; **Salvar** baixa `.planosol.json` (local/Drive Desktop) |
| **Fechar polígono** | 1º ponto azul; idle ~2 s → balão «Fecha aqui» (útil / restrita) |
| **Local · Motor solar** | No passo 6 (Sombreamento): lat/lon, rodapé Earth, posição/sombra — separado do carimbo |
| **Módulo Premium (sombreamento)** | Toggle **☀ Sol** na TopBar (`localStorage`). Com Sol ON **e** usina gerada, libera o **passo 6 · Sombreamento**. Ver plano básico/premium abaixo |

---

## Versão Básica vs. Premium (sombreamento) — plano

- **Hoje (teste interno):** um único deploy, um único repo. O módulo de sombra é o **passo 6 · Sombreamento**, atrás do toggle **☀ Sol** na TopBar (`src/lib/premium.ts`, flag `pepilene-premium` em `localStorage`, por máquina). Travado na TopBar a menos que Sol ON **e** já exista usina (passo 5). Ninguém paga nada ainda, só a equipe testa.
- **Quando for pra cliente de verdade:** trocar o toggle manual pelo gate real — branch `premium` + domínio próprio apontado pra essa branch no **mesmo** projeto Vercel (Hobby aceita, é "Git Branch Domain" + env var de Preview por branch; não precisa da feature paga "Custom Environments"). Básico continua em `main` / domínio principal. Como é a mesma base de código, correção em `main` reflete nas duas.
- **Bloqueios a resolver antes disso valer no ar:**
  1. `solar_engine` (Python) só roda hoje via plugin do Vite (`configureServer`, dev-only) — não existe no build do Vercel. Precisa virar função serverless (ou reescrito) antes do sombreamento funcionar em produção. (**Local/dev já funciona desde 2026-09-08** com `.venv` + `requirements-solar.txt`.)
  2. Cobrar de cliente é uso comercial; plano Hobby da Vercel é só pessoal/não-comercial — validar/menor migrar pra Pro quando isso for pra frente.
- Arquivos envolvidos: `src/lib/premium.ts`, `src/components/TopBar.tsx` (STEPS + trava + botão Sol), `src/state/ProjectContext.tsx` (`setStep` + fallback de restauração), `src/components/Sidebar.tsx` (painel do passo 6 + «Ir para sombreamento»), `src/types.ts` (`Step`), `solar_engine/*`, `plugins/solar.ts`.
- **Setup local (máquina nova):**
```bash
python -m venv .venv
.venv/Scripts/python.exe -m pip install --upgrade pip
.venv/Scripts/python.exe -m pip install -r requirements-solar.txt
```
  Conferir: `.venv/Scripts/python.exe -m solar_engine.selfcheck` e, com `npm run dev`, as rotas `/api/solar/scenarios|position|simulate` com `"ok": true`.

---

## Catálogo ERP (projeção 2D)

| W | Marca | mm |
|---|--------|-----|
| 600 | ZNSHINE | 2278 × 1134 × 30 |
| 625 | RENEPV | 2382 × 1134 × 30 |
| 630 | TSUN | 2382 × 1134 × 30 |
| 670 | RENEPV | 2384 × 1303 × 33 |
| 680 | RENEPV | 2384 × 1303 × 33 |
| 700 | RENEPV | 2384 × 1303 × 33 |

O Gerador pode realimentar este JSON de vez em quando (espelho: `tetoModuleCatalog.json` no PIENG Propostas).

---

## Persistência

- Autosave / Salvar grava projeto (inclui `etiqueta`, `georef`, layout, módulos).
- Etiqueta: marca PIENG (empresa/slogan) permanece; cliente/endereço/bairro/cidade/data/responsável vazios → `null` no JSON.
- Novo projeto / nova imagem: etiqueta de cliente limpa.

---

## Arquivos-chave

- `module_catalog.json` — fichas de módulo (marca/modelo/W/dims)  
- `src/lib/moduleCatalog.ts` — leitura do catálogo  
- `src/lib/piengBridge.ts` — receptor da ponte PIENG  
- `src/components/CanvasBoard.tsx` — mapa, lançamento, seleção  
- `src/state/ProjectContext.tsx` — estado, calcular, etiqueta, persistência, `applyPiengBridge`  
- `src/engine/launch.ts` — packing, numeração (`sortModulesReadingOrder`)  
- `src/engine/layout.ts` — `validatePlacement`  
- `src/engine/geometry.ts` — colisão / vão  
- `src/components/StampExport.tsx` + `src/engine/stampExport.ts` — carimbo  
- `src/types.ts` — `Etiqueta`, `ModuleSpec`, hydrate/serialize  
- `src/lib/premium.ts` — flag temporária do módulo Premium (toggle **☀ Sol** na TopBar)  
- `requirements-solar.txt` — deps Python do motor de sombreamento (`pvlib`, `pyproj`, …)  
- `solar_engine/` + `plugins/solar.ts` — motor de sombreamento (passo 6 / Premium); em dev exige `.venv` + `requirements-solar.txt` instalados (ainda não roda no Vercel)  
- `CHANGELOG.md` — histórico detalhado por data  

---

## Integração PIENG Propostas (ponte A)

1. No PIENG: admin **Teto Sol** (abre sozinho) ou botão com JSON (módulo + etiqueta).  
2. Aqui: `postMessage` ou **PIENG JSON**.  
3. Sem merge de código entre repositórios / deploys separados.

## Como manter o resumo

1. Após cada entrega útil, atualize a data no topo.  
2. Ajuste a tabela “Comportamentos importantes” se a regra mudar.  
3. Acrescente 1–5 bullets na seção “Mudanças” (ou substitua pela data nova).  
4. Copie/aplique o detalhe em `CHANGELOG.md`.
