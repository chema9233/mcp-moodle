# moodle-tutor-mcp-server

Servidor MCP de **solo lectura** para que Cline (u otro cliente MCP) pueda consultar cursos, contenidos y progreso de alumnos en Moodle (plataforma.fluentia.marketing).

**Este servidor NO puede crear, editar ni borrar nada en Moodle.** Solo llama a funciones `get_*` / `*_by_field` de la API de Moodle.

## Herramientas incluidas

| Herramienta | Qué hace |
|---|---|
| `moodle_buscar_curso` | Busca un curso por nombre, shortname, idnumber o id |
| `moodle_listar_cursos` | Lista todos los cursos de la plataforma |
| `moodle_listar_contenidos` | Lista las secciones y actividades (temario) de un curso |
| `moodle_leer_pagina` | Lee el contenido de las actividades tipo "Página" de un curso |
| `moodle_listar_recursos` | Lista los archivos/recursos descargables de un curso |
| `moodle_listar_scorm` | Lista los paquetes SCORM de un curso |
| `moodle_cursos_de_alumno` | Ve en qué cursos está matriculado un alumno y su progreso |
| `moodle_progreso_actividades` | Ve qué actividades ha completado un alumno en un curso |

## Requisitos previos en Moodle

1. Servicio externo **"Fluentia Tutor Cline"** creado en Moodle, con estas funciones habilitadas:
   - `core_course_get_courses`
   - `core_course_get_contents`
   - `core_course_get_courses_by_field`
   - `core_enrol_get_users_courses`
   - `core_completion_get_activities_completion_status`
   - `mod_page_get_pages_by_courses`
   - `mod_resource_get_resources_by_courses`
   - `mod_scorm_get_scorms_by_courses`
2. Un token generado para ese servicio (Administración del sitio → Servidor → Servicios web → Gestionar tokens).

## Despliegue en Easypanel (VPS de Fluentia)

1. En Easypanel, dentro del proyecto **"n8n"** (donde ya viven `moodle`, `docuseal`, etc.), crea un nuevo servicio de tipo **"App"**.
2. Nómbralo, por ejemplo: `moodle-tutor-mcp`.
3. Como origen, sube este código (puedes subirlo a un repositorio de GitHub y apuntar Easypanel ahí, o usar "Deploy from source" si Easypanel lo permite con un ZIP).
4. Easypanel detectará el `Dockerfile` incluido y lo usará para construir la imagen.
5. Configura las variables de entorno del servicio:
   - `MOODLE_BASE_URL` = `https://plataforma.fluentia.marketing`
   - `MOODLE_TOKEN` = *(el token generado en el paso anterior)*
   - `PORT` = `8420` (opcional, ya es el valor por defecto)
6. Expón el puerto `8420` y asígnale un dominio o subdominio (por ejemplo `mcp-moodle.fluentia.marketing`), igual que hiciste con `docuseal` o `n8n`.
7. Despliega.
8. Comprueba que funciona visitando `https://<tu-dominio>/health` — debe devolver `{"status":"ok",...}`.

## Configuración en Cline

En el archivo `cline_mcp_settings.json`, añade una entrada nueva (respetando la sintaxis JSON — sin comas colgando):

```json
{
  "mcpServers": {
    "moodle-tutor": {
      "url": "https://<tu-dominio>/mcp",
      "transportType": "streamableHttp"
    }
  }
}
```

## Desarrollo local

```bash
npm install
npm run build
MOODLE_TOKEN=tu_token_aqui npm start
```

El servidor escuchará en `http://localhost:8420`, con el endpoint MCP en `POST /mcp` y salud en `GET /health`.
