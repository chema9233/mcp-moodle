import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { moodleCall } from "../services/moodleClient.js";
import type {
  MoodleEnrolledCourse,
  MoodleActivityCompletionStatus,
} from "../types.js";
import { errorResult } from "./courses.js";

export function registerProgressTools(server: McpServer) {
  // --- moodle_cursos_de_alumno ---
  const CursosDeAlumnoInputSchema = z
    .object({
      usuario_id: z
        .number()
        .int()
        .positive()
        .describe(
          "ID numérico del usuario en Moodle. Si solo tienes su email, primero necesitas resolverlo a un ID (esta herramienta no busca por email, ver nota)."
        ),
    })
    .strict();

  server.registerTool(
    "moodle_cursos_de_alumno",
    {
      title: "Ver en qué cursos está matriculado un alumno",
      description: `Devuelve la lista de cursos en los que está matriculado un alumno, junto con su porcentaje de progreso en cada uno (si Moodle lo tiene calculado).

Args:
  - usuario_id (number): ID numérico del usuario en Moodle

Devuelve: lista de cursos con id, nombre y progreso (0-100, o null si Moodle no tiene el dato).

Nota importante: esta herramienta requiere el ID numérico de usuario de Moodle, no un email. Este servidor MCP no incluye una función para buscar usuarios por email (por diseño, para mantener el acceso limitado a lo estrictamente necesario para guiar al alumno dentro de un curso). Si necesitas resolver un email a un ID de usuario, pide ese dato al sistema de matrículas (Fluentia Matrículas) en vez de a este servidor.`,
      inputSchema: CursosDeAlumnoInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ usuario_id }) => {
      try {
        const cursos = await moodleCall<MoodleEnrolledCourse[]>(
          "core_enrol_get_users_courses",
          { userid: usuario_id }
        );

        const output = {
          usuario_id,
          cursos: cursos.map((c) => ({
            id: c.id,
            nombre: c.fullname,
            progreso_porcentaje: c.progress ?? null,
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

  // --- moodle_progreso_actividades ---
  const ProgresoActividadesInputSchema = z
    .object({
      curso_id: z.number().int().positive().describe("ID del curso."),
      usuario_id: z.number().int().positive().describe("ID numérico del usuario en Moodle."),
    })
    .strict();

  server.registerTool(
    "moodle_progreso_actividades",
    {
      title: "Ver progreso detallado de actividades de un alumno en un curso",
      description: `Devuelve, actividad por actividad, si un alumno ha completado cada módulo del curso (temas, cuestionarios, SCORM, etc.).

Usa esta herramienta cuando el alumno pregunte "¿por dónde voy?", "¿qué me falta?" o similar, para poder guiarlo señalando exactamente qué actividades le quedan pendientes.

Args:
  - curso_id (number): ID del curso
  - usuario_id (number): ID numérico del usuario en Moodle

Devuelve: lista de actividades con su estado (completada / no completada).

Manejo de errores:
  - Si el curso no tiene el seguimiento de finalización ("completion tracking") activado, Moodle puede devolver una lista vacía; en ese caso, informa al alumno de que ese curso no tiene seguimiento de progreso activado, en vez de asumir que no ha completado nada.`,
      inputSchema: ProgresoActividadesInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ curso_id, usuario_id }) => {
      try {
        const result = await moodleCall<{
          statuses: MoodleActivityCompletionStatus[];
        }>("core_completion_get_activities_completion_status", {
          courseid: curso_id,
          userid: usuario_id,
        });

        const estados = result.statuses ?? [];
        const output = {
          curso_id,
          usuario_id,
          total_actividades: estados.length,
          actividades: estados.map((a) => ({
            id: a.cmid,
            tipo: a.modname,
            completada: a.state === 1 || a.state === 2,
            estado_detallado:
              a.state === 0
                ? "no_iniciada_o_incompleta"
                : a.state === 1
                ? "completada"
                : a.state === 2
                ? "completada_aprobado"
                : a.state === 3
                ? "completada_suspenso"
                : "desconocido",
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
