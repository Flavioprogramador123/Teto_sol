import { useCallback, useEffect, useRef, useState } from "react";
import { persistApiAvailable, persistStatus, type PersistStatus } from "../persist/client";
import { MAX_BROWSER_DRAFTS, type BrowserDraftMeta } from "../persist/browserDrafts";
import { useProject } from "../state/ProjectContext";
import { HelpTip } from "./HelpTip";

export function PersistLibrary() {
  const {
    openSaved,
    restoreSession,
    listBrowserDrafts,
    openBrowserDraft,
    deleteBrowserDraft,
    importProjectFile,
    downloadProjectFile,
    state,
  } = useProject();
  const [info, setInfo] = useState<PersistStatus | null>(null);
  const [cloudMode, setCloudMode] = useState(false);
  const [drafts, setDrafts] = useState<BrowserDraftMeta[]>([]);
  const [opening, setOpening] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const refreshDrafts = useCallback(() => {
    void listBrowserDrafts().then(setDrafts).catch(() => setDrafts([]));
  }, [listBrowserDrafts]);

  const refresh = useCallback(() => {
    void persistApiAvailable().then((ok) => {
      if (!ok) {
        setCloudMode(true);
        setInfo(null);
        refreshDrafts();
        return;
      }
      setCloudMode(false);
      void persistStatus()
        .then(setInfo)
        .catch(() => {
          setCloudMode(true);
          setInfo(null);
        });
      refreshDrafts();
    });
  }, [refreshDrafts]);

  useEffect(() => {
    refresh();
  }, [refresh, state.persist.last_temp_at, state.persist.last_saved_id]);

  const open = async (scope: "projetos" | "historico", id: string) => {
    setOpening(id);
    try {
      await openSaved(scope, id);
      refresh();
    } finally {
      setOpening(null);
    }
  };

  const openDraft = async (id: string) => {
    setOpening(id);
    try {
      await openBrowserDraft(id);
      refreshDrafts();
    } finally {
      setOpening(null);
    }
  };

  return (
    <>
      <div className="card import-card">
        <h3>
          Projeto portátil
          <HelpTip>
            Baixe o .planosol.json na pasta local ou no Google Drive Desktop. Em outra máquina, abra o mesmo arquivo no
            PlanoSol e continue. O desenho final (PNG/PDF) também pode ser gerado na nuvem.
          </HelpTip>
        </h3>
        <p className="hint">
          Qualquer usuário / qualquer PC: trabalhe aqui, use <b>Salvar</b> (baixa o arquivo) e depois <b>Abrir
          .planosol.json</b>. Se precisar alterar, reabra o arquivo na máquina atual.
        </p>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json,.planosol.json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void importProjectFile(f).then(() => refreshDrafts());
            e.target.value = "";
          }}
        />
        <div className="btn-row side-actions">
          <button className="btn primary" type="button" disabled={!state.image || state.busy} onClick={() => void downloadProjectFile()}>
            Baixar .planosol.json
          </button>
          <button className="btn ghost" type="button" disabled={state.busy} onClick={() => fileRef.current?.click()}>
            Abrir .planosol.json
          </button>
        </div>
      </div>

      <div className="card import-card">
        <h3>
          Rascunhos neste navegador
          <HelpTip>
            Até {MAX_BROWSER_DRAFTS} rascunhos automáticos neste aparelho/navegador (IndexedDB). Não substitui o arquivo
            .planosol.json para levar a outro PC.
          </HelpTip>
        </h3>
        {!drafts.length ? (
          <p className="hint">Nenhum rascunho ainda. Importe uma imagem — o autosave guarda até {MAX_BROWSER_DRAFTS} aqui.</p>
        ) : (
          drafts.map((d) => (
            <div key={d.id} className="catalog-row" style={{ marginBottom: 6 }}>
              <div>
                <strong>{d.name}</strong>
                <span>
                  {new Date(d.updatedAt).toLocaleString("pt-BR")} · etapa {d.step}
                  {!d.hasImage ? " · sem imagem" : ""}
                </span>
              </div>
              <div className="catalog-row-actions">
                <button
                  type="button"
                  className="btn ghost btn-xs"
                  disabled={opening === d.id || state.busy}
                  onClick={() => void openDraft(d.id)}
                >
                  Abrir
                </button>
                <button
                  type="button"
                  className="btn danger btn-xs"
                  disabled={state.busy}
                  onClick={() => {
                    if (window.confirm(`Remover rascunho «${d.name}» deste navegador?`)) {
                      void deleteBrowserDraft(d.id).then(() => refreshDrafts());
                    }
                  }}
                >
                  Excluir
                </button>
              </div>
            </div>
          ))
        )}
        {cloudMode && (
          <p className="hint" style={{ marginTop: 8 }}>
            Modo nuvem: pasta .temp do PC não existe aqui. Use o arquivo .planosol.json para levar o projeto.
          </p>
        )}
      </div>

      {!cloudMode && info && (
        <>
          <div className="card import-card">
            <h3>
              Rascunho automático (.temp)
              <HelpTip>
                Ao soltar a imagem, uma cópia vai para .temp. Continuar rascunho reabre o último.
              </HelpTip>
            </h3>
            {info.temp.exists ? (
              <>
                <p className="hint">Último rascunho: {new Date(info.temp.updatedAt ?? "").toLocaleString("pt-BR")}</p>
                <button className="btn primary" type="button" onClick={() => void restoreSession()}>
                  Continuar rascunho
                </button>
              </>
            ) : (
              <p className="hint">Nenhum rascunho em .temp ainda.</p>
            )}
          </div>
          <div className="card import-card">
            <h3>
              Projetos salvos (PC)
              <HelpTip>Use Salvar na barra de cima. Os arquivos ficam em projetos.</HelpTip>
            </h3>
            {!info.projetos.length && <p className="hint">Nenhum projeto na pasta projetos.</p>}
            {info.projetos.map((p) => (
              <button
                key={p.id}
                className="btn ghost"
                style={{ marginBottom: 6 }}
                disabled={opening === p.id}
                type="button"
                onClick={() => void open("projetos", p.id)}
              >
                {p.name} · {new Date(p.updatedAt).toLocaleString("pt-BR")}
              </button>
            ))}
          </div>
        </>
      )}

      {!cloudMode && !info && (
        <div className="card import-card">
          <h3>Arquivos salvos</h3>
          <p className="hint">Lendo .temp e projetos…</p>
        </div>
      )}
    </>
  );
}
