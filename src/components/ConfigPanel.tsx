import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useProject } from "../state/ProjectContext";
import type { AppDefaults, ModuleOrientation } from "../types";

export function ConfigPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { defaults, saveAppDefaults } = useProject();
  const [draft, setDraft] = useState<AppDefaults>(defaults);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setDraft(defaults);
  }, [open, defaults]);

  if (!open) return null;

  const patch = (partial: Partial<AppDefaults>) => setDraft((d) => ({ ...d, ...partial }));

  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Configurar padrões</h2>
        <p className="lead">
          Gravado em <b>defaults.json</b>. Vale na hora: recuo das áreas já desenhadas, vão dos módulos e orientação do lançamento.
        </p>
        <label className="field">
          recuo da área útil (m)
          <input
            type="number"
            min={0}
            step={0.05}
            value={draft.area_margin_m}
            onChange={(e) => patch({ area_margin_m: Number(e.target.value) })}
          />
        </label>
        <p className="hint">0 preenche até a borda verde. O bloco ainda pode ser arrastado depois do lançamento.</p>
        <label className="field">
          margem de sombra da restrita (m)
          <input
            type="number"
            min={0}
            step={0.05}
            value={draft.obstacle_safety_m}
            onChange={(e) => patch({ obstacle_safety_m: Number(e.target.value) })}
          />
        </label>
        <label className="field">
          vão entre módulos (m)
          <input
            type="number"
            min={0}
            step={0.01}
            value={draft.module_gap_m}
            onChange={(e) => patch({ module_gap_m: Number(e.target.value) })}
          />
        </label>
        <div className="btn-row">
          {(["paisagem", "retrato"] as ModuleOrientation[]).map((ori) => (
            <button
              key={ori}
              className={`btn ${draft.launch_orientation === ori ? "primary" : "ghost"}`}
              onClick={() => patch({ launch_orientation: ori })}
            >
              {ori === "paisagem" ? "Paisagem" : "Retrato"}
            </button>
          ))}
        </div>
        <label className="check" style={{ marginTop: 12 }}>
          <input
            type="checkbox"
            checked={draft.show_launch_rects}
            onChange={(e) => patch({ show_launch_rects: e.target.checked })}
          />
          mostrar retângulos pontilhados do lançamento
        </label>
        <div className="btn-row" style={{ marginTop: 16 }}>
          <button className="btn ghost" onClick={onClose}>
            Fechar
          </button>
          <button
            className="btn primary"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              void saveAppDefaults(draft).finally(() => {
                setBusy(false);
                onClose();
              });
            }}
          >
            Gravar padrões
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
