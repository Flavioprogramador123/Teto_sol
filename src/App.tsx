import { useCallback, useEffect, useRef, useState } from "react";
import { CanvasBoard } from "./components/CanvasBoard";
import { Sidebar } from "./components/Sidebar";
import { StatusBar } from "./components/StatusBar";
import { TopBar } from "./components/TopBar";
import { useProject } from "./state/ProjectContext";

const SIDEBAR_KEY = "pepilene-sidebar-w";
const SIDEBAR_DEFAULT = 340;
const SIDEBAR_MIN = 220;
const SIDEBAR_MAX = 640;

function readSidebarWidth() {
  const raw = Number(localStorage.getItem(SIDEBAR_KEY));
  if (!Number.isFinite(raw)) return SIDEBAR_DEFAULT;
  return Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, raw));
}

export function App() {
  const { restoreSession, undo, redo, applyPiengBridge } = useProject();
  const [sidebarW, setSidebarW] = useState(readSidebarWidth);
  const sidebarWRef = useRef(sidebarW);
  const drag = useRef<{ startX: number; startW: number } | null>(null);
  sidebarWRef.current = sidebarW;

  useEffect(() => {
    void restoreSession();
  }, [restoreSession]);

  useEffect(() => {
    const onMessage = (ev: MessageEvent) => {
      if (!ev.data) return;
      applyPiengBridge(ev.data);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [applyPiengBridge]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      if (e.key === "z" || e.key === "Z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (e.key === "y" || e.key === "Y") {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  const clampWidth = useCallback((width: number) => {
    const max = Math.min(SIDEBAR_MAX, Math.round(window.innerWidth * 0.62));
    return Math.min(max, Math.max(SIDEBAR_MIN, Math.round(width)));
  }, []);

  const onSplitterDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    drag.current = { startX: e.clientX, startW: sidebarW };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onSplitterMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    setSidebarW(clampWidth(drag.current.startW + (e.clientX - drag.current.startX)));
  };

  const onSplitterUp = () => {
    if (!drag.current) return;
    drag.current = null;
    localStorage.setItem(SIDEBAR_KEY, String(sidebarWRef.current));
  };

  return (
    <div className="app">
      <TopBar />
      <div className="workspace" style={{ ["--sidebar-w" as string]: `${sidebarW}px` }}>
        <Sidebar />
        <div
          className="splitter"
          role="separator"
          aria-orientation="vertical"
          aria-label="Redimensionar quadro esquerdo"
          onPointerDown={onSplitterDown}
          onPointerMove={onSplitterMove}
          onPointerUp={onSplitterUp}
          onDoubleClick={() => {
            setSidebarW(SIDEBAR_DEFAULT);
            localStorage.setItem(SIDEBAR_KEY, String(SIDEBAR_DEFAULT));
          }}
        />
        <CanvasBoard />
      </div>
      <StatusBar />
    </div>
  );
}
