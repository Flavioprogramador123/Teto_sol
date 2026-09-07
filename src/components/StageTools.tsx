import { HoverTip, ToolGroup } from "./HoverTip";
import { useProject } from "../state/ProjectContext";
import type { Tool } from "../types";

type Props = {
  areaPicker: boolean;
  setAreaPicker: (v: boolean) => void;
  scaleMeters: number;
  setModuleTapeNull: () => void;
  fitView: () => void;
};

type ToolItem = {
  id: Tool;
  label: string;
  help: string;
};

export function StageTools({
  areaPicker,
  setAreaPicker,
  scaleMeters,
  setModuleTapeNull,
  fitView,
}: Props) {
  const {
    state,
    setTool,
    setDrawKind,
    setScaleInputM,
    applyTwoPointScale,
    clearScale,
    clearHeading,
    setRuler,
    setLaunchOrientation,
    rotateSelectedModules,
    deleteSelected,
    setDraft,
    finishOpenDraft,
    applyImageEdit,
    suggestMapFrame,
    suggestHideChrome,
    restoreOriginalImage,
    verifyScale,
    calculate,
    applyEnhanceImage,
    setCrop,
    select,
  } = useProject();

  const closePolygon = () => {
    finishOpenDraft();
  };

  const step = state.step;
  const tool = state.tool;
  const scalePoints = state.scaleDraft.length
    ? state.scaleDraft
    : state.scale.reference
      ? [state.scale.reference.point_a, state.scale.reference.point_b]
      : [];

  const activate = (id: Tool) => {
    if (id === "area") {
      setAreaPicker(false);
      setDrawKind("util");
      const last = state.areas.at(-1);
      if (last) select({ kind: "area", id: last.id });
      else select({ kind: "none", id: null });
      return;
    }
    if (id === "obstacle") {
      setAreaPicker(false);
      setDrawKind("restrita");
      const last = state.obstacles.at(-1);
      if (last) select({ kind: "obstacle", id: last.id });
      else select({ kind: "none", id: null });
      return;
    }
    if (id === "launch") {
      setAreaPicker(false);
      setDrawKind("lancamento");
      select({ kind: "none", id: null });
      return;
    }
    setAreaPicker(false);
    setTool(id);
  };

  const btn = (item: ToolItem) => (
    <HoverTip key={item.id} title={item.label} text={item.help}>
      <button
        type="button"
        className={tool === item.id ? "on" : ""}
        aria-pressed={tool === item.id}
        onClick={() => activate(item.id)}
      >
        {item.label}
      </button>
    </HoverTip>
  );

  const action = (
    key: string,
    label: string,
    help: string,
    onClick: () => void,
    opts?: { on?: boolean; disabled?: boolean },
  ) => (
    <HoverTip key={key} title={label} text={help}>
      <button type="button" className={opts?.on ? "on" : ""} disabled={opts?.disabled} onClick={onClick}>
        {label}
      </button>
    </HoverTip>
  );

  const viewGroup = (
    <ToolGroup label="Vista">
      {btn({
        id: "pan",
        label: "Mover",
        help: "Arraste a imagem. Também funciona com o botão do meio ou Alt+arrastar em qualquer ferramenta.",
      })}
      {action("fit", "Enquadrar", "Ajusta zoom e posição para ver a imagem inteira.", fitView, {
        disabled: !state.image,
      })}
    </ToolGroup>
  );

  return (
    <div className="overlay-tools">
      <div className="tool-row">
        {viewGroup}

        {step === "import" && (
          <span className="chip tool-hint">
            Etapa 1 — importe a captura na barra lateral. Em seguida avance para Editar imagem.
          </span>
        )}

        {step === "edit" && (
          <>
            <ToolGroup label="2 · Imagem">
              {btn({
                id: "crop",
                label: "Recortar",
                help: "Ajuste a moldura para ficar só com o telhado e a área de interesse. Enter aplica o recorte.",
              })}
              {btn({
                id: "redact",
                label: "Ocultar",
                help: "Pinte retângulos sobre busca, bússola, logos e dados sensíveis antes de calibrar.",
              })}
              {action("frame", "Moldura", "Sugere um recorte típico de mapa (barra, rodapé e laterais).", () => {
                suggestMapFrame();
                setTool("crop");
              })}
              {action("chrome", "UI do mapa", "Marca barras e ícones do Google Earth para ocultar. Depois use Aplicar.", () => {
                suggestHideChrome();
                setTool("redact");
              })}
            </ToolGroup>
            <ToolGroup label="Aplicar">
              {action(
                "apply",
                "Aplicar recorte",
                "Grava o recorte e as faixas ocultas, sem melhorar a imagem.",
                () => void applyImageEdit(),
                { on: tool === "crop" || tool === "redact" },
              )}
              {action(
                "cancel-crop",
                "Cancelar · Esc",
                "Remove a moldura de recorte sem aplicar.",
                () => {
                  setCrop(null);
                  setTool("pan");
                },
                { disabled: !state.crop && tool !== "crop" },
              )}
              {action(
                "enhance",
                "Melhoria",
                "Opcional: melhora iluminação/nitidez e limita o lado maior a 512–768 px.",
                () => void applyEnhanceImage(),
              )}
              {action(
                "orig",
                "Original",
                "Volta à imagem original sem o recorte/melhoria aplicados nesta sessão.",
                () => void restoreOriginalImage(),
                { disabled: !state.image?.original_src },
              )}
            </ToolGroup>
          </>
        )}

        {step === "scale" && (
          <>
            <ToolGroup label="3 · Calibrar">
              {btn({
                id: "scale",
                label: "Escala",
                help: "Marque as duas pontas da barra de escala (ou uma distância conhecida) e informe os metros.",
              })}
              {btn({
                id: "heading",
                label: "Direção",
                help: "Trace um muro ou divisa alinhado ao norte do mapa para a bússola do imóvel.",
              })}
              {btn({
                id: "ruler",
                label: "Medir",
                help: "Meça distâncias na imagem após calibrar, ou confira uma cota conhecida.",
              })}
            </ToolGroup>
            <ToolGroup label="Conferir">
              {action(
                "verify",
                "Conferir 10 m",
                "Gera uma barra de conferência de 10 m com a escala atual para validar a calibração.",
                () => verifyScale(10),
                { disabled: !state.scale.calibrated },
              )}
              {tool === "scale" &&
                action("clear-scale", "Limpar escala", "Remove a calibração e os pontos de referência.", clearScale)}
              {tool === "heading" &&
                action("clear-h", "Limpar direção", "Remove a bússola / direção do imóvel.", clearHeading)}
            </ToolGroup>
            {tool === "scale" && (
              <label className="chip tool-chip">
                metros
                <input
                  type="number"
                  min={0.1}
                  step={0.1}
                  value={scaleMeters}
                  onChange={(e) => {
                    const value = Number(e.target.value);
                    setScaleInputM(value);
                    if (value > 0 && scalePoints.length === 2) {
                      applyTwoPointScale(scalePoints[0], scalePoints[1], value);
                    }
                  }}
                  style={{ width: 64, marginLeft: 6 }}
                />
              </label>
            )}
            {tool === "heading" && (
              <span className="chip">
                {state.scale.heading
                  ? `bússola ${state.scale.heading.azimuth_deg.toFixed(1)}° · desvio ${(state.scale.heading.azimuth_deg - 90).toFixed(1)}°`
                  : "trace o muro ou a divisa"}
              </span>
            )}
            {tool === "ruler" && (
              <>
                <span className="chip">
                  módulo {state.module.width_m.toFixed(3)} × {state.module.height_m.toFixed(3)} m
                </span>
                {action("clr-r", "Limpar medida", "Apaga a fita métrica atual no canvas.", () => {
                  setRuler(null);
                  setModuleTapeNull();
                })}
              </>
            )}
          </>
        )}

        {step === "draw" && (
          <>
            <ToolGroup label="4 · Telhado">
              {btn({
                id: "area",
                label: "Área útil",
                help: "Polígono da superfície onde os módulos podem ser lançados. Feche no primeiro ponto ou Enter.",
              })}
              {btn({
                id: "obstacle",
                label: "Obstáculo",
                help: "Área restrita (caixa d’água, chaminé, acesso). Os módulos não entram aqui.",
              })}
              {btn({
                id: "ruler",
                label: "Medir",
                help: "Confira cotas e espaçamentos na planta calibrada.",
              })}
              {btn({
                id: "select",
                label: "Editar",
                help: "Selecione um polígono e arraste vértices para ajustar o desenho.",
              })}
            </ToolGroup>
            {(tool === "area" || tool === "obstacle") && state.draft.length >= 3 && (
              <ToolGroup label="Polígono">
                {action("close", "Fechar polígono", "Fecha o polígono com os pontos já marcados (também Enter).", closePolygon, {
                  on: true,
                })}
              </ToolGroup>
            )}
            {tool === "ruler" &&
              action("clr-r2", "Limpar medida", "Apaga a fita métrica atual.", () => {
                setRuler(null);
                setModuleTapeNull();
              })}
          </>
        )}

        {step === "layout" && (
          <>
            <ToolGroup label="5 · Usina">
              {action(
                "gerar-usina",
                state.layout ? "Atualizar usina" : "Gerar usina",
                "Insere ou atualiza os módulos e renumera 1…N na sequência do telhado (linha a linha).",
                () => calculate(),
                { on: true, disabled: state.busy || !state.scale.calibrated || !state.areas.length },
              )}
              {btn({
                id: "launch",
                label: "Inserir bloco",
                help: "Arraste o retângulo na área verde (pode começar sobre módulo). Solte para lançar. Ctrl+clique seleciona um módulo.",
              })}
              {btn({
                id: "place-module",
                label: "Inserir 1",
                help: "Clique na área útil para colocar um módulo manualmente.",
              })}
              {btn({
                id: "select",
                label: "Editar",
                help: "Clique um módulo ou arraste a caixa de seleção (como no AutoCAD). Delete apaga o lote.",
              })}
              {btn({
                id: "group",
                label: "Seleção",
                help: "Arraste a caixa sobre os módulos para marcar o lote. Delete exclui. Igual ao Editar.",
              })}
              {btn({
                id: "ruler",
                label: "Medir",
                help: "Meça distância entre módulos, bordas e obstáculos.",
              })}
            </ToolGroup>
            {tool === "launch" && (
              <ToolGroup label="Orientação">
                {action(
                  "paisagem",
                  "Paisagem",
                  "Módulos com o lado maior na horizontal.",
                  () => setLaunchOrientation("paisagem"),
                  { on: (state.launch_orientation ?? "paisagem") === "paisagem" },
                )}
                {action(
                  "retrato",
                  "Retrato",
                  "Módulos com o lado maior na vertical.",
                  () => setLaunchOrientation("retrato"),
                  { on: state.launch_orientation === "retrato" },
                )}
              </ToolGroup>
            )}
            {(state.selection.kind === "module" || state.selection.kind === "module-group") && (
              <ToolGroup label="Seleção">
                {action("rot", "Girar 90° · R", "Gira o módulo ou o bloco selecionado em 90°.", () => rotateSelectedModules(), {
                  on: true,
                })}
                {action(
                  "del-mod",
                  state.selection.kind === "module-group"
                    ? `Excluir bloco (${state.selection.ids?.length ?? 0})`
                    : "Excluir módulo",
                  "Remove o módulo ou o bloco selecionado (também Delete).",
                  () => deleteSelected(),
                  { on: true },
                )}
              </ToolGroup>
            )}
            {tool === "ruler" &&
              action("clr-r3", "Limpar medida", "Apaga a fita métrica atual.", () => {
                setRuler(null);
                setModuleTapeNull();
              })}
          </>
        )}
      </div>

      {areaPicker && step === "draw" ? (
        <div className="area-picker">
          <strong>Que área vai desenhar?</strong>
          <button
            type="button"
            onClick={() => {
              setDrawKind("util");
              setAreaPicker(false);
            }}
          >
            Útil
          </button>
          <button
            type="button"
            onClick={() => {
              setDrawKind("restrita");
              setAreaPicker(false);
            }}
          >
            Obstáculo
          </button>
          <button type="button" className="ghost" onClick={() => setAreaPicker(false)}>
            Cancelar
          </button>
        </div>
      ) : null}
    </div>
  );
}
