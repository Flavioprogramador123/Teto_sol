import { useEffect, useState } from "react";
import { persistStatus, type PersistStatus } from "../persist/client";
import { useProject } from "../state/ProjectContext";
import { HelpTip } from "./HelpTip";

export function PersistLibrary() {
  const { openSaved, restoreSession } = useProject();
  const [info, setInfo] = useState<PersistStatus | null>(null);
  const [opening, setOpening] = useState<string | null>(null);

  const refresh = () => {
    void persistStatus().then(setInfo).catch(() => setInfo(null));
  };

  useEffect(() => {
    refresh();
  }, []);

  const open = async (scope: "projetos" | "historico", id: string) => {
    setOpening(id);
    try {
      await openSaved(scope, id);
      refresh();
    } finally {
      setOpening(null);
    }
  };

  if (!info) {
    return (
      <div className="card">
        <h3>
          Arquivos salvos
          <HelpTip>Lista rascunhos em .temp e projetos gravados na pasta projetos.</HelpTip>
        </h3>
        <p className="hint">Lendo .temp e projetos…</p>
      </div>
    );
  }

  return (
    <>
      <div className="card">
        <h3>
          Rascunho automático
          <HelpTip>
            Ao soltar a imagem, uma cópia vai para .temp. Se recomeçar, o rascunho anterior vai para .temp/historico. Continuar rascunho reabre o último.
          </HelpTip>
        </h3>
        <p className="hint">
          Ao soltar a imagem, uma cópia vai para <code className="mono">.temp</code>. Se precisar recomeçar, o
          rascunho anterior vai para <code className="mono">.temp/historico</code>.
        </p>
        {info.temp.exists ? (
          <>
            <p className="hint">Último rascunho: {new Date(info.temp.updatedAt ?? "").toLocaleString("pt-BR")}</p>
            <button className="btn primary" onClick={() => void restoreSession()}>
              Continuar rascunho
            </button>
          </>
        ) : (
          <p className="hint">Nenhum rascunho ainda.</p>
        )}
      </div>
      <div className="card">
        <h3>
          Projetos salvos
          <HelpTip>Use Salvar na barra de cima. Os arquivos ficam em projetos e, se possível, em Imagens/PlanoSol.</HelpTip>
        </h3>
        <p className="hint">
          Pasta <code className="mono">projetos</code>
          {info.folders.imagens ? <> e <code className="mono">Imagens/PlanoSol</code></> : null}.
        </p>
        {!info.projetos.length && <p className="hint">Nenhum projeto salvo ainda. Use Salvar na barra de cima.</p>}
        {info.projetos.map((p) => (
          <button
            key={p.id}
            className="btn ghost"
            style={{ marginBottom: 6 }}
            disabled={opening === p.id}
            onClick={() => void open("projetos", p.id)}
          >
            {opening === p.id ? "Abrindo…" : p.name}
            <small style={{ display: "block", color: "var(--muted)" }}>
              {new Date(p.updatedAt).toLocaleString("pt-BR")}
            </small>
          </button>
        ))}
      </div>
      {info.historico.length > 0 && (
        <div className="card">
          <h3>
            Histórico de recomeços
            <HelpTip>Cópias antigas guardadas quando você começou um projeto novo. Clique para reabrir.</HelpTip>
          </h3>
          {info.historico.slice(0, 6).map((p) => (
            <button
              key={p.id}
              className="btn ghost"
              style={{ marginBottom: 6 }}
              disabled={Boolean(opening)}
              onClick={() => void open("historico", p.id)}
            >
              {opening === p.id ? "Abrindo…" : p.name || p.id}
              <small style={{ display: "block", color: "var(--muted)" }}>
                {p.id}
                {" · "}
                {new Date(p.updatedAt).toLocaleString("pt-BR")}
              </small>
            </button>
          ))}
        </div>
      )}
    </>
  );
}
