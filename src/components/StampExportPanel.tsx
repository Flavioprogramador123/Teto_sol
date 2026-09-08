import { useEffect, useRef, useState } from "react";
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
 * Passo 7 — barra enxuta: etiqueta + Visualizar + PNG/PDF.
 * Posição/tamanho dos blocos (Projeção, Ticket, Logo, Bússola) = caixas flutuantes na figura.
 */
export function StampExportPanel() {
  const { state, updateEtiqueta, setNotice, setStep, refreshStampPreview, resetStampLayout } = useProject();
  const [busy, setBusy] = useState<"png" | "pdf" | "preview" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const logoRef = useRef<HTMLInputElement>(null);
  const e = state.etiqueta;
  const ready = Boolean(state.stamp_ready && state.stamp_pieces);

  useEffect(() => {
    if (!e.data) updateEtiqueta({ data: todayPtBr() });
  }, [e.data, updateEtiqueta]);

  const modules = state.layout?.best.modules ?? [];
  const qty = modules.length > 0 ? modules.length : state.module.quantity_target;
  const power = (qty * state.module.power_w) / 1000;
  const fileBase = (state.persist.name || "projeto-solar").replace(/[^\w\-]+/g, "_");

  const onVisualizar = async () => {
    setBusy("preview");
    setError(null);
    try {
      if (!state.scale.heading) {
        setError("Trace a direção do imóvel (calibração) para incluir a bússola do projeto.");
      }
      await refreshStampPreview();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao visualizar.");
    } finally {
      setBusy(null);
    }
  };

  const generate = async (kind: "png" | "pdf") => {
    if (!ready) {
      setError("Clique em Visualizar antes de gerar o arquivo.");
      return;
    }
    setBusy(kind);
    setError(null);
    try {
      const canvas = await composeStampSheet({
        ...state,
        etiqueta: { ...e, data: e.data || todayPtBr() },
      });
      if (kind === "png") downloadBlob(await canvasToPngBlob(canvas), `${fileBase}.png`);
      else downloadBlob(canvasToPdfBlob(canvas), `${fileBase}.pdf`);
      setNotice(`Arquivo ${kind.toUpperCase()} gerado.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível gerar o arquivo.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <h2>7 · Gerar arquivo</h2>
      <p className="lead">
        Na figura: as caixas flutuantes (Projeção, Ticket, Logo, Bússola) se movem sozinhas — o mapa só com Alt ou clique no vazio.
        View bússola liga/desliga a bússola. Depois <b>Visualizar</b> e PNG/PDF.
      </p>

      {ready ? (
        <span className="chip ok">Blocos formados — pode ajustar na figura e gerar</span>
      ) : (
        <span className="chip">Ajuste as caixas na figura → Visualizar</span>
      )}

      <div className="card" style={{ marginTop: 12 }}>
        <h3>
          Etiqueta
          <HelpTip>Dados do cliente no ticket. A bússola no arquivo é a mesma rosa do projeto (direção do imóvel).</HelpTip>
        </h3>
        <div className="stamp-form">
          <label className="field">
            Título
            <input value={e.titulo} onChange={(ev) => updateEtiqueta({ titulo: ev.target.value })} />
          </label>
          <label className="field">
            Cliente
            <input value={e.cliente} onChange={(ev) => updateEtiqueta({ cliente: ev.target.value })} />
          </label>
          <label className="field">
            Endereço
            <input value={e.endereco} onChange={(ev) => updateEtiqueta({ endereco: ev.target.value })} />
          </label>
          <div className="row">
            <label className="field">
              Bairro
              <input value={e.bairro} onChange={(ev) => updateEtiqueta({ bairro: ev.target.value })} />
            </label>
            <label className="field">
              Cidade
              <input value={e.cidade} onChange={(ev) => updateEtiqueta({ cidade: ev.target.value })} />
            </label>
          </div>
          <div className="row">
            <label className="field">
              Data
              <input value={e.data} onChange={(ev) => updateEtiqueta({ data: ev.target.value })} />
            </label>
            <label className="field">
              Responsável
              <input value={e.responsavel} onChange={(ev) => updateEtiqueta({ responsavel: ev.target.value })} />
            </label>
          </div>
          <label className="field">
            Empresa
            <input value={e.empresa} onChange={(ev) => updateEtiqueta({ empresa: ev.target.value })} />
          </label>
          <label className="field">
            Texto ao lado do logo
            <textarea
              rows={2}
              value={e.slogan}
              placeholder="Energia solar para um futuro mais sustentável!"
              onChange={(ev) => updateEtiqueta({ slogan: ev.target.value })}
            />
          </label>
          <div className="btn-row" style={{ marginTop: 4 }}>
            <button
              className="btn ghost"
              type="button"
              title="Copia o nome do cliente para o texto do logo"
              disabled={!e.cliente.trim()}
              onClick={() => updateEtiqueta({ slogan: e.cliente.trim() })}
            >
              Usar nome do cliente
            </button>
            <button
              className="btn ghost"
              type="button"
              onClick={() =>
                updateEtiqueta({ slogan: "Energia solar para um futuro mais sustentável!" })
              }
            >
              Restaurar slogan
            </button>
          </div>
          <div className="btn-row" style={{ marginTop: 8 }}>
            <button className="btn ghost" type="button" onClick={() => logoRef.current?.click()}>
              {e.logo_src ? "Trocar logo" : "Enviar logo"}
            </button>
            {e.logo_src && (
              <button className="btn danger" type="button" onClick={() => updateEtiqueta({ logo_src: null })}>
                Remover
              </button>
            )}
          </div>
          <label className="layer-toggle" style={{ marginTop: 8, display: "flex" }}>
            <input
              type="checkbox"
              checked={e.logo_white_bg !== false}
              onChange={(ev) => updateEtiqueta({ logo_white_bg: ev.target.checked })}
            />
            Fundo branco no logo
          </label>
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
          <div
            className="stamp-brand"
            style={{
              marginTop: 10,
              background: e.logo_white_bg !== false ? "#fff" : "rgba(8,16,28,0.92)",
              padding: 8,
              borderRadius: 8,
            }}
          >
            {e.logo_src ? <img src={e.logo_src} alt="Logo" /> : <img src={brandSrc} alt="PIENG" />}
          </div>
          <p className="hint" style={{ marginTop: 8 }}>
            {qty} módulos · {power.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} kWp
          </p>
        </div>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <h3>Visualizar e gerar</h3>
        {error && (
          <p className="hint" style={{ color: "#e05a4f" }}>
            {error}
          </p>
        )}
        <button
          className="btn primary"
          style={{ width: "100%" }}
          disabled={!state.image || busy !== null || state.busy}
          onClick={() => void onVisualizar()}
        >
          {busy === "preview" || state.busy ? "Formando…" : "Visualizar"}
        </button>
        <div className="btn-row" style={{ marginTop: 10 }}>
          <button className="btn ghost" disabled={!ready || busy !== null} onClick={() => void generate("png")}>
            {busy === "png" ? "Gerando…" : "Baixar PNG"}
          </button>
          <button className="btn ghost" disabled={!ready || busy !== null} onClick={() => void generate("pdf")}>
            {busy === "pdf" ? "Gerando…" : "Baixar PDF"}
          </button>
        </div>
        <button className="btn ghost" style={{ marginTop: 10, width: "100%" }} type="button" onClick={() => resetStampLayout()}>
          Restaurar posições
        </button>
        <button className="btn ghost" style={{ marginTop: 8, width: "100%" }} onClick={() => setStep("layout")}>
          Voltar para a usina
        </button>
      </div>
    </>
  );
}
