import { useEffect, useMemo, useState } from "react";
import { modulePolygon } from "../engine/geometry";
import { formatDm, parseCoordInput } from "../engine/georef";
import { polyPxToM } from "../engine/scale";
import {
  requestSolarPosition,
  requestSolarScenarios,
  requestSolarSimulate,
  type SolarPositionRow,
  type SolarSimulateResponse,
} from "../persist/client";
import { useProject } from "../state/ProjectContext";
import { HelpTip } from "./HelpTip";

const SCENARIO_FALLBACK = [
  { id: "winter_solstice", label: "Solstício de inverno", date: "2026-06-21" },
  { id: "summer_solstice", label: "Solstício de verão", date: "2026-12-21" },
  { id: "march_equinox", label: "Equinócio de março", date: "2026-03-20" },
  { id: "september_equinox", label: "Equinócio de setembro", date: "2026-09-22" },
  { id: "custom", label: "Data personalizada", date: "" },
];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

type SolarCardProps = {
  /** Só local (etapa editar). Padrão: local + motor solar. */
  variant?: "full" | "local";
};

/** Fonte única de local + motor solar — um card, sem repetir lat/lon. */
export function SolarCard({ variant = "full" }: SolarCardProps) {
  const { state, readEarthFooter, patchGeoref } = useProject();
  const g = state.georef;
  const reading = state.busy && g.latitude_deg == null;
  const showSolar = variant === "full";

  const [latDec, setLatDec] = useState("");
  const [lonDec, setLonDec] = useState("");
  const [latTxt, setLatTxt] = useState("");
  const [lonTxt, setLonTxt] = useState("");
  const [scale, setScale] = useState("");
  const [elev, setElev] = useState("");
  const [cam, setCam] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [editLocal, setEditLocal] = useState(false);

  const [scenario, setScenario] = useState("winter_solstice");
  const [dates, setDates] = useState<Record<string, string>>({
    winter_solstice: "2026-06-21",
    summer_solstice: "2026-12-21",
    march_equinox: "2026-03-20",
    september_equinox: "2026-09-22",
  });
  const [day, setDay] = useState("2026-06-21");
  const [timeStart, setTimeStart] = useState("12:00");
  const [timeEnd, setTimeEnd] = useState("12:00");
  const [step, setStep] = useState(15);
  const [timezone] = useState("America/Sao_Paulo");
  const [busy, setBusy] = useState<"pos" | "sim" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<SolarPositionRow[]>([]);
  const [sim, setSim] = useState<SolarSimulateResponse | null>(null);

  useEffect(() => {
    setLatDec(g.latitude_deg != null ? g.latitude_deg.toFixed(6) : "");
    setLonDec(g.longitude_deg != null ? g.longitude_deg.toFixed(6) : "");
    setLatTxt(g.lat_text ?? "");
    setLonTxt(g.lon_text ?? "");
    setScale(g.scale_bar_m != null ? String(g.scale_bar_m) : "");
    setElev(g.elevation_m != null ? String(g.elevation_m) : "");
    setCam(g.camera_m != null ? String(g.camera_m) : "");
    if (g.latitude_deg == null || g.longitude_deg == null) setEditLocal(true);
  }, [g.latitude_deg, g.longitude_deg, g.lat_text, g.lon_text, g.scale_bar_m, g.elevation_m, g.camera_m]);

  useEffect(() => {
    if (!showSolar) return;
    void requestSolarScenarios()
      .then((data) => {
        if (data.ok && data.dates_2026) setDates((d) => ({ ...d, ...data.dates_2026 }));
        if (data.default_time_range) {
          setTimeStart(data.default_time_range.start);
          setTimeEnd(data.default_time_range.start);
          setStep(data.default_time_range.step_minutes);
        }
      })
      .catch(() => {
        /* CLI offline — usa fallback */
      });
  }, [showSolar]);

  useEffect(() => {
    if (scenario !== "custom" && dates[scenario]) setDay(dates[scenario]);
  }, [scenario, dates]);

  const lat = g.latitude_deg;
  const lon = g.longitude_deg;
  const coordsReady = lat != null && lon != null && Number.isFinite(lat) && Number.isFinite(lon);

  const commitDecimal = () => {
    const nextLat = Number(latDec.replace(",", "."));
    const nextLon = Number(lonDec.replace(",", "."));
    if (!Number.isFinite(nextLat) || !Number.isFinite(nextLon) || Math.abs(nextLat) > 90 || Math.abs(nextLon) > 180) {
      setMsg("Informe latitude (−90…90) e longitude (−180…180) em decimal.");
      return;
    }
    const dm = formatDm(nextLat, nextLon);
    patchGeoref({
      latitude_deg: nextLat,
      longitude_deg: nextLon,
      lat_text: dm.lat_text,
      lon_text: dm.lon_text,
      confidence: "high",
    });
    setLatTxt(dm.lat_text);
    setLonTxt(dm.lon_text);
    setMsg("Local gravado — o motor solar usa estes valores.");
    setEditLocal(false);
  };

  const commitText = () => {
    const nextLat = parseCoordInput(latTxt, "lat");
    const nextLon = parseCoordInput(lonTxt, "lon");
    if (nextLat == null || nextLon == null) {
      setMsg("Use DM (16°19.4580'S), DMS (16°19'27\"S) ou cole o par do rodapé.");
      return;
    }
    const dm = formatDm(nextLat, nextLon);
    patchGeoref({
      latitude_deg: nextLat,
      longitude_deg: nextLon,
      lat_text: latTxt.trim() || dm.lat_text,
      lon_text: lonTxt.trim() || dm.lon_text,
      confidence: "high",
    });
    setLatDec(nextLat.toFixed(6));
    setLonDec(nextLon.toFixed(6));
    setMsg("Local (graus/minutos) gravado.");
    setEditLocal(false);
  };

  const commitMeta = () => {
    const scale_bar_m = scale.trim() ? Number(scale.replace(",", ".")) : null;
    const elevation_m = elev.trim() ? Number(elev.replace(",", ".")) : null;
    const camera_m = cam.trim() ? Number(cam.replace(",", ".")) : null;
    patchGeoref({
      scale_bar_m: Number.isFinite(scale_bar_m as number) ? scale_bar_m : g.scale_bar_m,
      elevation_m: Number.isFinite(elevation_m as number) ? elevation_m : g.elevation_m,
      camera_m: Number.isFinite(camera_m as number) ? camera_m : g.camera_m,
    });
    setMsg("Barra / solo / câmera atualizados.");
  };

  const demoObstacles = useMemo(
    () => [
      {
        id: "demo-caixa",
        polygon_local_m: [
          [4.0, 3.0],
          [5.5, 3.0],
          [5.5, 4.5],
          [4.0, 4.5],
        ],
        base_height_m: 7.2,
        top_height_m: 9.2,
        casts_shadow: true,
      },
    ],
    [],
  );

  const demoModules = useMemo(
    () => [
      {
        id: "demo-module-01",
        polygon_local_m: [
          [0.5, 0.5],
          [1.8, 0.5],
          [1.8, 2.8],
          [0.5, 2.8],
        ],
      },
    ],
    [],
  );

  const projectGeometry = () => {
    if (!state.scale.calibrated) return { obstacles: demoObstacles, modules: demoModules, mode: "demo" as const };
    const mpp = state.scale.meters_per_pixel;
    const obstacles = state.obstacles
      .filter((o) => !o.excluded)
      .map((o) => {
        const top = Math.max(o.height_from_ground_m || 2, 0.5);
        return {
          id: o.id,
          polygon_local_m: polyPxToM(o.polygon_px, mpp),
          base_height_m: 0,
          top_height_m: top,
          casts_shadow: true,
        };
      });
    const modules = (state.layout?.best.modules ?? []).map((m) => ({
      id: m.id,
      polygon_local_m: modulePolygon(m),
    }));
    if (!obstacles.length || !modules.length) {
      return { obstacles: demoObstacles, modules: demoModules, mode: "demo" as const };
    }
    return { obstacles, modules, mode: "projeto" as const };
  };

  const runPosition = async () => {
    if (!coordsReady || lat == null || lon == null) {
      setError("Grave o local neste card (latitude e longitude).");
      setEditLocal(true);
      return;
    }
    setBusy("pos");
    setError(null);
    setSim(null);
    try {
      const res = await requestSolarPosition({
        latitude: lat,
        longitude: lon,
        timezone,
        day,
        time_start: timeStart,
        time_end: timeEnd,
        step_minutes: step,
      });
      if (!res.ok) throw new Error(res.error || "Falha ao calcular a posição solar.");
      setRows(res.rows ?? []);
    } catch (err) {
      setRows([]);
      setError(err instanceof Error ? err.message : "Falha no motor solar.");
    } finally {
      setBusy(null);
    }
  };

  const runSimulate = async () => {
    if (!coordsReady || lat == null || lon == null) {
      setError("Grave o local neste card (latitude e longitude).");
      setEditLocal(true);
      return;
    }
    setBusy("sim");
    setError(null);
    try {
      const geom = projectGeometry();
      const res = await requestSolarSimulate({
        config: {
          latitude: lat,
          longitude: lon,
          timezone,
          day,
          time_start: timeStart,
          time_end: timeEnd === timeStart ? timeStart : timeEnd,
          step_minutes: step,
          plane_z: 0,
          threshold_percent: 1,
        },
        obstacles: geom.obstacles,
        modules: geom.modules,
      });
      if (!res.ok) throw new Error(res.error || "Falha na simulação de sombra.");
      setSim({ ...res, warning: `${res.warning ?? ""} Geometria: ${geom.mode}.` });
      if (!rows.length) {
        const pos = await requestSolarPosition({
          latitude: lat,
          longitude: lon,
          timezone,
          day,
          time_start: timeStart,
          time_end: timeStart,
          step_minutes: 15,
        });
        if (pos.ok) setRows(pos.rows ?? []);
      }
    } catch (err) {
      setSim(null);
      setError(err instanceof Error ? err.message : "Falha na simulação.");
    } finally {
      setBusy(null);
    }
  };

  const first = rows[0];
  const headingAz = state.scale.heading?.azimuth_deg;

  return (
    <div className="card">
      <h3>
        {showSolar ? "Local · Motor solar" : "Local · Google Earth"}
        <HelpTip>
          Um só quadro: lat/lon do projeto (rodapé Earth ou digitado) alimentam o motor solar.
          Aceita <b>decimal</b> (−16.324392) ou <b>DM/DMS</b>. Sul/Oeste = negativo.
          Barra/solo/câmera: milhar PT-BR (1.074 = 1074 m). Fuso America/Sao_Paulo · pvlib.
        </HelpTip>
      </h3>
      <p className="hint">
        {showSolar
          ? "Local e sombra no mesmo card — não precisa preencher de novo em outro lugar."
          : "Preenchido pelo rodapé na importação. Edite aqui se faltar algo."}
      </p>

      <div className="kpis" style={{ marginBottom: 8 }}>
        <div className="kpi">
          <span>latitude</span>
          <strong>{coordsReady ? lat!.toFixed(6) : "—"}</strong>
        </div>
        <div className="kpi">
          <span>longitude</span>
          <strong>{coordsReady ? lon!.toFixed(6) : "—"}</strong>
        </div>
        <div className="kpi">
          <span>barra</span>
          <strong>{g.scale_bar_m != null ? `${g.scale_bar_m} m` : "—"}</strong>
        </div>
        <div className="kpi">
          <span>solo</span>
          <strong>{g.elevation_m != null ? `${g.elevation_m} m` : "—"}</strong>
        </div>
      </div>
      <p className="hint" style={{ marginTop: 0 }}>
        {coordsReady
          ? `${g.lat_text ?? ""} ${g.lon_text ?? ""}`.trim() || "Local do projeto"
          : reading
            ? "lendo rodapé…"
            : "Sem coordenadas — edite abaixo ou leia o rodapé"}
        {" · "}
        Norte para cima
        {headingAz != null ? ` · rumo imóvel ${headingAz.toFixed(1)}°` : ""}
        {showSolar ? ` · fuso ${timezone}` : ""}
        {g.imagery_date ? ` · ${g.imagery_date}` : ""}
      </p>
      {(g.endereco || g.cidade || g.bairro) && (
        <p className="hint" style={{ marginTop: 4 }}>
          {[g.endereco, g.bairro, g.cidade].filter(Boolean).join(" · ")}
        </p>
      )}

      <div className="btn-row" style={{ marginBottom: 8 }}>
        <button className="btn ghost" type="button" onClick={() => setEditLocal((v) => !v)}>
          {editLocal ? "Ocultar edição" : coordsReady ? "Editar local" : "Informar local"}
        </button>
        <button className="btn ghost" type="button" disabled={state.busy} onClick={() => void readEarthFooter()}>
          {reading ? "Lendo rodapé…" : "Ler rodapé Earth"}
        </button>
      </div>

      {editLocal && (
        <>
          <div className="row">
            <label className="field">
              latitude (decimal)
              <input
                value={latDec}
                onChange={(e) => setLatDec(e.target.value)}
                placeholder="-16.324392"
                inputMode="decimal"
              />
            </label>
            <label className="field">
              longitude (decimal)
              <input
                value={lonDec}
                onChange={(e) => setLonDec(e.target.value)}
                placeholder="-48.925462"
                inputMode="decimal"
              />
            </label>
          </div>
          <button className="btn primary" type="button" style={{ marginTop: 8 }} disabled={state.busy} onClick={commitDecimal}>
            Gravar decimal
          </button>

          <div className="row" style={{ marginTop: 10 }}>
            <label className="field">
              latitude (DM/DMS)
              <input value={latTxt} onChange={(e) => setLatTxt(e.target.value)} placeholder={"16°19.4580'S"} />
            </label>
            <label className="field">
              longitude (DM/DMS)
              <input value={lonTxt} onChange={(e) => setLonTxt(e.target.value)} placeholder={"48°55.5277'W"} />
            </label>
          </div>
          <button className="btn ghost" type="button" style={{ marginTop: 8 }} disabled={state.busy} onClick={commitText}>
            Gravar graus/minutos
          </button>

          <div className="row" style={{ marginTop: 10 }}>
            <label className="field">
              barra (m)
              <input value={scale} onChange={(e) => setScale(e.target.value)} placeholder="6" inputMode="decimal" />
            </label>
            <label className="field">
              solo (m)
              <input value={elev} onChange={(e) => setElev(e.target.value)} placeholder="1025" inputMode="decimal" />
            </label>
            <label className="field">
              câmera (m)
              <input value={cam} onChange={(e) => setCam(e.target.value)} placeholder="1074" inputMode="decimal" />
            </label>
          </div>
          <button className="btn ghost" type="button" style={{ marginTop: 8 }} disabled={state.busy} onClick={commitMeta}>
            Gravar barra/solo/câmera
          </button>
        </>
      )}
      {msg && <p className="hint">{msg}</p>}

      {showSolar && (
        <>
          <hr style={{ border: 0, borderTop: "1px solid var(--border, #3333)", margin: "14px 0 10px" }} />
          <p className="hint" style={{ marginTop: 0 }}>
            Cenário e horário — as coordenadas já vêm do local acima.
          </p>

          <label className="field">
            cenário
            <select
              value={scenario}
              onChange={(e) => {
                const id = e.target.value;
                setScenario(id);
                if (id === "custom" && !day) setDay(todayIso());
              }}
            >
              {SCENARIO_FALLBACK.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                  {dates[s.id] ? ` (${dates[s.id]})` : ""}
                </option>
              ))}
            </select>
          </label>

          <div className="row">
            <label className="field">
              data
              <input
                type="date"
                value={day}
                disabled={scenario !== "custom"}
                onChange={(e) => {
                  setScenario("custom");
                  setDay(e.target.value);
                }}
              />
            </label>
            <label className="field">
              passo (min)
              <input type="number" min={5} max={60} step={5} value={step} onChange={(e) => setStep(Number(e.target.value))} />
            </label>
          </div>
          <div className="row">
            <label className="field">
              hora início
              <input type="time" value={timeStart} onChange={(e) => setTimeStart(e.target.value)} />
            </label>
            <label className="field">
              hora fim
              <input type="time" value={timeEnd} onChange={(e) => setTimeEnd(e.target.value)} />
            </label>
          </div>

          <div className="btn-row" style={{ marginTop: 8 }}>
            <button className="btn primary" disabled={Boolean(busy) || !coordsReady} onClick={() => void runPosition()}>
              {busy === "pos" ? "Calculando…" : "Calcular posição solar"}
            </button>
            <button className="btn ghost" disabled={Boolean(busy) || !coordsReady} onClick={() => void runSimulate()}>
              {busy === "sim" ? "Simulando…" : "Testar sombra"}
            </button>
          </div>

          {error && (
            <p className="hint" style={{ color: "var(--chip-bad)" }}>
              {error}
            </p>
          )}

          {first && (
            <div className="kpis" style={{ marginTop: 10 }}>
              <div className="kpi">
                <span>azimute sol</span>
                <strong>{first.azimuth.toFixed(1)}°</strong>
              </div>
              <div className="kpi">
                <span>elevação</span>
                <strong>{first.elevation.toFixed(1)}°</strong>
              </div>
              <div className="kpi">
                <span>Sol</span>
                <strong>{first.sun_up ? "acima" : "abaixo"}</strong>
              </div>
              <div className="kpi">
                <span>amostras</span>
                <strong>{rows.length}</strong>
              </div>
            </div>
          )}
          {first && (
            <p className="hint" style={{ marginTop: 8 }}>
              Nascer {first.sunrise.slice(11, 19)} · Trânsito {String(first.solar_transit ?? "").slice(11, 19) || "—"} · Pôr{" "}
              {first.sunset.slice(11, 19)}
            </p>
          )}

          {sim && (
            <div style={{ marginTop: 10 }}>
              <p className="hint" style={{ marginTop: 0 }}>
                Simulação: {sim.samples ?? 0} amostras · {sim.shadow_hits ?? 0} com sombra parcial/total.
              </p>
              {sim.warning && <p className="hint">{sim.warning}</p>}
              {(sim.results ?? []).slice(0, 4).map((r, i) => (
                <p key={i} className="hint" style={{ marginBottom: 4 }}>
                  <code className="mono">
                    {String(r.module_id)} · {String(r.status)} · {Number(r.shadowed_area_percent ?? 0).toFixed(1)}% · az{" "}
                    {Number(r.solar_azimuth_deg ?? 0).toFixed(1)}°
                  </code>
                </p>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
