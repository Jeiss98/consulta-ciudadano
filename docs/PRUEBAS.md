# Verificación de la entrega

## Revisión de la versión con Expo SDK 58

- 28 pruebas móviles aprobadas. Android generó el bundle de 614 módulos.
- 20 pruebas del servidor aprobadas con MariaDB 11.4.5 en una base desechable y un servidor SMTP local. Se verificaron recuperación y cambio autenticado con códigos de seis dígitos, rechazo de códigos alterados o usados y cierre de la sesión anterior.
- Validada la configuración combinada de Docker Compose. La prueba de integración de esta revisión usó MariaDB en lugar del contenedor MySQL 8.4. Queda la comprobación en el teléfono con la versión final.


## Actualización del lector: 21 de noviembre de 2026 (Bogotá)

- `cd mobile; npm test`: 28 pruebas aprobadas, incluyendo decodificación de los nueve PNG de prueba mediante ZXing WASM local y extracción de su identificación.
- Casos del parser: distribución PubDSK, ceros de relleno, ficha corta, nombres compuestos, campos opcionales vacíos, datos corruptos, fechas imposibles, preferencia de `raw` y compatibilidad con los códigos ficticios anteriores.
- `cd mobile; npm run export:android`: bundle JavaScript Android generado con Expo SDK 57 (600 módulos). Esto no equivale a un APK ni a una prueba de cámara en dispositivo.
- `cd server; npm run demo:codes`: generación de los tres PDF417 sintéticos con la distribución PubDSK, además de los seis PNG anteriores.
- Pendiente: captura de cédula física y flujo de confirmación/consulta en un Android real. No se repitieron las pruebas de MySQL, servidor o despliegue en esta actualización.

Guía y límites: [ESCANEO.md](ESCANEO.md). Evidencia de esta ejecución: `evidencia/pruebas-cedula-amarilla.txt` y `evidencia/bundle-cedula-amarilla.txt`.

## Evidencia histórica de la entrega original

Fecha de ejecución: 27 de septiembre de 2026, hora de Bogotá.

| Comprobación                                    | Resultado                                                                                         |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Script de creación sobre MySQL Community 8.0.46 | Ejecutado correctamente: tablas, restricciones, índices y triggers.                               |
| Semilla ficticia con Sequelize                  | Ejecutada con la cuenta `cc_app`.                                                                 |
| Integración de servidor                         | 19 pruebas aprobadas, 0 fallos.                                                                   |
| Parser móvil                                    | 2 pruebas aprobadas, 0 fallos.                                                                    |
| Bundle JavaScript Android                       | Expo SDK 57 generó el bundle de 600 módulos correctamente.                                        |
| Navegador de escritorio                         | Login, creación, auditoría, perfiles, usuarios y descarga PDF completados sin errores JavaScript. |
| Web a 390 px de ancho                           | Navegación adaptable y tabla con desplazamiento horizontal revisadas.                             |
| PDF                                             | Archivo generado y renderizado. Se revisaron tildes, columnas, encabezado y pie.                  |

## Pruebas de servidor

La suite usa una base exclusiva y desechable, un servicio HTTP de Defensa separado y un servidor SMTP local que recibe mensajes reales de Nodemailer.

1. Contraseña generada de seis caracteres con las tres clases requeridas.
2. Cookie HttpOnly en web y ausencia de hash/token en su respuesta pública.
3. Rechazo de acceso sin sesión y de escrituras sin cabecera requerida.
4. Rechazo de registro cuando no coincide con Defensa.
5. Registro con SMTP, bcrypt, login y rechazo de duplicados.
6. Reversión y auditoría cuando SMTP falla.
7. Prohibición de administración y reportes al personal de fuerza pública.
8. Consulta de ambos estados y de ciudadano inexistente, con auditoría.
9. Alta, validación de campos, duplicados y búsqueda de ciudadanos.
10. Edición auditada e inactivos excluidos de consultas.
11. Auditoría de SQL directo sin heredar el actor de una petición previa.
12. Generación PDF para los filtros y rechazo de reportes vacíos.
13. Usuario con varios perfiles y auditoría sin contraseñas ni hashes.
14. Inactivación con revocación de token y rechazo de login.
15. Protección del último administrador activo.
16. Bloqueo después de cinco intentos consecutivos fallidos.
17. Cambios de permisos aplicados sobre sesiones existentes.
18. Cambio de nombre de una opción reflejado en el catálogo del menú.
19. Vencimiento y cierre de sesión.

Los registros de ejecución están en `evidencia/`. Las capturas de la web muestran datos ficticios, incluido un ciudadano creado durante la prueba visual.

## Comprobaciones que requieren el entorno de destino

- Instalar/abrir la app en un Android físico y conceder/denegar el permiso de cámara.
- Escanear los PNG ficticios PDF417 y Code 128 desde otra pantalla.
- Cerrar y reabrir la app para comprobar SecureStore en ese dispositivo.
- Verificar el dominio HTTPS, su certificado y la conexión del teléfono con el servidor.
- Medir el tiempo completo de consulta con conexión estable para aceptar el objetivo de tres segundos.
- Ejecutar Docker Compose en el equipo de destino. Aquí se validaron los servicios Node y la base MySQL, no un despliegue de Docker/Caddy.

No se entrega un APK firmado. El README describe el uso con Expo Go y la generación del APK con Android Studio o EAS.
