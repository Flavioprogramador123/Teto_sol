import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { ProjectProvider } from "./state/ProjectContext";
import { APP_VERSION_LABEL } from "./lib/appVersion";
import "./index.css";
import "./theme-claro.css";
import "./theme";

document.title = `PlanoSol ${APP_VERSION_LABEL} — PIENG Soluções Energéticas`;

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ProjectProvider>
      <App />
    </ProjectProvider>
  </React.StrictMode>,
);
