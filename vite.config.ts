import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { pepilenePersist } from "./plugins/persist";
import { pepileneVisual } from "./plugins/visual";
import { pepileneSolar } from "./plugins/solar";

function terminalAccessLog(): Plugin {
  return {
    name: "pepilene-terminal-log",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const started = Date.now();
        const incoming = req as { url?: string; method?: string };
        res.on("finish", () => {
          const url = incoming.url ?? "";
          if (
            url.includes("node_modules") ||
            url.includes("/@vite") ||
            url.includes("/@react-refresh") ||
            url.includes("/@fs") ||
            url.includes(".woff") ||
            url.includes("/api/persist/file")
          ) {
            return;
          }
          const stamp = new Date().toLocaleTimeString("pt-BR");
          server.config.logger.info(`[${stamp}] ${res.statusCode} ${incoming.method ?? "GET"} ${url} ${Date.now() - started}ms`);
        });
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), pepilenePersist(), pepileneVisual(), pepileneSolar(), terminalAccessLog()],
  server: {
    port: 5173,
    strictPort: true,
  },
});
