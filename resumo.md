# Resumo — PlanoSol (Teto_sol)

Documento vivo do estado do produto e das mudanças recentes.
Atualizar sempre que houver alteração relevante (junto com `CHANGELOG.md`).

**Última atualização:** 2026-09-07 · **versão:** 0.3.0

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
4. **Telhado** — área útil, restrita, local/motor solar  
5. **Usina** — lançar / editar módulos / gerar arquivo  

---

## Comportamentos importantes (estado atual)

| Tema | Comportamento |
|------|----------------|
| **Inserir bloco** | Arraste retângulo alinhado ao azimute; permanece na ferramenta após lançar; Ctrl+clique seleciona módulo |
| **Editar / Seleção** | Caixa estilo AutoCAD → Delete apaga o lote |
| **Vermelho** | Alerta (fora da área, vão, sombra/obstáculo); módulo **permanece** e **conta** no total |
| **Encaixados** | `quantidade na usina / meta` (inclui vermelhos) |
| **Atualizar usina** | Revalida e **renumera** 1…N na sequência do telhado |
| **Catálogo de módulos** | CRUD em Config; `module_catalog.json` (PC) + localStorage/download (nuvem) |
| **Ponte PIENG** | `postMessage` ou **PIENG JSON** — só `ModuleSpec` + etiqueta |
| **Carimbo / etiqueta / logo** | PNG ~24% / ~13,5% / ~20%; logo transparente |
| **Deploy nuvem** | Importa figura em data URL (sem disco); `.temp`/Salvar pasta só no PC |
| **Fechar polígono** | 1º ponto azul; idle ~2 s → balão «Fecha aqui» (útil / restrita) |
| **Local · Motor solar** | Lat/lon, rodapé Earth, motor — separado do carimbo |

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
