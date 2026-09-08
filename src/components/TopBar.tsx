import { useEffect, useRef, useState } from "react";
import { useProject } from "../state/ProjectContext";
import type { Step } from "../types";
import { applyTheme, readTheme, type AppTheme } from "../theme";
import { APP_VERSION_LABEL } from "../lib/appVersion";
import { togglePremium, usePremium } from "../lib/premium";
import { ConfigPanel } from "./ConfigPanel";

const STEPS: Array<{ id: Step; n: number; label: string }> = [
  { id: "import", n: 1, label: "Importar" },
  { id: "edit", n: 2, label: "Editar" },
  { id: "scale", n: 3, label: "Calibrar" },
  { id: "draw", n: 4, label: "Telhado" },
  { id: "layout", n: 5, label: "Usina" },
  { id: "shadow", n: 6, label: "Sombreamento" },
  { id: "export", n: 7, label: "Gerar arquivo" },
];

export function TopBar() {
  const { state, setStep, saveProject, newProject, setProjectName, undo, redo, canUndo, canRedo, applyPiengBridge } =
    useProject();
  const [configOpen, setConfigOpen] = useState(false);
  const [theme, setTheme] = useState<AppTheme>(readTheme);
  const premium = usePremium();
  const piengFileRef = useRef<HTMLInputElement>(null);
  const order: Step[] = ["import", "edit", "scale", "draw", "layout", "shadow", "export"];
  const current = order.indexOf(state.step);

  // Sol OFF: sai do módulo de sombreamento (só ativo com a flag premium).
  useEffect(() => {
    if (!premium && state.step === "shadow") setStep("layout");
  }, [premium, state.step, setStep]);

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
          <h1>
            PlanoSol <span className="app-version" title="Versão do app">{APP_VERSION_LABEL}</span>
          </h1>
          <small>PIENG Soluções Energéticas</small>
        </div>
      </div>
      <nav className="steps">
        {STEPS.map((s, i) => {
          const premiumLocked = s.id === "shadow" && !premium;
          const cls =
            s.id === state.step
              ? "step active"
              : premiumLocked
                ? "step premium-off"
                : i < current
                  ? "step done"
                  : "step";
          const locked = (s.id === "edit" || s.id === "scale") && !state.image;
          const locked2 = s.id === "draw" && !state.scale.calibrated;
          const locked3 = s.id === "layout" && !state.areas.length;
          const locked4 = premiumLocked || (s.id === "shadow" && !state.layout);
          const locked5 = s.id === "export" && !state.image;
          return (
            <button
              key={s.id}
              className={cls}
              disabled={locked || locked2 || locked3 || locked4 || locked5}
              title={
                premiumLocked
                  ? "Ative ☀ Sol ON para liberar a análise de sombreamento (teste interno)"
                  : s.id === "shadow" && !state.layout
                    ? "Gere a usina (passo 5) antes da análise de sombreamento"
                    : s.id === "export" && !state.image
                      ? "Importe a figura antes de gerar o arquivo"
                      : undefined
              }
              onClick={() => setStep(s.id)}
            >
              <b>{s.n}</b>
              <span className="step-label">{s.label}</span>
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

        <button
          className={`btn toolbar-seg ${premium ? "on" : ""}`}
          type="button"
          title="TEMPORÁRIO (teste interno): liga/desliga o módulo premium de sombreamento nesta máquina"
          onClick={() => togglePremium()}
        >
          ☀ Sol {premium ? "ON" : "OFF"}
        </button>

        <span className="toolbar-sep" aria-hidden="true" />

        <div className="toolbar-project">
          <input
            value={state.persist?.name ?? ""}
            onChange={(e) => setProjectName(e.target.value)}
            placeholder="Nome do projeto"
            aria-label="Nome do projeto"
          />
          <button
            className="btn primary"
            disabled={!state.image || state.busy}
            title="PC: pasta projetos · Nuvem: baixa .planosol.json (local / Drive Desktop)"
            onClick={() => void saveProject()}
          >
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
            title="Importar JSON do Gerador PIENG (módulo + etiqueta)"
            onClick={() => piengFileRef.current?.click()}
          >
            PIENG JSON
          </button>
          <button
            className="btn ghost quiet toolbar-gear"
            type="button"
            title="Configurar"
            aria-label="Configurar"
            onClick={() => setConfigOpen(true)}
          >
            <span aria-hidden="true">⚙</span>
          </button>
          <button className="btn ghost quiet" title="Novo projeto" onClick={() => void newProject()}>
            Novo
          </button>
        </div>
      </div>
      <ConfigPanel open={configOpen} onClose={() => setConfigOpen(false)} />
    </header>
  );
}
