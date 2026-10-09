# Arquitectura y decisiones

## Alcance y precedencia

Las fuentes funcionales son `ProyectoII_SistemaConsultaCiudadano(2).pdf`, `Planeacion Consulta Ciudadano 1.0(2).docx` y su Excel. La instrucción posterior del usuario sustituye Java por Node.js/JavaScript y fija MySQL. También solicita auditoría de modificaciones y datos ficticios. No se incorporan pagos, mapas, carga de fotografías, denuncias, historial judicial detallado ni otros módulos ajenos al alcance.

## Componentes

| Componente       | Responsabilidad                                                                  |
| ---------------- | -------------------------------------------------------------------------------- |
| Web              | Administración para el perfil Administrador. Consume la API en el mismo origen.  |
| Móvil Expo       | Registro y consulta del personal de fuerza pública con cámara.                   |
| Express          | Endpoints REST, validación, autorización y coordinación de transacciones.        |
| Sequelize        | Mapeo de entidades y consultas parametrizadas a MySQL.                           |
| MySQL            | Persistencia relacional, restricciones, índices y auditoría mediante triggers.   |
| Defensa simulada | Servicio HTTP separado que contrasta todos los campos contra una lista ficticia. |
| SMTP / Mailpit   | Envío real por SMTP hacia un buzón local de demostración.                        |
| Caddy            | Terminación HTTPS y proxy inverso hacia Node.                                    |

## Modelo relacional

- `usuarios` se relaciona con `perfiles` mediante `usuario_perfiles`.
- `perfiles` se relaciona con `permisos` mediante `perfil_permisos`.
- Cada `permiso` pertenece a una `opcion` del sistema.
- `sesiones` pertenece a un usuario y guarda solo el SHA-256 del token opaco.
- `ciudadanos` conserva los datos de cédula y las banderas `requerido` y `activo`.
- `intentos_acceso` mantiene el contador y vencimiento de bloqueo por identificación.
- `auditoria` conserva instantáneas sin depender de una FK al registro auditado, para que un borrado no elimine el historial.

Los códigos de permisos son un catálogo de funcionalidades implementadas. Se pueden asignar o retirar por perfil, y renombrar las opciones. Inventar un código de permiso no crea un endpoint nuevo.

## Seguridad

Las claves se almacenan con bcrypt y factor 12. El token usa 32 bytes aleatorios y dura ocho horas. Web recibe una cookie HttpOnly, SameSite Strict y Secure en despliegue. Móvil recibe el token Bearer. Los tokens se almacenan como hash en MySQL y se revocan al editar usuarios o cerrar sesión. El filtro consulta en cada petición el estado activo y los permisos actuales, de modo que un cambio de perfil tiene efecto sobre sesiones existentes.

Las peticiones de escritura requieren `X-Requested-With: ConsultaCiudadano`. La web usa el mismo origen, no hay CORS abierto y no se aceptan formularios cross-site como escrituras de API. Helmet establece las cabeceras del navegador. El límite de intentos por IP complementa el bloqueo persistente por identificación.

La contraseña inicial del registro móvil tiene exactamente seis caracteres con mayúscula, minúscula y número, como exige el documento. Los usuarios creados desde web usan mínimo seis caracteres. Se conserva ese requisito explícito.

Los cambios auditados y la modificación de datos comparten la misma transacción. Las variables de conexión con el actor/IP se limpian antes de devolver la conexión al pool. Los triggers permiten registrar también cambios hechos directamente en SQL. La cuenta de servicio no tiene UPDATE/DELETE sobre auditoría ni privilegios para eliminar triggers.

## Registro y correo

La API valida campos y catálogo, consulta a Defensa, genera la clave y crea el usuario dentro de una transacción. Si SMTP falla, revierte el usuario y registra `CORREO_FALLIDO` fuera de la transacción revertida. Si SMTP acepta el mensaje, registra `CORREO_ENVIADO` y confirma los datos.

SMTP y MySQL no comparten una transacción distribuida. Si el servidor falla después de aceptar el correo pero antes del commit, puede llegar un correo para un registro que no se completó. El usuario puede volver a registrarse. No se implementa una cola de correo porque no está prevista en el alcance.

## Supuestos de demostración

1. Android satisface la alternativa “Android o iOS”. Expo mantiene el código compartido, pero esta entrega valida el bundle Android.
2. Defensa es simulada, según HU-003. Solo valida los registros de `fixtures/defensa.json`.
3. Los catálogos de rangos son una selección ficticia operativa, sin afirmar exhaustividad oficial.
4. Estatura se expresa en metros y se valida entre 0,50 y 2,50. Identificación tiene entre 5 y 15 dígitos.
5. Las bajas de ciudadanos se implementan como inactivación, de acuerdo con la planeación.
6. Los informes y la consulta móvil utilizan registros activos. La administración puede incluir inactivos en la búsqueda.
7. No se infiere el formato binario de una cédula real. Los códigos de demostración contienen una identificación inequívoca en texto, `CC:<id>` o JSON.
8. Las fechas del historial se almacenan en UTC. La web y los reportes muestran hora de Bogotá.
9. El tiempo máximo de tres segundos es un criterio de aceptación que debe medirse con el teléfono y la conexión del despliegue. La app limita a tres segundos cada solicitud de consulta y comunica un timeout, lo cual no garantiza el tiempo de respuesta de una red externa.
10. Para operar en varios teléfonos se requiere HTTPS con un certificado confiable. El HTTP de localhost queda limitado al desarrollo de la web.

## Organización del código

`models.js` contiene el mapeo ORM. `validation.js` centraliza contratos y reglas de campos. `auth.js` gestiona sesiones, autorización y bloqueo. `audit.js` delimita transacciones auditadas. `integrations.js` coordina Defensa y SMTP. `pdf.js` genera el reporte. `app.js` conecta los endpoints con esas funciones y `index.js` inicia el servidor.

La web separa el cliente HTTP de las pantallas. La app separa el cliente de API y el parser de códigos de las vistas React Native. Los errores visibles evitan exponer consultas SQL, claves y trazas internas.
