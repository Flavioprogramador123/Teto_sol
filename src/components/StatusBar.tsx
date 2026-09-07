import { useProject } from "../state/ProjectContext";
import { APP_VERSION_LABEL } from "../lib/appVersion";

export function StatusBar() {
  const { state } = useProject();
  const violations = state.layout?.best.modules.filter((m) => m.violation).length ?? 0;
  const persist = state.persist;
  return (
    <footer className="statusbar">
      <span className="statusbar-version" title="Versão do PlanoSol">
        {APP_VERSION_LABEL}
      </span>
      <span>
        Imagem <em>{state.image ? `${state.image.file} ${state.image.width_px}×${state.image.height_px}` : "nenhuma"}</em>
      </span>
      <span>
        Escala <em>{state.scale.calibrated ? `${state.scale.pixels_per_meter.toFixed(1)} px/m` : "não calibrada"}</em>
      </span>
      <span>
        Áreas <em>{state.areas.length}</em>
      </span>
      <span>
        Restritas <em>{state.obstacles.length}</em>
      </span>
      <span>
        Módulos <em>{state.layout ? `${state.layout.installed}/${state.layout.requested}` : "—"}</em>
      </span>
      <span>
        Disco{" "}
        <em>
          {persist?.last_saved_at
            ? `salvo ${new Date(persist.last_saved_at).toLocaleTimeString("pt-BR")}`
            : persist?.last_temp_at
              ? `.temp ${new Date(persist.last_temp_at).toLocaleTimeString("pt-BR")}`
              : "ainda não gravado"}
        </em>
      </span>
      {violations > 0 && (
        <span style={{ color: "#ffb4ae" }}>
          Violações manuais <em>{violations}</em>
        </span>
      )}
    </footer>
  );
}
