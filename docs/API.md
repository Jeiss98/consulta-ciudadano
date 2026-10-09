# Contratos REST

Base: `https://<servidor>/api`. JSON UTF-8. Todas las escrituras requieren `X-Requested-With: ConsultaCiudadano` y `Content-Type: application/json`. Los endpoints de registro, login, salud y catálogos son públicos. Los demás requieren cookie web o `Authorization: Bearer <token>`.

## Autenticación

`POST /auth/login`

```json
{ "identificacion": "900100001", "password": "Clave1", "canal": "movil" }
```

Respuesta 200 móvil: `{ "token": "...", "expiresAt": "<fecha ISO>", "user": { "id": 1, "identificacion": "...", "nombres": "...", "apellidos": "...", "perfiles": [], "permisos": [] } }`. Web usa `canal: "web"`, recibe cookie HttpOnly y no recibe el token en el cuerpo.

`GET /auth/me` devuelve el usuario activo, sus perfiles y permisos, sin hash de contraseña. `POST /auth/logout` revoca la sesión actual.

## Registro

`POST /auth/registro`

```json
{
  "identificacion": "900100001",
  "nombres": "Laura",
  "apellidos": "Rojas Demo",
  "fuerza": "Policía",
  "rango": "Patrullero",
  "id_fuerza": "POL-DEMO-01",
  "correo": "laura@demo.example"
}
```

Respuesta 201: `{ "message": "Registro completado. Revisa el correo para conocer tu contraseña." }`. No devuelve la clave. 422 indica discrepancia con Defensa. 409 indica identificación duplicada. 503 indica fallo de validación externa o de SMTP.

`GET /catalogos` devuelve `{ "rangos": { "Policía": [...], "Ejército": [...], "Armada": [...], "Fuerza Aérea": [...] } }`.

## Consulta móvil

`GET /consulta/100200002`, perfil Fuerza pública y permiso `consulta.realizar`.

```json
{ "identificacion": "100200002", "estado": "Requerido", "requerido": true }
```

404: `{ "message": "Ciudadano no encontrado", "solicitud": "<uuid>" }`. Se registra también la consulta sin coincidencias.

## Ciudadanos

Perfil Administrador. `GET /ciudadanos` requiere `ciudadanos.leer`. `POST /ciudadanos` y `PUT /ciudadanos/:id` requieren `ciudadanos.escribir`.

Parámetros del listado: `page=1`, `size=10` (máximo 100), `q`, `estado=todos|requeridos|no_requeridos`, `incluir_inactivos=true|false`.

```json
{
  "identificacion": "100200010",
  "nombres": "Lucía",
  "apellidos": "Demo",
  "fecha_nacimiento": "1998-05-12",
  "lugar_nacimiento": "Bogotá",
  "fecha_expedicion": "2016-06-15",
  "lugar_expedicion": "Bogotá",
  "rh": "+",
  "grupo_sanguineo": "O",
  "estatura": 1.7,
  "requerido": false,
  "activo": true
}
```

Alta devuelve 201 con el registro y su `id`. Edición devuelve 200. Para inactivar, se envía el mismo formulario completo con `activo:false`.

## Usuarios

`GET /usuarios?page=1&size=10&q=...`, `POST /usuarios`, `PUT /usuarios/:id`. Perfil Administrador y permiso `usuarios.gestionar`.

```json
{
  "identificacion": "700000001",
  "nombres": "Ana",
  "apellidos": "Prueba",
  "correo": "ana@demo.example",
  "password": "Prueba2026",
  "activo": true,
  "perfiles": [1]
}
```

`password` es obligatorio al crear y opcional al editar. `perfiles` contiene IDs consultados en `/seguridad`, no códigos inventados. Devuelve el usuario sin su hash. Editarlo invalida sus sesiones.

## Seguridad

`GET /seguridad` devuelve `{perfiles, opciones, permisos}`. Requiere Administrador y `seguridad.gestionar` o `usuarios.gestionar`.

`GET /opciones` devuelve las opciones habilitadas por los permisos del usuario.

`POST /perfiles`, `PUT /perfiles/:id`, permiso `seguridad.gestionar`:

```json
{
  "codigo": "APOYO_REGISTRO",
  "nombre": "Apoyo de registro",
  "permisos": [1, 2]
}
```

Los IDs de permisos se obtienen de `/seguridad`. `PUT /opciones/:id` recibe `{ "nombre": "Ciudadanos" }`. El código de la opción es estable.

## Auditoría

`GET /auditoria?page=1&size=10&q=...`. Administrador con `auditoria.leer`. Devuelve registros ordenados de más reciente a más antiguo. `q` busca en actor, acción, tabla e ID del registro.

Un registro incluye `id`, `actor`, `accion`, `tabla`, `registro_id`, `antes`, `despues`, `fecha`, `ip` y `solicitud_id`. No hay endpoints para editar ni borrar auditoría.

## Reportes

`GET /reportes/ciudadanos.pdf?estado=todos|requeridos|no_requeridos`. Administrador con `reportes.generar`. Responde 200 con `application/pdf` y `Content-Disposition: attachment`. Sin resultados responde 404 JSON y no genera un PDF vacío.

## Formato de listas y errores

Listas: `{ "items": [], "total": 0, "page": 1, "pages": 1 }`.

| Código | Significado                                                                |
| ------ | -------------------------------------------------------------------------- |
| 400    | Datos inválidos, con `errors: [{field, message}]` cuando falla el esquema. |
| 401    | Credenciales inválidas o sesión ausente/vencida.                           |
| 403    | Permisos insuficientes o escritura sin cabecera requerida.                 |
| 404    | Registro o recurso no encontrado.                                          |
| 409    | Duplicado, relación inválida o intento de retirar el último administrador. |
| 422    | Defensa no confirma los datos.                                             |
| 429    | Bloqueo temporal o límite de intentos.                                     |
| 500    | Error interno con mensaje genérico y correlación de solicitud.             |
| 503    | Integración no disponible.                                                 |

Defensa simulada: `POST http://defensa:4001/validar`, cabecera `X-API-Key`, mismo cuerpo que registro, respuesta `{ "valido": true|false }`. La clave se configura con `DEFENSE_API_KEY` en ambos servicios.
