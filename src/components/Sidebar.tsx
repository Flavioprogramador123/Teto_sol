import { useEffect, useRef, useState } from "react";
import { useProject } from "../state/ProjectContext";
import { PersistLibrary } from "./PersistLibrary";
import { SolarCard } from "./SolarCard";
import { DRAW_KIND_LABELS, OBSTACLE_LABELS, type Obstacle, type ObstacleType, type RoofArea, type VisualMode } from "../types";
import { MATERIAL_SLOPE_HINT, normalizeRoofPlane } from "../engine/roofPlane";
import { lineAzimuthDeg, matchModuleSide } from "../engine/scale";
import painelSrc from "../../img/modulo.png";
import { HelpTip } from "./HelpTip";
import { StampExport } from "./StampExport";
import {
  catalogLabel,
  catalogToModulePatch,
  getCatalogModule,
  matchCatalogId,
  useModuleCatalog,
} from "../lib/moduleCatalog";

function SelectedModuleCard() {
  const { state, rotateSelectedModules, deleteSelected } = useProject();
  if (state.selection.kind !== "module" && state.selection.kind !== "module-group") return null;
  const count = state.selection.kind === "module-group" ? state.selection.ids?.length ?? 0 : 1;
  const selectedMods =
    state.selection.kind === "module-group" && state.selection.ids?.length
      ? (state.layout?.best.modules ?? []).filter((m) => state.selection.ids!.includes(m.id))
      : state.selection.kind === "module" && state.selection.id
        ? (state.layout?.best.modules ?? []).filter((m) => m.id === state.selection.id)
        : [];
  const reasons = [
    ...new Set(selectedMods.map((m) => m.violation).filter((v): v is string => Boolean(v))),
  ];
  return (
    <div className="card">
      <h3>
        {count > 1 ? `Bloco · ${count} módulos` : "Módulo selecionado"}
        <HelpTip>
          Clique no módulo para selecionar. Arraste no vazio a <b>caixa de seleção</b> (como no AutoCAD) para marcar vários.
          <b>Delete</b> apaga o lote. Ctrl+clique soma ou tira. Arraste o bloco para mover. R gira 90°.
          Vermelho = fora da área útil, vão ou obstáculo.
        </HelpTip>
      </h3>
      {reasons.length > 0 ? (
        <div className="notice" style={{ marginTop: 0, marginBottom: 8, color: "#ffb4ae" }}>
          Vermelho: {reasons.join(" · ")}
        </div>
      ) : (
        <p className="hint">
          Arraste para reposicionar. Girar 90° {count > 1 ? "vira o bloco inteiro" : "troca retrato e paisagem"}.
        </p>
      )}
      <div className="btn-row">
        <button className="btn primary" onClick={() => rotateSelectedModules()}>
          Girar 90°
        </button>
        <button className="btn danger" onClick={() => deleteSelected()}>
          {count > 1 ? `Excluir ${count}` : "Excluir"}
        </button>
      </div>
    </div>
  );
}

function MeasureModuleCard() {
  const { state, setTool, updateArea, setNotice } = useProject();
  const w = state.module.width_m;
  const h = state.module.height_m;
  const ruler = state.ruler;
  const px = ruler ? Math.hypot(ruler.b[0] - ruler.a[0], ruler.b[1] - ruler.a[1]) : 0;
  const meters = state.scale.calibrated && px > 1e-6 ? px * state.scale.meters_per_pixel : null;
  const match = meters != null ? matchModuleSide(meters, w, h) : null;
  const rulerHeading = px > 1e-3 && ruler ? lineAzimuthDeg(ruler.a, ruler.b) : null;
  /** Régua nova, senão a direção do imóvel já traçada na calibração. */
  const heading = rulerHeading ?? state.scale.heading?.azimuth_deg ?? null;
  const headingSource = rulerHeading != null ? "régua" : state.scale.heading ? "imóvel" : null;
  const targetArea =
    state.selection.kind === "area" && state.selection.id
      ? state.areas.find((a) => a.id === state.selection.id)
      : state.areas.find((a) => a.active) ?? state.areas[0];

  const applyHeading = () => {
    if (heading == null || !targetArea) {
      setNotice("Selecione uma área útil. Use a direção do imóvel (calibração) ou trace no Medir.");
      return;
    }
    const deg = Number(heading.toFixed(1));
    updateArea(targetArea.id, {
      azimuth_deg: deg,
      roof_plane: { ...normalizeRoofPlane(targetArea.roof_plane), fall_direction_deg: deg },
    });
    setNotice(`Azimute e queda ${deg}° gravados em «${targetArea.name}» (mesmo rumo da casa).`);
  };

  return (
    <div className="card">
      <h3>
        Medir
        <HelpTip>
          Se já traçou o muro/divisa na calibração, o azimute aparece aqui. Ou clique 1º e 2º ponto no limite do lote.
          0° = norte (cima), 90° = leste. A queda da água usa o mesmo número.
        </HelpTip>
      </h3>
      <p className="hint">
        {headingSource === "imóvel"
          ? "Usando a direção do imóvel da calibração. Pode medir de novo na figura se quiser outro rumo."
          : "Trace o limite do lote — ou use o rumo já gravado na calibração."}
      </p>
      <div className="kpis">
        <div className="kpi">
          <span>azimute = queda</span>
          <strong>{heading != null ? `${heading.toFixed(1)}°` : "—"}</strong>
        </div>
        <div className="kpi">
          <span>comprimento</span>
          <strong>{meters != null ? `${meters.toFixed(3)} m` : px > 0 ? `${px.toFixed(1)} px` : "—"}</strong>
        </div>
      </div>
      {headingSource && (
        <span className="chip ok" style={{ marginTop: 8 }}>
          {headingSource === "imóvel" ? "da direção do imóvel" : "da régua nesta figura"}
        </span>
      )}
      {meters != null && match && (
        <span className={`chip ${match.ok ? "ok" : "bad"}`} style={{ marginTop: 8 }}>
          {match.ok
            ? `Proporcional · ${match.side} do módulo`
            : `Não bate com o módulo · diferença ${match.error_pct.toFixed(1)}%`}
        </span>
      )}
      <div className="btn-row" style={{ marginTop: 10 }}>
        <button className="btn primary" onClick={() => setTool("ruler")}>
          Medir na figura
        </button>
        <button className="btn ghost" disabled={heading == null || !targetArea} onClick={applyHeading}>
          Usar na água
        </button>
      </div>
    </div>
  );
}

function AreaFillForm({ a }: { a: RoofArea }) {
  const { updateArea, deleteArea } = useProject();
  return (
    <>
      <header>
        <label className="field" style={{ flex: 1, margin: 0 }}>
          nome da área
          <input value={a.name} onChange={(e) => updateArea(a.id, { name: e.target.value })} />
        </label>
        <span className="chip ok">útil</span>
        <HelpTip>
          <b>nome</b> só identifica a água. <b>altura do solo</b> é a cota da cobertura, em metros.
          <b>recuo</b> afasta os módulos da borda (0 = até o limite). <b>azimute / queda</b> é um só rumo: 0° = norte, 90° = leste. A casa a 93° e o telhado usam o mesmo número.
          <b>inclinação %</b> é a queda da telha (30% ≈ 16,7°), não graus.
          <b>material</b> só sugere a inclinação inicial. <b>participa do cálculo</b> inclui esta água no lançamento. Excluir apaga o polígono.
        </HelpTip>
      </header>
      <div className="row">
        <label className="field">
          altura do solo (m)
          <input type="number" min={0} step={0.05} value={a.height_from_ground_m ?? 3} onChange={(e) => updateArea(a.id, { height_from_ground_m: Number(e.target.value) })} />
        </label>
        <label className="field">
          recuo (m)
          <input type="number" min={0} step={0.05} value={a.margin_m} onChange={(e) => updateArea(a.id, { margin_m: Number(e.target.value) })} />
        </label>
      </div>
      <p className="hint">O recuo padrão fica em Configurar (defaults.json). 0 preenche até a borda; depois o bloco ainda pode ser arrastado.</p>
      <div className="row">
        <label className="field">
          azimute / queda (°)
          <input
            type="number"
            min={0}
            max={360}
            step={0.1}
            value={a.azimuth_deg ?? normalizeRoofPlane(a.roof_plane).fall_direction_deg}
            placeholder="0 = norte"
            onChange={(e) => {
              const deg = e.target.value === "" ? 0 : Number(e.target.value);
              updateArea(a.id, {
                azimuth_deg: deg,
                roof_plane: { ...normalizeRoofPlane(a.roof_plane), fall_direction_deg: deg },
              });
            }}
          />
        </label>
        <label className="field">
          inclinação %
          <input
            type="number"
            min={0}
            step={1}
            value={normalizeRoofPlane(a.roof_plane).slope_percent || ""}
            placeholder="0"
            onChange={(e) => {
              const slope_percent = e.target.value === "" ? 0 : Number(e.target.value);
              updateArea(a.id, { roof_plane: { ...normalizeRoofPlane(a.roof_plane), slope_percent } });
            }}
          />
        </label>
      </div>
      <div className="row">
        <label className="field">
          material
          <select
            value={normalizeRoofPlane(a.roof_plane).material}
            onChange={(e) => {
              const material = e.target.value;
              const current = normalizeRoofPlane(a.roof_plane);
              const suggested = MATERIAL_SLOPE_HINT[material];
              updateArea(a.id, {
                roof_plane: {
                  ...current,
                  material,
                  slope_source: suggested && !current.slope_percent ? "suggested" : current.slope_source,
                  slope_percent: current.slope_percent || suggested || 0,
                },
              });
            }}
          >
            <option value="">não informado</option>
            <option value="fibrocimento">fibrocimento</option>
            <option value="ceramica">cerâmica</option>
            <option value="concreto">concreto</option>
          </select>
        </label>
      </div>
      <p className="hint">
        Azimute e queda são o mesmo rumo. Casa a 93° → telhado a 93°. 0° = norte, 90° = leste.
        Os módulos seguem este desvio — 90° fica na horizontal da figura; 93° gira 3°.
        Material só sugere a inclinação inicial. 10% ≈ 5,7°; 30% ≈ 16,7°. Confirme na ficha da telha.
        {normalizeRoofPlane(a.roof_plane).slope_percent > 0
          ? ` Ângulo ${normalizeRoofPlane(a.roof_plane).slope_angle_deg.toFixed(2)}° · fator ${(1 / Math.cos((normalizeRoofPlane(a.roof_plane).slope_angle_deg * Math.PI) / 180)).toFixed(3)}.`
          : ""}
      </p>
      <label className="check">
        <input type="checkbox" checked={a.active} onChange={(e) => updateArea(a.id, { active: e.target.checked })} />
        participa do cálculo
      </label>
      <button className="btn danger" style={{ marginTop: 6 }} onClick={() => deleteArea(a.id)}>
        Excluir
      </button>
    </>
  );
}

function ObstacleFillForm({ o }: { o: Obstacle }) {
  const { updateObstacle, deleteObstacle } = useProject();
  return (
    <>
      <header>
        <label className="field" style={{ flex: 1, margin: 0 }}>
          nome da área
          <input value={o.name} onChange={(e) => updateObstacle(o.id, { name: e.target.value })} />
        </label>
        <span className="chip bad">restrita</span>
        <HelpTip>
          <b>nome</b> identifica o obstáculo. <b>tipo</b> classifica (caixa, chaminé, etc.).
          <b>altura do solo</b> é a cota do objeto. <b>margem de sombra</b> expande a proibição só se o centro estiver em cima daquela água — não come o telhado vizinho.
          <b>excluir da instalação</b> impede módulo em cima. Excluir apaga o polígono.
        </HelpTip>
      </header>
      <div className="row">
        <label className="field">
          tipo
          <select value={o.type} onChange={(e) => updateObstacle(o.id, { type: e.target.value as ObstacleType })}>
            {Object.entries(OBSTACLE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </label>
        <label className="field">
          altura do solo (m)
          <input type="number" min={0} step={0.05} value={o.height_from_ground_m ?? 4.5} onChange={(e) => updateObstacle(o.id, { height_from_ground_m: Number(e.target.value) })} />
        </label>
      </div>
      <label className="field">
        margem de sombra (m)
        <input type="number" min={0} step={0.05} value={o.safety_margin_m} onChange={(e) => updateObstacle(o.id, { safety_margin_m: Number(e.target.value) })} />
      </label>
      <label className="check">
        <input type="checkbox" checked={o.excluded} onChange={(e) => updateObstacle(o.id, { excluded: e.target.checked })} />
        excluir da instalação
      </label>
      <button className="btn danger" style={{ marginTop: 6 }} onClick={() => deleteObstacle(o.id)}>
        Excluir
      </button>
    </>
  );
}

function DrawFillDock() {
  const { state, setDrawKind, setTool, setLaunchOrientation, select, finishOpenDraft, setDraft } = useProject();
  const ref = useRef<HTMLDivElement>(null);
  const selectedArea = state.selection.kind === "area" ? state.areas.find((a) => a.id === state.selection.id) : undefined;
  const selectedObstacle = state.selection.kind === "obstacle" ? state.obstacles.find((o) => o.id === state.selection.id) : undefined;

  // Formulário segue o modo Útil/Restrita — não fica preso na seleção anterior.
  const area =
    state.drawKind === "util"
      ? selectedArea ?? state.areas.at(-1)
      : selectedArea;
  const obstacle =
    state.drawKind === "restrita"
      ? selectedObstacle ?? state.obstacles.at(-1)
      : selectedObstacle && state.drawKind !== "util"
        ? selectedObstacle
        : undefined;

  useEffect(() => {
    ref.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [state.selection.id, state.selection.kind, state.drawKind, area?.id, obstacle?.id]);

  const pickUtil = () => {
    setDrawKind("util");
    const last = state.areas.at(-1);
    if (last) select({ kind: "area", id: last.id });
    else select({ kind: "none", id: null });
  };

  const pickRestrita = () => {
    setDrawKind("restrita");
    const last = state.obstacles.at(-1);
    if (last) select({ kind: "obstacle", id: last.id });
    else select({ kind: "none", id: null });
  };

  const pickLancamento = () => {
    setDrawKind("lancamento");
    select({ kind: "none", id: null });
  };

  return (
    <div className="card sticky-fill" ref={ref}>
      <h3>
        {area ? "Preencher área útil" : obstacle ? "Preencher restrita" : "Preencher área"}
        <HelpTip>
          Este card fica fixo em cima. Escolha Útil / Restrita / Lançar. Se já houver polígono, o formulário abre na hora; senão, feche o polígono no mapa.
        </HelpTip>
      </h3>
      <div className="btn-row">
        <button className={`btn ${state.drawKind === "util" ? "primary" : "ghost"}`} type="button" onClick={pickUtil}>
          Útil
        </button>
        <button className={`btn ${state.drawKind === "restrita" ? "primary" : "ghost"}`} type="button" onClick={pickRestrita}>
          Restrita
        </button>
        <button className={`btn ${state.drawKind === "lancamento" ? "primary" : "ghost"}`} type="button" onClick={pickLancamento}>
          Lançar
        </button>
        <button className={`btn ${state.tool === "group" ? "primary" : "ghost"}`} type="button" onClick={() => setTool("group")}>
          Seleção
        </button>
      </div>
      {state.drawKind === "lancamento" && (
        <div className="btn-row" style={{ marginTop: 8 }}>
          <button
            type="button"
            className={`btn ${(state.launch_orientation ?? "paisagem") === "paisagem" ? "primary" : "ghost"}`}
            onClick={() => setLaunchOrientation("paisagem")}
          >
            Paisagem
          </button>
          <button
            type="button"
            className={`btn ${state.launch_orientation === "retrato" ? "primary" : "ghost"}`}
            onClick={() => setLaunchOrientation("retrato")}
          >
            Retrato
          </button>
        </div>
      )}
      <p className="hint">
        {state.tool === "group"
          ? "Arraste a caixa sobre os módulos (AutoCAD). Solte para marcar o lote; Delete exclui."
          : state.drawKind === "lancamento"
            ? "Retângulo no verde lança os módulos. Não precisa nomear o lançamento."
            : area || obstacle
              ? "Ajuste nome, recuo e azimute neste card. Para outra água, desenhe outro polígono."
              : `Modo ${DRAW_KIND_LABELS[state.drawKind ?? "util"]}: clique os vértices no mapa. Com 3 ou mais pontos, clique em Fechar polígono (ou Enter).`}
      </p>
      {state.draft.length > 0 && state.tool !== "group" && state.drawKind !== "lancamento" && (
        <div className="btn-row" style={{ marginTop: 8 }}>
          <button
            type="button"
            className="btn primary"
            disabled={state.draft.length < 3}
            onClick={() => finishOpenDraft()}
          >
            Fechar polígono{state.draft.length >= 3 ? ` (${state.draft.length} pts)` : ` · faltam ${3 - state.draft.length}`}
          </button>
          <button type="button" className="btn ghost" onClick={() => setDraft([])}>
            Cancelar traço
          </button>
        </div>
      )}
      {area && state.drawKind === "util" && <AreaFillForm a={area} />}
      {obstacle && state.drawKind === "restrita" && <ObstacleFillForm o={obstacle} />}
      {!area && state.drawKind === "util" && state.draft.length === 0 && (
        <div className="notice" style={{ marginTop: 8 }}>
          Nenhuma área útil ainda. Desenhe no mapa e feche com o botão <b>Fechar polígono</b>.
        </div>
      )}
      {!obstacle && state.drawKind === "restrita" && state.draft.length === 0 && (
        <div className="notice" style={{ marginTop: 8 }}>
          Nenhuma área restrita ainda. Desenhe no mapa e feche com o botão <b>Fechar polígono</b>.
        </div>
      )}
    </div>
  );
}

export function Sidebar() {
  const {
    state,
    setStep,
    loadFile,
    loadDemo,
    loadEarthSample,
    applyTwoPointScale,
    setTool,
    clearHeading,
    setScaleInputM,
    verifyScale,
    clearScale,
    enhancePresentation,
    patchVisualization,
    restoreVisualizationOriginal,
    setModule,
    setGridStep,
    select,
    setDraft,
    setDrawKind,
    calculate,
    clearLayout,
    setCrop,
    suggestMapFrame,
    suggestHideChrome,
    applyImageEdit,
    applyEnhanceImage,
    applyHdAndCalibrate,
    restoreOriginalImage,
  } = useProject();
  const catalog = useModuleCatalog();
  const fileRef = useRef<HTMLInputElement>(null);
  const [checkMeters, setCheckMeters] = useState(10);
  const [stampOpen, setStampOpen] = useState(false);

  return (
    <aside className="sidebar">
      {state.notice && <div className="notice">{state.notice}</div>}
      {state.step === "import" && (
        <>
          <h2>Importar imagem</h2>
          <p className="lead">
            A foto permanece como fundo. O projeto é desenhado em camadas vetoriais por cima, sem alterar o arquivo original.
          </p>
          <div className="card import-card">
            <h3>
              Importar
              <HelpTip>
                Solte a captura do Google Earth Web. No PC o arquivo vai para .temp; na nuvem fica nesta sessão.
                img02.png é a figura atual do projeto. modelo01.png é o exemplo antigo.
              </HelpTip>
            </h3>
            <div
              className="drop"
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files[0];
                if (file) void loadFile(file);
              }}
            >
              <strong>Solte a captura aqui</strong>
              No PC grava em .temp; na nuvem fica nesta sessão.
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void loadFile(file);
              }}
            />
            <div className="btn-row import-actions">
              <button className="btn primary" type="button" onClick={() => void loadEarthSample()}>
                img02.png
              </button>
              <button className="btn ghost" type="button" onClick={() => void loadDemo()}>
                modelo01.png
              </button>
              <button className="btn ghost" type="button" onClick={() => fileRef.current?.click()}>
                Outro arquivo
              </button>
            </div>
          </div>
          <div className="card import-card">
            <h3>
              Sobre esta captura
              <HelpTip>
                As figuras vêm do Google Earth Web. A bússola com o vermelho para cima confirma o norte. A barra de baixo traz local, metros da escala, câmera e data.
              </HelpTip>
            </h3>
            <p className="hint">
              Figura atual: <code className="mono">img/img02.png</code> — Google Earth Web, norte para cima.
              O parse lê a barra de baixo: coordenadas, 6 m, câmera e data.
            </p>
          </div>
          <PersistLibrary />
        </>
      )}

      {state.step === "edit" && (
        <>
          <h2>Editar imagem</h2>
          <p className="lead">
            Recorte o que entra no projeto e tape informações sem interesse. O arquivo original fica guardado para restaurar.
          </p>
          <div className="card">
            <h3>
              Recorte
              <HelpTip>
                Arraste a moldura dourada no mapa. Tudo fora será descartado. <b>Moldura do mapa</b> sugere o recorte.
                <b>Ocultar interface</b> tapa busca, bússola e botões. A imagem original continua guardada.
              </HelpTip>
            </h3>
            <p className="hint">Arraste no mapa ou ajuste as alças douradas. Tudo fora da moldura será descartado.</p>
            {state.crop && state.image && (
              <div className="row">
                <label className="field">
                  X
                  <input type="number" value={Math.round(state.crop.x)} onChange={(e) => setCrop({ ...state.crop!, x: Number(e.target.value) })} />
                </label>
                <label className="field">
                  Y
                  <input type="number" value={Math.round(state.crop.y)} onChange={(e) => setCrop({ ...state.crop!, y: Number(e.target.value) })} />
                </label>
                <label className="field">
                  largura
                  <input type="number" value={Math.round(state.crop.w)} onChange={(e) => setCrop({ ...state.crop!, w: Number(e.target.value) })} />
                </label>
                <label className="field">
                  altura
                  <input type="number" value={Math.round(state.crop.h)} onChange={(e) => setCrop({ ...state.crop!, h: Number(e.target.value) })} />
                </label>
              </div>
            )}
            <div className="btn-row">
              <button className="btn ghost" onClick={suggestMapFrame}>Moldura do mapa</button>
              <button className="btn ghost" onClick={suggestHideChrome}>Ocultar interface</button>
            </div>
          </div>
          <div className="card">
            <h3>
              Faixas ocultas
              <HelpTip>
                Retângulos pretos sobre textos, ícones ou lotes que não entram no projeto. Ferramenta Ocultar: arraste na figura. Delete apaga a faixa selecionada.
              </HelpTip>
            </h3>
            <p className="hint">Ferramenta <b>Ocultar</b>: pinte busca, bússola, botão Editar e lotes que não entram. Delete apaga a faixa selecionada.</p>
            {!state.redacts.length && <p className="hint">Nenhuma faixa ainda.</p>}
            {state.redacts.map((r, i) => (
              <div key={r.id} className={`list-item ${state.selection.id === r.id ? "selected" : ""}`}>
                <header>
                  <strong>Faixa {i + 1}</strong>
                  <span className="mono">{Math.round(r.w)}×{Math.round(r.h)}</span>
                </header>
              </div>
            ))}
          </div>
          <div className="card">
            <h3>
              Melhoria 512–768
              <HelpTip>
                Trata iluminação, contraste, nitidez e ruído e coloca o lado maior entre 512 e 768 px, sem mudar a proporção.
                Precisa acontecer antes de calibrar. A original não é apagada. Restaurar volta à captura crua.
              </HelpTip>
            </h3>
            <p className="hint">
              Opcional. Só use se quiser melhorar iluminação/nitidez e limitar o lado maior a 512–768 px.
              Dá para calibrar só com o recorte, sem essa etapa.
            </p>
            {state.image?.hd_applied && (
              <span className="chip ok">Melhoria aplicada · {state.image.width_px} × {state.image.height_px} px</span>
            )}
          </div>
          <div className="btn-row">
            <button className="btn primary" disabled={state.busy} onClick={() => void applyImageEdit()}>
              Aplicar recorte
            </button>
            <button className="btn ghost" disabled={state.busy || !state.image} onClick={() => void applyEnhanceImage()}>
              Aplicar melhoria
            </button>
          </div>
          <div className="btn-row">
            <button className="btn ghost" onClick={() => void restoreOriginalImage()}>
              Restaurar
            </button>
            <button className="btn ghost" disabled={state.busy || !state.image} onClick={() => setStep("scale")}>
              Ir para calibrar
            </button>
          </div>
          <SolarCard variant="local" />
          <button className="btn primary" style={{ marginTop: 8 }} disabled={state.busy} onClick={() => void applyHdAndCalibrate()}>
            Melhorar e calibrar
          </button>
        </>
      )}

      {state.step === "scale" && (
        <>
          <h2>Calibrar escala e direção</h2>
          <p className="lead">Marque a escala da barra e a direção do imóvel. O restante fica abaixo para conferir.</p>
          <div className="card">
            <h3>
              Escala da barra original
              <HelpTip>
                Digite os metros escritos na barra do Earth (ex.: 6). Clique as duas pontas dessa barra na figura.
                O programa gera uma régua do mesmo comprimento ao lado para conferir. Sem escala calibrada o lançamento não tem metros reais.
              </HelpTip>
            </h3>
            <label className="field">
              tamanho escrito na barra (m)
              <input
                type="number"
                min={0.1}
                step={0.1}
                value={state.scale_input_m ?? 10}
                onChange={(e) => {
                  const meters = Number(e.target.value);
                  setScaleInputM(meters);
                  if (!(meters > 0)) return;
                  const pts = state.scaleDraft.length === 2
                    ? state.scaleDraft
                    : state.scale.reference
                      ? [state.scale.reference.point_a, state.scale.reference.point_b]
                      : [];
                  if (pts.length === 2) applyTwoPointScale(pts[0], pts[1], meters);
                }}
              />
            </label>
            <p className="hint">Ferramenta <b>Escala</b>: clique nas duas pontas da barra do Google Earth. Arraste se errar.</p>
            <div className="kpis">
              <div className="kpi">
                <span>sua escala</span>
                <strong>
                  {state.scale.reference
                    ? `${Math.hypot(
                        state.scale.reference.point_b[0] - state.scale.reference.point_a[0],
                        state.scale.reference.point_b[1] - state.scale.reference.point_a[1],
                      ).toFixed(1)} px`
                    : "—"}
                </strong>
              </div>
              <div className="kpi">
                <span>você informou</span>
                <strong>{state.scale.reference ? `${state.scale.reference.real_distance_m.toFixed(0)} m` : "—"}</strong>
              </div>
              <div className="kpi">
                <span>px / m</span>
                <strong>{state.scale.calibrated ? state.scale.pixels_per_meter.toFixed(2) : "—"}</strong>
              </div>
              <div className="kpi">
                <span>régua gerada</span>
                <strong>
                  {state.scale.calibrated && state.scale.reference
                    ? `${Math.hypot(
                        state.scale.reference.point_b[0] - state.scale.reference.point_a[0],
                        state.scale.reference.point_b[1] - state.scale.reference.point_a[1],
                      ).toFixed(1)} px`
                    : "—"}
                </strong>
              </div>
            </div>
            <span className={`chip ${state.scale.calibrated ? "ok" : "bad"}`} style={{ marginTop: 10 }}>
              {state.scale.calibrated ? "Régua gerada na figura" : "Aguardando escala"}
            </span>
            <div className="btn-row">
              <button className="btn danger" onClick={clearScale}>Limpar</button>
            </div>
          </div>
          <div className="card">
            <h3>
              Direção do imóvel
              <HelpTip>
                Clique as duas pontas do muro, da cumeeira ou da divisa — a linha «horizontal» da casa.
                A bússola interna gira para esse rumo. A foto não se mexe. Os módulos passam a seguir esse desvio.
              </HelpTip>
            </h3>
            <p className="hint">
              Passe a linha sobre o muro ou a divisa. Casa a 93° → a grade gira 3° em relação à figura.
            </p>
            <div className="kpis">
              <div className="kpi">
                <span>azimute</span>
                <strong>{state.scale.heading ? `${state.scale.heading.azimuth_deg.toFixed(1)}°` : "—"}</strong>
              </div>
              <div className="kpi">
                <span>desvio na figura</span>
                <strong>
                  {state.scale.heading
                    ? `${state.scale.heading.azimuth_deg - 90 >= 0 ? "+" : ""}${(state.scale.heading.azimuth_deg - 90).toFixed(1)}°`
                    : "—"}
                </strong>
              </div>
            </div>
            <span className={`chip ${state.scale.heading ? "ok" : "bad"}`} style={{ marginTop: 10 }}>
              {state.scale.heading
                ? "Bússola do imóvel ajustada · figura no lugar"
                : "Aguardando o traço do muro / divisa"}
            </span>
            <div className="btn-row" style={{ marginTop: 10 }}>
              <button className={`btn ${state.tool === "heading" ? "primary" : "ghost"}`} onClick={() => setTool("heading")}>
                Traçar muro / divisa
              </button>
              <button className="btn danger" disabled={!state.scale.heading && !state.headingDraft?.length} onClick={clearHeading}>
                Limpar direção
              </button>
            </div>
          </div>
          <div className="card">
            <h3>
              Conferir com a barra primitiva
              <HelpTip>
                Depois de marcar a escala, o programa desenha uma régua do mesmo tamanho. Compare com a barra original do Earth.
                Se não bater, limpe e marque as pontas de novo. Só então desenhe as áreas.
              </HelpTip>
            </h3>
            <p className="hint">
              Dourado = sua escala. Ciano = régua do sistema. Verde = {checkMeters} m de conferência. As três e a barra branca do desenho precisam ter o mesmo tamanho.
            </p>
            <label className="field">
              a régua gerada deve ter (m)
              <input type="number" min={0.1} step={0.1} value={checkMeters} onChange={(e) => setCheckMeters(Number(e.target.value))} />
            </label>
            <button className="btn primary" disabled={!state.scale.calibrated} onClick={() => verifyScale(checkMeters)}>
              Conferir escala
            </button>
            {state.scale.check && (
              <div style={{ marginTop: 10 }}>
                <div className="kpis">
                  <div className="kpi">
                    <span>sua escala</span>
                    <strong>{state.scale.check.marked_px.toFixed(1)} px = {state.scale.check.marked_m.toFixed(2)} m</strong>
                  </div>
                  <div className="kpi">
                    <span>régua gerada</span>
                    <strong>{state.scale.check.generated_px.toFixed(1)} px = {state.scale.check.generated_m.toFixed(2)} m</strong>
                  </div>
                </div>
                <span className={`chip ${state.scale.check.ok ? "ok" : "bad"}`} style={{ marginTop: 8 }}>
                  {state.scale.check.ok
                    ? `Cálculo ok · a régua gerada tem ${state.scale.check.generated_m.toFixed(0)} m`
                    : `Não bate · diferença ${state.scale.check.error_pct.toFixed(2)}%`}
                </span>
                <p className="hint" style={{ marginTop: 8 }}>
                  {state.scale.check.ok
                    ? `Olhe a figura: a linha verde de ${state.scale.check.check_m.toFixed(0)} m tem de coincidir com a barra primitiva do desenho. Se a barra branca for menor ou maior, a escala não está nas pontas certas — limpe e marque de novo.`
                    : "Limpe e marque só as pontas da barra original."}
                </p>
              </div>
            )}
          </div>
          <ol className="scale-steps">
            <li>Digite o tamanho da barra original e marque as duas pontas.</li>
            <li>O sistema desenha a régua gerada ao lado da escala — não no canto.</li>
            <li>Conferir escala: a régua tem 10 m? A barra primitiva do desenho também bate?</li>
            <li>Trace o muro ou a divisa — a bússola interna gira; a figura fica no lugar.</li>
          </ol>
          <SolarCard />
          <button className="btn primary" disabled={!state.scale.calibrated} onClick={() => setStep("draw")}>
            Continuar para o telhado
          </button>
        </>
      )}

      {state.step === "draw" && (
        <>
          <DrawFillDock />
          <h2>Configurar telhado</h2>
          <p className="lead">
            O card de preenchimento fica fixo em cima. Desenhe a área útil e os obstáculos. Em <b>Lançar</b>, arraste um retângulo na área verde. Clique no módulo para girar 90° ou arrastar; Shift+clique ou <b>Grupo</b> para o bloco.
          </p>
          <div className="card">
            <h3>
              Áreas úteis
              <HelpTip>
                Polígonos verdes onde os módulos podem entrar. Clique no item da lista para abrir o card de preenchimento (nome, recuo, plano). No mapa, clique nos vértices para editar.
              </HelpTip>
            </h3>
            {!state.areas.length && <p className="hint">Ainda não há área útil. Feche o polígono — o card de preenchimento fica fixo em cima.</p>}
            {state.areas.map((a) => (
              <div
                key={a.id}
                className={`list-item compact util ${state.selection.id === a.id ? "selected" : ""}`}
                role="button"
                tabIndex={0}
                onClick={() => {
                  setDraft([]);
                  setDrawKind("util");
                  setTool("select");
                  select({ kind: "area", id: a.id });
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setDraft([]);
                    setDrawKind("util");
                    setTool("select");
                    select({ kind: "area", id: a.id });
                  }
                }}
              >
                <span>{a.name || "sem nome"}</span>
                <span className="chip ok">útil</span>
              </div>
            ))}
          </div>
          <div className="card">
            <h3>
              Áreas restritas / ocupadas
              <HelpTip>
                Polígonos vermelhos: caixa d'água, chaminé, platibanda, aquecimento. Podem ficar em cima do verde. O módulo não pode encostar nessa área.
              </HelpTip>
            </h3>
            {!state.obstacles.length && <p className="hint">Caixa d'água, platibanda, chaminé ou sala de pé-direito alto. Pode desenhar por cima da área útil.</p>}
            {state.obstacles.map((o) => (
              <div
                key={o.id}
                className={`list-item compact restrita ${state.selection.id === o.id ? "selected" : ""}`}
                role="button"
                tabIndex={0}
                onClick={() => {
                  setDraft([]);
                  setDrawKind("restrita");
                  setTool("select");
                  select({ kind: "obstacle", id: o.id });
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setDraft([]);
                    setDrawKind("restrita");
                    setTool("select");
                    select({ kind: "obstacle", id: o.id });
                  }
                }}
              >
                <span>{o.name || "sem nome"}</span>
                <span className="chip bad">restrita</span>
              </div>
            ))}
          </div>
          <SelectedModuleCard />
          <MeasureModuleCard />
          <button className="btn primary" disabled={!state.areas.length} onClick={() => setStep("layout")}>
            Ir para a usina
          </button>
        </>
      )}

      {state.step === "layout" && (
        <>
          <h2>Gerar usina</h2>
          <p className="lead">
            Informe o módulo e a quantidade. <b>Gerar usina</b> preenche as áreas úteis. Também dá para inserir módulos no mapa com Lançar ou Adicionar.
          </p>
          <div className="card">
            <h3>
              Módulo {state.module.brand} {state.module.model}
              <HelpTip>
                Catálogo em <b>module_catalog.json</b> (raiz do projeto). Escolha o modelo para preencher potência e dimensões.
                Largura, altura e vão entram no encaixe. Quantidade é a meta. Potência só soma kWp.
                Rotação 90° testa retrato e paisagem. A foto do módulo é desenhada no tamanho real × a escala.
              </HelpTip>
            </h3>
            <p className="hint">
              A foto do painel entra na figura no tamanho real × a escala do desenho. Obstáculos desenhados não são ignorados — o telhado não é deformado para caber módulo.
            </p>
            <div className="module-preview">
              <img src={painelSrc} alt="Módulo fotovoltaico" />
              {state.scale.calibrated && (
                <p className="hint">
                  Na figura: {(state.module.width_m * state.scale.pixels_per_meter).toFixed(1)} × {(state.module.height_m * state.scale.pixels_per_meter).toFixed(1)} px
                  {" "}({state.scale.pixels_per_meter.toFixed(2)} px/m)
                </p>
              )}
            </div>
            <label className="field">
              catálogo
              <select
                value={matchCatalogId(state.module)}
                onChange={(e) => {
                  const item = getCatalogModule(e.target.value);
                  if (item) setModule(catalogToModulePatch(item, state.module));
                }}
              >
                <option value="">Personalizado (editar campos abaixo)</option>
                {catalog.modules.map((m) => (
                  <option key={m.id} value={m.id}>
                    {catalogLabel(m)}
                  </option>
                ))}
              </select>
            </label>
            {(() => {
              const notes = getCatalogModule(matchCatalogId(state.module))?.notes;
              return notes ? <p className="hint">{notes}</p> : null;
            })()}
            <div className="row">
              <label className="field">
                marca
                <input value={state.module.brand} onChange={(e) => setModule({ brand: e.target.value })} />
              </label>
              <label className="field">
                modelo
                <input value={state.module.model} onChange={(e) => setModule({ model: e.target.value })} />
              </label>
            </div>
            <div className="row">
              <label className="field">
                potência (W)
                <input type="number" value={state.module.power_w} onChange={(e) => setModule({ power_w: Number(e.target.value) })} />
              </label>
              <label className="field">
                quantidade
                <input type="number" min={1} value={state.module.quantity_target} onChange={(e) => setModule({ quantity_target: Number(e.target.value) })} />
              </label>
            </div>
            <div className="row">
              <label className="field">
                largura (m)
                <input type="number" min={0.1} step={0.001} value={state.module.width_m} onChange={(e) => setModule({ width_m: Number(e.target.value) })} />
              </label>
              <label className="field">
                altura (m)
                <input type="number" min={0.1} step={0.001} value={state.module.height_m} onChange={(e) => setModule({ height_m: Number(e.target.value) })} />
              </label>
            </div>
            <div className="row">
              <label className="field">
                vão (m)
                <input type="number" min={0} step={0.005} value={state.module.gap_m} onChange={(e) => setModule({ gap_m: Number(e.target.value) })} />
              </label>
              <label className="field">
                passo da grade (m)
                <input type="number" min={0.05} step={0.05} value={state.grid_step_m} onChange={(e) => setGridStep(Number(e.target.value))} />
              </label>
            </div>
            <label className="check">
              <input type="checkbox" checked={state.module.rotation_allowed} onChange={(e) => setModule({ rotation_allowed: e.target.checked })} />
              permitir rotação 90°
            </label>
          </div>
          <SelectedModuleCard />
          <MeasureModuleCard />
          <SolarCard />
          <div className="btn-row">
            <button className="btn primary" disabled={state.busy || !state.scale.calibrated} onClick={calculate}>
              Gerar usina
            </button>
            <button className="btn ghost" onClick={clearLayout}>Limpar usina</button>
          </div>
          {state.layout && (
            <div className="card" style={{ marginTop: 12 }}>
              <h3>
                Resultado
                <HelpTip>
                  Encaixados = todos os módulos na usina (inclui vermelhos forçados). Pedidos = meta.
                  Potência e área usam essa quantidade. Vermelho = alerta de geometria (sombra/vão/borda), não some do total.
                </HelpTip>
              </h3>
              <span className={`chip ${state.layout.status === "Aprovado" ? "ok" : state.layout.status === "Parcial" ? "warn" : "bad"}`}>
                {state.layout.status}
              </span>
              <div className="kpis" style={{ marginTop: 10 }}>
                <div className="kpi"><span>Encaixados</span><strong>{state.layout.best.modules.length}/{state.layout.requested}</strong></div>
                <div className="kpi"><span>Não encaixados</span><strong>{Math.max(0, state.layout.requested - state.layout.best.modules.length)}</strong></div>
                <div className="kpi"><span>Potência</span><strong>{((state.layout.best.modules.length * state.module.power_w) / 1000).toFixed(2)} kWp</strong></div>
                <div className="kpi"><span>Área ocupada</span><strong>{state.layout.occupied_area_m2.toFixed(2)} m²</strong></div>
              </div>
              {state.layout.best.modules.some((m) => m.violation) && (
                <p className="hint" style={{ marginTop: 8, color: "#ffb4ae" }}>
                  {state.layout.best.modules.filter((m) => m.violation).length} módulo(s) em alerta (vermelho) — contam no total.
                </p>
              )}
              <p className="hint" style={{ marginTop: 10 }}>
                {state.layout.best.candidates_tested.toLocaleString("pt-BR")} posições testadas ·{" "}
                {state.layout.best.rejected_outside.toLocaleString("pt-BR")} fora da área ·{" "}
                {state.layout.best.rejected_obstacle.toLocaleString("pt-BR")} em obstáculo.
                Arraste um módulo para ajuste manual; o retângulo fica vermelho se violar a geometria.
              </p>
              {state.layout.usable_polygons_px.filter((u) => u.error).map((u) => (
                <p key={u.areaId} className="hint" style={{ color: "#ffb4ae" }}>{u.error}</p>
              ))}
            </div>
          )}
          <div className="card" style={{ marginTop: 12 }}>
            <h3>
              Melhorar apresentação
              <HelpTip>
                Gera fundo tratado para proposta comercial. Não move telhado, obstáculo nem módulo. Os painéis são reaplicados pelo motor.
                Modo técnico, apresentação ou fotorrealista. Comparar original só troca o fundo. Se falhar, a figura original continua.
              </HelpTip>
            </h3>
            <p className="hint">
              Ajusta iluminação e nitidez. Não move telhado, obstáculo nem módulo. Sem layout, a imagem pode ser aprimorada com aviso.
            </p>
            <label className="field">
              modo
              <select
                value={state.visualization.mode}
                onChange={(e) => patchVisualization({ mode: e.target.value as VisualMode })}
              >
                <option value="presentation">apresentação</option>
                <option value="technical">técnico</option>
                <option value="photorealistic">fotorrealista</option>
              </select>
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={state.visualization.show_modules}
                onChange={(e) => patchVisualization({ show_modules: e.target.checked })}
              />
              mostrar módulos
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={state.visualization.show_obstacles}
                onChange={(e) => patchVisualization({ show_obstacles: e.target.checked })}
              />
              mostrar obstáculos
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={state.visualization.compare_original}
                onChange={(e) => patchVisualization({ compare_original: e.target.checked, use_enhanced: !e.target.checked })}
              />
              comparar original
            </label>
            {state.visualization.outdated && (
              <p className="hint" style={{ color: "#f3c15b" }}>Visualização desatualizada — a geometria mudou.</p>
            )}
            {state.visualization.warnings.map((w) => (
              <p key={w} className="hint">{w}</p>
            ))}
            <div className="btn-row" style={{ marginTop: 8 }}>
              <button className="btn primary" disabled={!state.image || state.visualization.status === "running"} onClick={() => void enhancePresentation()}>
                {state.visualization.status === "running" ? "Gerando…" : "Melhorar apresentação"}
              </button>
              <button className="btn ghost" onClick={restoreVisualizationOriginal}>
                Restaurar original
              </button>
            </div>
            {state.visualization.composite_src && (
              <a className="btn ghost" style={{ marginTop: 8, display: "block", textAlign: "center" }} href={state.visualization.composite_src} target="_blank" rel="noreferrer">
                Exportar apresentação
              </a>
            )}
            <p className="hint" style={{ marginTop: 8 }}>
              Simulação visual baseada no layout calculado pelo PlanoSol. A instalação definitiva depende de vistoria e validação técnica.
            </p>
          </div>
          <div className="card" style={{ marginTop: 12 }}>
            <h3>
              Carimbos e arquivo
              <HelpTip>
                Abre a etiqueta da PIENG. Preencha e salve o projeto — os dados ficam no JSON para revisão.
                Novo projeto / novo cliente: campos do cliente vêm vazios (null no JSON).
              </HelpTip>
            </h3>
            <p className="hint">Etiqueta salva com o projeto. Novo cliente começa em branco.</p>
            <button className="btn primary" disabled={!state.image} onClick={() => setStampOpen(true)}>
              Gerar arquivo
            </button>
          </div>
          <StampExport open={stampOpen} onClose={() => setStampOpen(false)} />
        </>
      )}
    </aside>
  );
}
