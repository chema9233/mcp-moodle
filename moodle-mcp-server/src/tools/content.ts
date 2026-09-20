import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { moodleCall } from "../services/moodleClient.js";
import type { MoodlePage, MoodleResource, MoodleScorm } from "../types.js";
import { errorResult } from "./courses.js";

export function registerContentTools(server: McpServer) {
  // --- moodle_leer_pagina ---
  const LeerPaginaInputSchema = z
    .object({
      curso_id: z.number().int().positive().describe("ID del curso al que pertenece la página."),
    })
    .strict();

  server.registerTool(
    "moodle_leer_pagina",
    {
      title: "Leer contenido de páginas (tipo 'Page') de un curso",
      description: `Devuelve el texto completo de todas las actividades de tipo "Página" (mod_page) de un curso.

Usa esta herramienta cuando, tras consultar moodle_listar_contenidos, veas un módulo con tipo="page" y necesites leer su contenido real para responder al alumno.

Args:
  - curso_id (number): ID del curso

Devuelve: lista de páginas del curso con su nombre y contenido HTML/texto.

Nota: esta función de Moodle devuelve TODAS las páginas del curso a la vez (no permite filtrar por una sola). Si el curso tiene muchas páginas, filtra tú mismo en tu respuesta por el nombre que te interese.`,
      inputSchema: LeerPaginaInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ curso_id }) => {
      try {
        const result = await moodleCall<{ pages: MoodlePage[] }>(
          "mod_page_get_pages_by_courses",
          { "courseids[0]": curso_id }
        );

        const output = {
          curso_id,
          paginas: (result.pages ?? []).map((p) => ({
            id: p.coursemodule,
            nombre: p.name,
            contenido: p.content ?? p.intro ?? "",
          })),
        };

        return {
          content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
          structuredContent: output,
        };
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  // --- moodle_listar_recursos ---
  server.registerTool(
    "moodle_listar_recursos",
    {
      title: "Listar archivos/recursos (tipo 'Resource') de un curso",
      description: `Devuelve la lista de actividades de tipo "Archivo/Recurso" (mod_resource) de un curso, con sus enlaces de descarga.

Usa esta herramienta cuando el alumno pida un material descargable (PDF, documento) o cuando necesites saber qué archivos tiene disponibles el curso. Esta herramienta NO descarga ni lee el contenido del archivo, solo lista sus nombres y URLs — para leer el contenido de un PDF, el temario ya debería estar indexado en el sistema de RAG del tutor (Fluentia Tutor), así que normalmente no hace falta bajar el archivo aquí.

Args:
  - curso_id (number): ID del curso

Devuelve: lista de recursos con nombre y URL de descarga de cada archivo.`,
      inputSchema: z
        .object({
          curso_id: z.number().int().positive().describe("ID del curso."),
        })
        .strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ curso_id }) => {
      try {
        const result = await moodleCall<{ resources: MoodleResource[] }>(
          "mod_resource_get_resources_by_courses",
          { "courseids[0]": curso_id }
        );

        const output = {
          curso_id,
          recursos: (result.resources ?? []).map((r) => ({
            id: r.coursemodule,
            nombre: r.name,
            archivos: (r.contentfiles ?? []).map((f) => ({
              nombre_archivo: f.filename,
              url: f.fileurl,
            })),
          })),
        };

        return {
          content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
          structuredContent: output,
        };
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  // --- moodle_listar_scorm ---
  server.registerTool(
    "moodle_listar_scorm",
    {
      title: "Listar paquetes SCORM de un curso",
      description: `Devuelve la lista de actividades de tipo SCORM (paquetes de contenido interactivo, como el que se ve en el reproductor del curso) de un curso.

Usa esta herramienta cuando el alumno pregunte por un módulo SCORM concreto (por ejemplo, "el módulo 2 sobre el Título Preliminar") y necesites confirmar su nombre e ID. El contenido interno detallado de un SCORM no se puede leer por esta vía de solo lectura (Moodle no expone una función get_* para el texto interno de un SCORM); para ese contenido, el tutor debe apoyarse en el temario ya indexado en el sistema RAG de Fluentia Tutor.

Args:
  - curso_id (number): ID del curso

Devuelve: lista de paquetes SCORM del curso con nombre e id.`,
      inputSchema: z
        .object({
          curso_id: z.number().int().positive().describe("ID del curso."),
        })
        .strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ curso_id }) => {
      try {
        const result = await moodleCall<{ scorms: MoodleScorm[] }>(
          "mod_scorm_get_scorms_by_courses",
          { "courseids[0]": curso_id }
        );

        const output = {
          curso_id,
          paquetes_scorm: (result.scorms ?? []).map((s) => ({
            id: s.coursemodule,
            nombre: s.name,
            descripcion: s.intro ?? "",
          })),
        };

        return {
          content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
          structuredContent: output,
        };
      } catch (err) {
        return errorResult(err);
      }
    }
  );
}
