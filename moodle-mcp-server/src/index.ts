import express from "express";
import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { registerCourseTools } from "./tools/courses.js";
import { registerContentTools } from "./tools/content.js";
import { registerProgressTools } from "./tools/progress.js";

const PORT = Number(process.env.PORT || 8420);

function buildServer(): McpServer {
  const server = new McpServer({
    name: "moodle-tutor-mcp-server",
    version: "1.0.0",
  });

  registerCourseTools(server);
  registerContentTools(server);
  registerProgressTools(server);

  return server;
}

const app = express();
app.use(express.json());

// Endpoint de salud, útil para comprobar que el contenedor está vivo (Easypanel, monitorización, etc.)
app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "moodle-tutor-mcp-server" });
});

// Servidor MCP en modo "stateless": cada petición crea su propia instancia de servidor
// y transporte, sin guardar sesión entre peticiones. Es el patrón recomendado para
// servidores MCP remotos sencillos (más fácil de escalar y depurar).
app.post("/mcp", async (req, res) => {
  try {
    const server = buildServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
    });

    res.on("close", () => {
      transport.close();
      server.close();
    });

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error("[moodle-tutor-mcp-server] Error gestionando petición MCP:", err);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: "Error interno del servidor MCP de Moodle.",
        },
        id: null,
      });
    }
  }
});

app.listen(PORT, () => {
  console.log(`[moodle-tutor-mcp-server] Escuchando en el puerto ${PORT}`);
  console.log(`[moodle-tutor-mcp-server] Endpoint MCP: POST /mcp`);
  console.log(`[moodle-tutor-mcp-server] Endpoint de salud: GET /health`);
});
