import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useProject } from "../state/ProjectContext";
import brandSrc from "../../img/brand/logo-stamp.png";
import {
  canvasToPdfBlob,
  canvasToPngBlob,
  composeStampSheet,
  downloadBlob,
  todayPtBr,
} from "../engine/stampExport";
import { HelpTip } from "./HelpTip";

/**
 * Formulário da etiqueta — preenchimento manual (como na versão original do carimbo).
 * Leitura de rodapé Earth / OSM fica no card Local · Motor solar, não aqui.
 */
export function StampExport({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, updateEtiqueta } = useProject();
  const [busy, setBusy] = useState<"png" | "pdf" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const logoRef = useRef<HTMLInputElement>(null);
  const e = state.etiqueta;

  useEffect(() => {
    if (open && !e.data) updateEtiqueta({ data: todayPtBr() });
  }, [open, e.data, updateEtiqueta]);

  if (!open) return null;

  const modules = state.layout?.best.modules ?? [];
  const qty = modules.length > 0 ? modules.length : state.module.quantity_target;
  const power = (qty * state.module.power_w) / 1000;
  const fileBase = (state.persist.name || "projeto-solar").replace(/[^\w\-]+/g, "_");

  const generate = async (kind: "png" | "pdf") => {
    setBusy(kind);
    setError(null);
    try {
      const canvas = await composeStampSheet({
        ...state,
        etiqueta: { ...e, data: e.data || todayPtBr() },
      });
      if (kind === "png") {
        downloadBlob(await canvasToPngBlob(canvas), `${fileBase}.png`);
      } else {
        downloadBlob(canvasToPdfBlob(canvas), `${fileBase}.pdf`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível gerar o arquivo.");
    } finally {
      setBusy(null);
    }
  };

  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal stamp-modal" onClick={(ev) => ev.stopPropagation()}>
        <h2>
          Gerar arquivo
          <HelpTip>
            Preencha a etiqueta. Os dados entram no JSON do projeto (autosave / Salvar) para revisão depois.
            Em projeto novo o cliente vem em branco. Salve PNG ou PDF.
          </HelpTip>
        </h2>
        <p className="lead">Dados do cliente na etiqueta. Salvos no JSON do projeto; novo cliente começa vazio.</p>

        <div className="stamp-grid">
          <div className="stamp-form">
            <label className="field">
              título
              <input value={e.titulo} onChange={(ev) => updateEtiqueta({ titulo: ev.target.value })} />
            </label>
            <label className="field">
              cliente
              <input
                value={e.cliente}
                onChange={(ev) => updateEtiqueta({ cliente: ev.target.value })}
                placeholder="Nome do cliente"
              />
            </label>
            <label className="field">
              endereço
              <input
                value={e.endereco}
                onChange={(ev) => updateEtiqueta({ endereco: ev.target.value })}
                placeholder="Rua, número"
              />
            </label>
            <div className="row">
              <label className="field">
                bairro
                <input value={e.bairro} onChange={(ev) => updateEtiqueta({ bairro: ev.target.value })} />
              </label>
              <label className="field">
                cidade
                <input value={e.cidade} onChange={(ev) => updateEtiqueta({ cidade: ev.target.value })} />
              </label>
            </div>
            <label className="field">
              data
              <input value={e.data} onChange={(ev) => updateEtiqueta({ data: ev.target.value })} />
            </label>
            <label className="field">
              responsável
              <input
                value={e.responsavel}
                onChange={(ev) => updateEtiqueta({ responsavel: ev.target.value })}
                placeholder="Nome do responsável técnico"
              />
            </label>
            <label className="field">
              empresa
              <input value={e.empresa} onChange={(ev) => updateEtiqueta({ empresa: ev.target.value })} />
            </label>
            <label className="field">
              slogan
              <input value={e.slogan} onChange={(ev) => updateEtiqueta({ slogan: ev.target.value })} />
            </label>
            <div className="btn-row">
              <button className="btn ghost" type="button" onClick={() => logoRef.current?.click()}>
                {e.logo_src ? "Trocar logo" : "Trocar logo (opcional)"}
              </button>
              {e.logo_src && (
                <button className="btn danger" type="button" onClick={() => updateEtiqueta({ logo_src: null })}>
                  Remover logo
                </button>
              )}
            </div>
            <input
              ref={logoRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(ev) => {
                const file = ev.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => updateEtiqueta({ logo_src: String(reader.result) });
                reader.readAsDataURL(file);
              }}
            />
          </div>

          <div className="stamp-preview-col">
            <div className="stamp-card stamp-data">
              <strong>{e.titulo || "PROJEÇÃO DE IMPLANTAÇÃO"}</strong>
              <span>
                {qty} MÓDULOS {state.module.brand} {state.module.power_w} W
              </span>
              <div className="stamp-cols">
                <div>
                  <small>Potência por módulo</small>
                  <b>{state.module.power_w} W</b>
                </div>
                <div>
                  <small>Potência total</small>
                  <b>
                    {power.toLocaleString("pt-BR", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}{" "}
                    kWp
                  </b>
                </div>
                <div>
                  <small>Quantidade</small>
                  <b>{qty} módulos</b>
                </div>
              </div>
            </div>
            <div className="stamp-card stamp-label">
              <small>ETIQUETA DO PROJETO</small>
              <p>
                <b>Cliente</b> {e.cliente || "—"}
              </p>
              <p>
                <b>Endereço</b> {e.endereco || "—"}
              </p>
              <p>
                <b>Bairro</b> {e.bairro || "—"}
              </p>
              <p>
                <b>Cidade</b> {e.cidade || "—"}
              </p>
              <p>
                <b>Data</b> {e.data || todayPtBr()}
              </p>
              <p>
                <b>Responsável</b> {e.responsavel || "—"}
              </p>
            </div>
            <div className="stamp-brand">
              {e.logo_src ? <img src={e.logo_src} alt="Logo" /> : <img src={brandSrc} alt="PIENG" />}
            </div>
          </div>
        </div>

        {error && (
          <p className="hint" style={{ color: "var(--chip-bad)" }}>
            {error}
          </p>
        )}
        <div className="btn-row" style={{ marginTop: 14 }}>
          <button
            className="btn primary"
            type="button"
            disabled={Boolean(busy) || !state.image}
            onClick={() => void generate("png")}
          >
            {busy === "png" ? "Gerando…" : "Salvar figura"}
          </button>
          <button
            className="btn primary"
            type="button"
            disabled={Boolean(busy) || !state.image}
            onClick={() => void generate("pdf")}
          >
            {busy === "pdf" ? "Gerando…" : "Salvar PDF"}
          </button>
          <button className="btn ghost" type="button" onClick={onClose}>
            Fechar
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
