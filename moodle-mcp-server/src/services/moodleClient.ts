/**
 * Cliente para la API REST de Moodle (webservice/rest/server.php).
 * Este servidor es de SOLO LECTURA: solo llama a funciones de tipo "get_*".
 * No expone ninguna función que cree, modifique o borre datos en Moodle.
 */

const MOODLE_BASE_URL = process.env.MOODLE_BASE_URL || "https://plataforma.fluentia.marketing";
const MOODLE_TOKEN = process.env.MOODLE_TOKEN || "";

if (!MOODLE_TOKEN) {
  // No lanzamos error al arrancar para permitir builds/tests sin token,
  // pero cualquier llamada real fallará con un mensaje claro (ver moodleCall).
  console.warn(
    "[moodle-tutor-mcp-server] Aviso: la variable de entorno MOODLE_TOKEN no está definida."
  );
}

export class MoodleApiError extends Error {
  constructor(
    message: string,
    public readonly errorCode?: string,
    public readonly moodleMessage?: string
  ) {
    super(message);
    this.name = "MoodleApiError";
  }
}

/**
 * Llama a una función del webservice REST de Moodle y devuelve el JSON ya parseado.
 * Traduce los errores típicos de Moodle (token inválido, función no permitida, etc.)
 * en mensajes claros y accionables para el agente.
 */
export async function moodleCall<T = unknown>(
  wsfunction: string,
  params: Record<string, string | number | boolean> = {}
): Promise<T> {
  if (!MOODLE_TOKEN) {
    throw new MoodleApiError(
      "No hay token de Moodle configurado. Define la variable de entorno MOODLE_TOKEN con el token del servicio 'Fluentia Tutor Cline'."
    );
  }

  const url = new URL(`${MOODLE_BASE_URL}/webservice/rest/server.php`);
  url.searchParams.set("wstoken", MOODLE_TOKEN);
  url.searchParams.set("wsfunction", wsfunction);
  url.searchParams.set("moodlewsrestformat", "json");

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }

  let response: Response;
  try {
    response = await fetch(url.toString(), { method: "GET" });
  } catch (err) {
    throw new MoodleApiError(
      `No se pudo conectar con Moodle en ${MOODLE_BASE_URL}. Comprueba que la plataforma esté accesible. Detalle: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
  }

  if (!response.ok) {
    throw new MoodleApiError(
      `Moodle respondió con estado HTTP ${response.status} al llamar a ${wsfunction}.`
    );
  }

  const data = (await response.json()) as unknown;

  // Moodle devuelve errores como un objeto con "exception"/"errorcode"/"message"
  // en vez de un código HTTP de error, así que hay que detectarlo manualmente.
  if (
    data &&
    typeof data === "object" &&
    "exception" in data &&
    "errorcode" in data
  ) {
    const errObj = data as { exception: string; errorcode: string; message: string };

    if (errObj.errorcode === "invalidtoken") {
      throw new MoodleApiError(
        "El token de Moodle no es válido o ha caducado. Genera un nuevo token en Moodle (Administración del sitio → Servidor → Servicios web → Gestionar tokens) para el servicio 'Fluentia Tutor Cline' y actualiza la variable de entorno MOODLE_TOKEN.",
        errObj.errorcode,
        errObj.message
      );
    }

    if (errObj.errorcode === "accessexception" || errObj.errorcode === "nopermissions") {
      throw new MoodleApiError(
        `El token de Moodle no tiene permiso para llamar a la función '${wsfunction}'. Añade esa función al servicio externo 'Fluentia Tutor Cline' en Moodle (Servicios web → Servicios externos → Funciones).`,
        errObj.errorcode,
        errObj.message
      );
    }

    throw new MoodleApiError(
      `Moodle devolvió un error al llamar a '${wsfunction}': ${errObj.message}`,
      errObj.errorcode,
      errObj.message
    );
  }

  return data as T;
}
