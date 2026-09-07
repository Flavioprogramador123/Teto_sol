import { useRef, useState } from "react";
import { useProject } from "../state/ProjectContext";
import type { Step } from "../types";
import { applyTheme, readTheme, type AppTheme } from "../theme";
import { ConfigPanel } from "./ConfigPanel";
import { StampExport } from "./StampExport";

const STEPS: Array<{ id: Step; n: number; label: string }> = [
  { id: "import", n: 1, label: "Importar" },
  { id: "edit", n: 2, label: "Editar imagem" },
  { id: "scale", n: 3, label: "Calibrar" },
  { id: "draw", n: 4, label: "Telhado" },
  { id: "layout", n: 5, label: "Usina" },
];

export function TopBar() {
  const { state, setStep, saveProject, newProject, setProjectName, undo, redo, canUndo, canRedo, applyPiengBridge } =
    useProject();
  const [configOpen, setConfigOpen] = useState(false);
  const [stampOpen, setStampOpen] = useState(false);
  const [theme, setTheme] = useState<AppTheme>(readTheme);
  const piengFileRef = useRef<HTMLInputElement>(null);
  const order: Step[] = ["import", "edit", "scale", "draw", "layout"];
  const current = order.indexOf(state.step);

  const onPiengFile = async (file: File | null) => {
    if (!file) return;
    try {
      const text = await file.text();
      const ok = applyPiengBridge(JSON.parse(text));
      if (!ok) window.alert("JSON inválido — esperado bridge do Gerador PIENG (module + etiqueta).");
    } catch {
      window.alert("Não foi possível ler o JSON do Gerador PIENG.");
    }
  };

  return (
    <header className="topbar">
      <div className="brand">
        <img className="brand-mark" src="/brand/logo-mark.png" alt="PIENG" width={36} height={36} />
        <div>
          <h1>PlanoSol</h1>
          <small>PIENG Soluções Energéticas</small>
        </div>
      </div>
      <nav className="steps">
        {STEPS.map((s, i) => {
          const cls = s.id === state.step ? "step active" : i < current ? "step done" : "step";
          const locked = (s.id === "edit" || s.id === "scale") && !state.image;
          const locked2 = s.id === "draw" && !state.scale.calibrated;
          const locked3 = s.id === "layout" && !state.areas.length;
          return (
            <button
              key={s.id}
              className={cls}
              disabled={locked || locked2 || locked3}
              onClick={() => setStep(s.id)}
            >
              <b>{s.n}</b>
              {s.label}
            </button>
          );
        })}
      </nav>
      <div className="persist-bar">
        <div className="toolbar-cluster" role="group" aria-label="Histórico">
          <button
            className="btn toolbar-icon"
            type="button"
            disabled={!canUndo || state.busy}
            title="Desfazer (Ctrl+Z)"
            aria-label="Desfazer"
            onClick={() => undo()}
          >
            <span aria-hidden="true">↶</span>
          </button>
          <button
            className="btn toolbar-icon"
            type="button"
            disabled={!canRedo || state.busy}
            title="Refazer (Ctrl+Y)"
            aria-label="Refazer"
            onClick={() => redo()}
          >
            <span aria-hidden="true">↷</span>
          </button>
        </div>

        <span className="toolbar-sep" aria-hidden="true" />

        <div className="toolbar-cluster theme-switch" role="group" aria-label="Tema">
          <button
            className={`btn toolbar-seg ${theme === "claro" ? "on" : ""}`}
            type="button"
            onClick={() => {
              applyTheme("claro");
              setTheme("claro");
            }}
          >
            Claro
          </button>
          <button
            className={`btn toolbar-seg ${theme === "escuro" ? "on" : ""}`}
            type="button"
            onClick={() => {
              applyTheme("escuro");
              setTheme("escuro");
            }}
          >
            Escuro
          </button>
        </div>

        <span className="toolbar-sep" aria-hidden="true" />

        <div className="toolbar-project">
          <input
            value={state.persist?.name ?? ""}
            onChange={(e) => setProjectName(e.target.value)}
            placeholder="Nome do projeto"
            aria-label="Nome do projeto"
          />
          <button className="btn primary" disabled={!state.image || state.busy} onClick={() => void saveProject()}>
            Salvar
          </button>
        </div>

        <span className="toolbar-sep" aria-hidden="true" />

        <div className="toolbar-actions">
          <input
            ref={piengFileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              void onPiengFile(e.target.files?.[0] ?? null);
              e.target.value = "";
            }}
          />
          <button
            className="btn ghost quiet"
            type="button"
            title="Importar JSON do Gerador de Propostas PIENG (módulo + etiqueta)"
            onClick={() => piengFileRef.current?.click()}
          >
            PIENG JSON
          </button>
          <button className="btn ghost quiet" disabled={!state.image} onClick={() => setStampOpen(true)}>
            Gerar arquivo
          </button>
          <button className="btn ghost quiet" onClick={() => setConfigOpen(true)}>
            Configurar
          </button>
          <button className="btn ghost quiet" onClick={() => void newProject()}>
            Novo
          </button>
        </div>
      </div>
      <ConfigPanel open={configOpen} onClose={() => setConfigOpen(false)} />
      <StampExport open={stampOpen} onClose={() => setStampOpen(false)} />
    </header>
  );
}
