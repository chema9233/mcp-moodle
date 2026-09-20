import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { moodleCall, MoodleApiError } from "../services/moodleClient.js";
import type { MoodleCourse, MoodleCourseSection } from "../types.js";

export function registerCourseTools(server: McpServer) {
  // --- moodle_buscar_curso ---
  const BuscarCursoInputSchema = z
    .object({
      campo: z
        .enum(["shortname", "idnumber", "fullname", "id"])
        .default("fullname")
        .describe(
          "Campo de Moodle por el que buscar: 'fullname' (nombre completo del curso), 'shortname' (nombre corto), 'idnumber' (código externo) o 'id' (ID numérico de Moodle)."
        ),
      valor: z
        .string()
        .min(1, "El valor de búsqueda no puede estar vacío")
        .describe(
          "Valor a buscar en el campo indicado. Ejemplo: 'Auxiliar Administrativo del Estado' si campo='fullname'."
        ),
    })
    .strict();

  server.registerTool(
    "moodle_buscar_curso",
    {
      title: "Buscar curso en Moodle",
      description: `Busca un curso en Moodle por nombre, nombre corto, código externo o ID.

Usa esta herramienta primero cuando necesites el ID de un curso para consultar sus contenidos, progreso de un alumno, etc. — la mayoría del resto de herramientas de este servidor necesitan el ID numérico del curso, no su nombre.

Args:
  - campo ('fullname' | 'shortname' | 'idnumber' | 'id'): campo por el que buscar (por defecto 'fullname')
  - valor (string): texto o ID a buscar

Devuelve la lista de cursos que coinciden, con su id, shortname y fullname.

Ejemplos:
  - Buscar "el curso de Auxiliar Administrativo" -> campo='fullname', valor='Auxiliar Administrativo del Estado'
  - Ya tienes el ID 2 y quieres confirmar el nombre -> campo='id', valor='2'

Manejo de errores:
  - Si no hay ningún curso que coincida, devuelve una lista vacía (no es un error).`,
      inputSchema: BuscarCursoInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ campo, valor }) => {
      try {
        const result = await moodleCall<{ courses: MoodleCourse[] }>(
          "core_course_get_courses_by_field",
          { field: campo, value: valor }
        );

        const cursos = result.courses ?? [];
        const output = {
          total: cursos.length,
          cursos: cursos.map((c) => ({
            id: c.id,
            shortname: c.shortname,
            fullname: c.fullname,
            idnumber: c.idnumber,
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

  // --- moodle_listar_cursos ---
  server.registerTool(
    "moodle_listar_cursos",
    {
      title: "Listar todos los cursos de Moodle",
      description: `Devuelve la lista completa de cursos disponibles en la plataforma Moodle.

Útil cuando el alumno pregunta algo general como "¿qué cursos hay?" o cuando no sabes el nombre exacto del curso y prefieres explorar la lista completa en vez de adivinar con moodle_buscar_curso.

Args: (ninguno)

Devuelve: lista de cursos con id, shortname y fullname.`,
      inputSchema: z.object({}).strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () => {
      try {
        const cursos = await moodleCall<MoodleCourse[]>("core_course_get_courses");
        const output = {
          total: cursos.length,
          cursos: cursos
            .filter((c) => c.id !== 1) // Moodle incluye el "curso" site (id=1), lo excluimos
            .map((c) => ({
              id: c.id,
              shortname: c.shortname,
              fullname: c.fullname,
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

  // --- moodle_listar_contenidos ---
  const ListarContenidosInputSchema = z
    .object({
      curso_id: z
        .number()
        .int()
        .positive()
        .describe(
          "ID numérico del curso en Moodle (obtenido con moodle_buscar_curso o moodle_listar_cursos)."
        ),
    })
    .strict();

  server.registerTool(
    "moodle_listar_contenidos",
    {
      title: "Listar contenidos (temario) de un curso",
      description: `Devuelve la estructura completa de un curso: sus secciones/temas y, dentro de cada uno, las actividades y recursos (páginas, archivos, SCORM, cuestionarios, etc.) con su tipo e id.

Usa esta herramienta para orientarte dentro de un curso antes de leer un contenido concreto con moodle_leer_contenido — necesitas el "id" de cada actividad (coursemodule id) que aparece aquí para poder leerla después.

Args:
  - curso_id (number): ID del curso (usa moodle_buscar_curso primero si solo tienes el nombre)

Devuelve: lista de secciones, cada una con su nombre y sus módulos/actividades (id, nombre, tipo).

Ejemplos:
  - "¿Qué temas tiene el curso de Constitución?" -> primero moodle_buscar_curso, luego moodle_listar_contenidos con ese id

Manejo de errores:
  - Si el curso_id no existe, Moodle devuelve un error que se traduce a un mensaje claro.`,
      inputSchema: ListarContenidosInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ curso_id }) => {
      try {
        const secciones = await moodleCall<MoodleCourseSection[]>(
          "core_course_get_contents",
          { courseid: curso_id }
        );

        const output = {
          curso_id,
          secciones: secciones.map((s) => ({
            id: s.id,
            nombre: s.name,
            visible: !!s.visible,
            modulos: (s.modules ?? []).map((m) => ({
              id: m.id,
              nombre: m.name,
              tipo: m.modname,
              visible: !!m.visible,
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
}

/** Convierte cualquier error (incluyendo MoodleApiError) en una respuesta de error MCP clara. */
export function errorResult(err: unknown) {
  const message =
    err instanceof MoodleApiError
      ? err.message
      : err instanceof Error
      ? err.message
      : String(err);

  return {
    content: [{ type: "text" as const, text: `Error: ${message}` }],
    isError: true,
  };
}
