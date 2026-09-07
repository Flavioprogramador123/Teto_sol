import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { ProjectProvider } from "./state/ProjectContext";
import "./index.css";
import "./theme-claro.css";
import "./theme";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ProjectProvider>
      <App />
    </ProjectProvider>
  </React.StrictMode>,
);
