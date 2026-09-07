import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useProject } from "../state/ProjectContext";
import type { AppDefaults, ModuleOrientation } from "../types";
import {
  downloadModuleCatalogJson,
  emptyCatalogDraft,
  resetModuleCatalogToBundled,
  saveModuleCatalog,
  slugCatalogId,
  useModuleCatalog,
  type CatalogModule,
  type ModuleCatalogFile,
} from "../lib/moduleCatalog";

export function ConfigPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { defaults, saveAppDefaults } = useProject();
  const liveCatalog = useModuleCatalog();
  const [draft, setDraft] = useState<AppDefaults>(defaults);
  const [catalogDraft, setCatalogDraft] = useState<ModuleCatalogFile>(liveCatalog);
  const [editing, setEditing] = useState<CatalogModule | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [busy, setBusy] = useState(false);
  const [catalogBusy, setCatalogBusy] = useState(false);
  const [catalogNotice, setCatalogNotice] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setDraft(defaults);
      setCatalogDraft(liveCatalog);
      setEditing(null);
      setIsNew(false);
      setCatalogNotice(null);
    }
  }, [open, defaults, liveCatalog]);

  const sorted = useMemo(
    () => [...catalogDraft.modules].sort((a, b) => b.power_w - a.power_w || a.brand.localeCompare(b.brand)),
    [catalogDraft.modules],
  );

  if (!open) return null;

  const patch = (partial: Partial<AppDefaults>) => setDraft((d) => ({ ...d, ...partial }));

  const startNew = () => {
    setIsNew(true);
    setEditing(emptyCatalogDraft());
  };

  const startEdit = (m: CatalogModule) => {
    setIsNew(false);
    setEditing(emptyCatalogDraft(m));
  };

  const removeModule = (id: string) => {
    if (catalogDraft.modules.length <= 1) {
      setCatalogNotice("Mantenha ao menos um módulo no catálogo.");
      return;
    }
    if (!window.confirm("Excluir este módulo do catálogo?")) return;
    const modules = catalogDraft.modules.filter((m) => m.id !== id);
    setCatalogDraft({
      default_id: catalogDraft.default_id === id ? modules[0].id : catalogDraft.default_id,
      modules,
    });
    if (editing?.id === id) {
      setEditing(null);
      setIsNew(false);
    }
  };

  const applyEditor = () => {
    if (!editing) return;
    const brand = editing.brand.trim();
    const model = editing.model.trim();
    if (!brand || !model) {
      setCatalogNotice("Informe marca e modelo.");
      return;
    }
    const id = (editing.id.trim() || slugCatalogId(brand, editing.power_w)).toLowerCase();
    const row: CatalogModule = {
      ...editing,
      id,
      brand,
      model,
      power_w: Math.max(1, Number(editing.power_w) || 1),
      width_m: Math.max(0.1, Number(editing.width_m) || 1),
      height_m: Math.max(0.1, Number(editing.height_m) || 1),
      thickness_m: Math.max(0.001, Number(editing.thickness_m) || 0.03),
      gap_m: Math.max(0, Number(editing.gap_m) || 0),
      notes: editing.notes?.trim() || undefined,
    };
    const exists = catalogDraft.modules.some((m) => m.id === id);
    if (isNew && exists) {
      setCatalogNotice(`Já existe o id «${id}». Edite o item ou mude a marca/potência.`);
      return;
    }
    const modules = isNew
      ? [...catalogDraft.modules, row]
      : catalogDraft.modules.map((m) => (m.id === editing.id || m.id === id ? row : m));
    // se renomeou id
    const cleaned = isNew
      ? modules
      : modules.filter((m, i, arr) => arr.findIndex((x) => x.id === m.id) === i);
    setCatalogDraft({
      default_id: catalogDraft.default_id === editing.id ? row.id : catalogDraft.default_id,
      modules: cleaned,
    });
    setEditing(null);
    setIsNew(false);
    setCatalogNotice(null);
  };

  const saveCatalog = async () => {
    setCatalogBusy(true);
    setCatalogNotice(null);
    try {
      const result = await saveModuleCatalog(catalogDraft);
      setCatalogDraft(result.catalog);
      setCatalogNotice(result.message);
    } catch (err) {
      setCatalogNotice(err instanceof Error ? err.message : "Falha ao gravar catálogo.");
    } finally {
      setCatalogBusy(false);
    }
  };

  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <h2>Configurar</h2>
        <p className="lead">
          Padrões em <b>defaults.json</b>. Catálogo de módulos em <b>module_catalog.json</b> (no PC) e neste
          navegador na nuvem.
        </p>

        <h3 className="modal-section-title">Padrões do projeto</h3>
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
              type="button"
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
        <div className="btn-row" style={{ marginTop: 12 }}>
          <button
            className="btn primary"
            type="button"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              void saveAppDefaults(draft).finally(() => setBusy(false));
            }}
          >
            Gravar padrões
          </button>
        </div>

        <h3 className="modal-section-title">Catálogo de módulos</h3>
        <p className="hint">
          CRUD da lista usada na Usina. No PC grava <code className="mono">module_catalog.json</code>. Na nuvem
          grava neste navegador; use «Baixar JSON» e faça commit no repo para o deploy.
        </p>

        <div className="catalog-list">
          {sorted.map((m) => (
            <div key={m.id} className={`catalog-row ${catalogDraft.default_id === m.id ? "is-default" : ""}`}>
              <div>
                <strong>
                  {m.brand} {m.model}
                </strong>
                <span>
                  {m.power_w} W · {m.width_m.toFixed(3)}×{m.height_m.toFixed(3)} m · vão {m.gap_m} m
                </span>
                {catalogDraft.default_id === m.id && <em>padrão</em>}
              </div>
              <div className="catalog-row-actions">
                <button
                  type="button"
                  className="btn ghost btn-xs"
                  onClick={() => setCatalogDraft((c) => ({ ...c, default_id: m.id }))}
                >
                  Padrão
                </button>
                <button type="button" className="btn ghost btn-xs" onClick={() => startEdit(m)}>
                  Editar
                </button>
                <button type="button" className="btn danger btn-xs" onClick={() => removeModule(m.id)}>
                  Excluir
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="btn-row" style={{ marginTop: 8 }}>
          <button type="button" className="btn ghost" onClick={startNew}>
            Novo módulo
          </button>
          <button type="button" className="btn ghost" onClick={() => downloadModuleCatalogJson(catalogDraft)}>
            Baixar JSON
          </button>
          <button
            type="button"
            className="btn ghost"
            onClick={() => {
              const next = resetModuleCatalogToBundled();
              setCatalogDraft(next);
              setCatalogNotice("Catálogo restaurado ao JSON embutido do build.");
            }}
          >
            Restaurar build
          </button>
        </div>

        {editing && (
          <div className="catalog-editor">
            <h4>{isNew ? "Novo módulo" : "Editar módulo"}</h4>
            <div className="row">
              <label className="field">
                marca
                <input
                  value={editing.brand}
                  onChange={(e) => setEditing({ ...editing, brand: e.target.value })}
                />
              </label>
              <label className="field">
                modelo
                <input
                  value={editing.model}
                  onChange={(e) => setEditing({ ...editing, model: e.target.value })}
                />
              </label>
            </div>
            <div className="row">
              <label className="field">
                potência (W)
                <input
                  type="number"
                  min={1}
                  value={editing.power_w}
                  onChange={(e) => setEditing({ ...editing, power_w: Number(e.target.value) })}
                />
              </label>
              <label className="field">
                id
                <input
                  value={editing.id}
                  placeholder={slugCatalogId(editing.brand || "marca", editing.power_w || 0)}
                  onChange={(e) => setEditing({ ...editing, id: e.target.value })}
                />
              </label>
            </div>
            <div className="row">
              <label className="field">
                largura (m)
                <input
                  type="number"
                  min={0.1}
                  step={0.001}
                  value={editing.width_m}
                  onChange={(e) => setEditing({ ...editing, width_m: Number(e.target.value) })}
                />
              </label>
              <label className="field">
                altura (m)
                <input
                  type="number"
                  min={0.1}
                  step={0.001}
                  value={editing.height_m}
                  onChange={(e) => setEditing({ ...editing, height_m: Number(e.target.value) })}
                />
              </label>
            </div>
            <div className="row">
              <label className="field">
                espessura (m)
                <input
                  type="number"
                  min={0.001}
                  step={0.001}
                  value={editing.thickness_m}
                  onChange={(e) => setEditing({ ...editing, thickness_m: Number(e.target.value) })}
                />
              </label>
              <label className="field">
                vão (m)
                <input
                  type="number"
                  min={0}
                  step={0.005}
                  value={editing.gap_m}
                  onChange={(e) => setEditing({ ...editing, gap_m: Number(e.target.value) })}
                />
              </label>
            </div>
            <label className="field">
              notas
              <input
                value={editing.notes ?? ""}
                onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
              />
            </label>
            <div className="btn-row">
              <button
                type="button"
                className="btn ghost"
                onClick={() => {
                  setEditing(null);
                  setIsNew(false);
                }}
              >
                Cancelar
              </button>
              <button type="button" className="btn primary" onClick={applyEditor}>
                Aplicar no rascunho
              </button>
            </div>
          </div>
        )}

        {catalogNotice && <p className="hint catalog-notice">{catalogNotice}</p>}

        <div className="btn-row" style={{ marginTop: 12 }}>
          <button className="btn ghost" type="button" onClick={onClose}>
            Fechar
          </button>
          <button className="btn primary" type="button" disabled={catalogBusy} onClick={() => void saveCatalog()}>
            {catalogBusy ? "Gravando…" : "Gravar catálogo"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
