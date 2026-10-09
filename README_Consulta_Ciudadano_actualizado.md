# Consulta Ciudadano

Sistema académico para la Registraduría Konrad Lorenz. Incluye
administración web, aplicación móvil Android, API REST, MySQL y
auditoría de cambios.

**Stack:** Node.js 22, Express 5, Sequelize, MySQL 8.4 y React Native
con Expo SDK 57.

> El proyecto usa Node.js en lugar del stack Java del enunciado,
> siguiendo la decisión del equipo. Los datos y servicios de Defensa
> usados para las pruebas son ficticios.

## Índice

1.  [Requisitos previos](#1-requisitos-previos)
2.  [Arranque con Docker](#2-arranque-con-docker-recomendado)
3.  [Arranque sin Docker](#3-arranque-sin-docker)
4.  [App móvil Android](#4-app-móvil-android)
5.  [Uso del sistema web](#5-uso-del-sistema-web)
6.  [Uso de la app móvil](#6-uso-de-la-app-móvil)
7.  [Auditoría de cambios](#7-auditoría-de-cambios)
8.  [Estructura del proyecto](#8-estructura-del-proyecto)
9.  [Pruebas](#9-pruebas)
10. [Problemas frecuentes](#10-problemas-frecuentes)
11. [Seguridad y límites de la configuración de
    demostración](#11-seguridad-y-límites-de-la-configuración-de-demostración)

------------------------------------------------------------------------

## 1. Requisitos previos

### Para ejecutar con Docker (recomendado)

-   Docker Desktop 4.x o superior, con Docker Compose.
-   Windows con PowerShell, macOS o Linux.

Descarga: https://www.docker.com/products/docker-desktop

### Para ejecutar sin Docker

-   Node.js 22 LTS: https://nodejs.org
-   MySQL 8.x: https://dev.mysql.com/downloads
-   MySQL Workbench (opcional): https://www.mysql.com/products/workbench

### Para la app Android

-   Android con Expo Go compatible con la versión de Expo usada por el
    proyecto.
-   Node.js y npm instalados.
-   PC y teléfono conectados a la misma red Wi-Fi para la conexión local
    de Expo.
-   Para acceder a la API desde fuera de la red local, una URL accesible
    desde el teléfono.

## 2. Arranque con Docker (recomendado)

Docker levanta MySQL, API, servicio simulado de Defensa, correo de
pruebas y proxy HTTPS.

### Paso 1. Entrar a la raíz del proyecto

Abre PowerShell en la carpeta que contiene `compose.yaml`. Si
descargaste el proyecto en la ruta usada durante las pruebas, puedes
ejecutar:

``` powershell
cd C:\Users\user\Downloads\consulta-ciudadano\consulta-ciudadano
```

Comprueba que la carpeta contiene `compose.yaml` y `.env.example`:

``` powershell
Get-ChildItem
```

Crea el archivo de entorno solo si todavía no existe:

``` powershell
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

Revisa `.env` antes de usar otra configuración. Los valores incluidos
son de demostración.

### Paso 2. Construir e iniciar los servicios

``` powershell
docker compose up --build -d
```

La primera ejecución puede tardar varios minutos.

### Paso 3. Verificar los servicios

``` powershell
docker compose ps
```

Comprueba que MySQL y la aplicación estén `healthy`, y que los demás
servicios estén en ejecución. Para consultar registros:

``` powershell
docker compose logs -f app
```

Para salir de la vista de registros sin detener los contenedores, pulsa
`Ctrl+C`.

### Paso 4. Abrir los servicios locales

  Servicio                     Dirección
  ---------------------------- -----------------------
  Administración web           https://localhost
  Buzón de pruebas (Mailpit)   http://localhost:8025
  MySQL (desde Workbench)      `127.0.0.1:3306`

Caddy utiliza un certificado local. El navegador puede mostrar una
advertencia de certificado al entrar en `https://localhost`. Esto es
propio de la configuración local de desarrollo; no significa que debas
ignorar advertencias de certificados en sitios desconocidos.

### Credenciales de demostración

**Administración web**

  Campo            Valor
  ---------------- -------------
  Identificación   `100000001`
  Contraseña       `Admin2026`

**MySQL para Workbench**

  Parámetro       Valor
  --------------- ----------------------
  Host            `127.0.0.1`
  Puerto          `3306`
  Base de datos   `consulta_ciudadano`
  Usuario         `cc_app`
  Contraseña      `CcLocal2026_demo`

No reutilices estas credenciales en una instalación real.

### Detener el sistema

Detener los contenedores conservando los datos:

``` powershell
docker compose down
```

Detenerlos y borrar también los volúmenes de datos (la base de datos se
inicializará limpia en el siguiente arranque):

``` powershell
docker compose down -v
```

**Advertencia:** `docker compose down -v` elimina los datos persistidos
de los volúmenes. No lo uses si necesitas conservar la información.

## 3. Arranque sin Docker

Esta modalidad requiere configurar MySQL y ejecutar por separado el
servidor, el servicio simulado de Defensa y, opcionalmente, Mailpit.

### Paso 1. Preparar MySQL

Con una cuenta administradora, ejecuta en orden:

1.  `database/01-schema.sql`: crea la base de datos, las tablas, los
    índices y los triggers de auditoría.
2.  `database/02-permissions.sql`: configura el usuario de aplicación y
    sus permisos.

### Paso 2. Configurar el servidor

Desde la raíz del proyecto:

``` powershell
cd server
npm ci
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
notepad .env
```

Configura las variables según tu entorno. Los valores típicos de
desarrollo incluyen:

``` dotenv
NODE_ENV=development
PORT=3000
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=consulta_ciudadano
DB_USER=cc_app
DB_PASSWORD=CcLocal2026_demo
DEFENSE_URL=http://127.0.0.1:4001/validar
DEFENSE_API_KEY=defensa-solo-demo
SMTP_HOST=127.0.0.1
SMTP_PORT=1025
ADMIN_PASSWORD=Admin2026
```

Si el archivo `.env.example` de tu versión contiene otras variables
obligatorias, consérvalas y configúralas de acuerdo con los comentarios
del archivo.

### Paso 3. Cargar datos iniciales

Desde `server/`:

``` powershell
npm run db:seed
```

Esto carga los datos de demostración definidos por el proyecto.

### Paso 4. Iniciar el servidor

Desde `server/`:

``` powershell
npm run dev
```

En modo sin Docker, el servidor se configura normalmente en
`http://localhost:3000`.

### Paso 5. Iniciar el servicio simulado de Defensa

Abre otra terminal en `server/` y ejecuta:

``` powershell
npm run mock:defensa
```

Déjalo activo mientras pruebes el registro de personal.

### Paso 6. Iniciar Mailpit (opcional)

Si tienes Docker disponible aunque ejecutes la aplicación sin Docker,
puedes iniciar el buzón de pruebas con:

``` powershell
docker run --rm --name cc-correo -p 127.0.0.1:1025:1025 -p 127.0.0.1:8025:8025 axllent/mailpit:v1.27
```

Abre http://localhost:8025 para revisar los correos de prueba. En modo
Docker, el host SMTP suele ser el nombre del servicio (`correo`); en
modo local, `127.0.0.1`.

## 4. App móvil Android

La aplicación móvil se ejecuta con Expo. Para abrirla mediante Expo Go,
el servidor Metro debe permanecer activo. Además, la app necesita una
URL de API que sea accesible desde el teléfono. **`localhost` en el
teléfono se refiere al propio teléfono, no al PC.**

### Paso 1. Mantener activo el backend

Si usas Docker, inicia el stack desde la raíz del proyecto:

``` powershell
docker compose up -d
```

Comprueba que la web local funcione en https://localhost.

### Paso 2. Proporcionar una URL accesible para la API

Hay dos opciones habituales:

-   **Red local:** configura la URL con la dirección IP local del PC y
    el puerto que realmente exponga el servidor/API. El teléfono y el PC
    deben estar en la misma red, y el firewall debe permitir la
    conexión.
-   **Cloudflare Tunnel temporal:** permite llegar desde el teléfono a
    un servicio local a través de una URL HTTPS. Es útil para
    demostraciones, pero hace accesible el servicio desde Internet
    mientras el túnel está activo. Usa solo datos ficticios.

#### Cloudflare Tunnel en Windows con el proxy Docker/Caddy

En las pruebas de este proyecto, la web funcionó en `https://localhost`
y Caddy redirigía el puerto HTTP 80 a HTTPS. Para evitar el problema del
encabezado de host y el certificado local, el túnel se inició contra
HTTPS local con el encabezado `localhost`.

Instala `cloudflared` desde la documentación oficial:
https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/download/

Si el comando no se reconoce después de instalarlo, abre una nueva
terminal. Si se descargó el ejecutable en
`C:\cloudflared\cloudflared.exe`, puedes invocarlo por su ruta completa:

``` powershell
& "C:\cloudflared\cloudflared.exe" --version
```

Inicia el túnel:

``` powershell
& "C:\cloudflared\cloudflared.exe" tunnel --url https://localhost:443 --no-tls-verify --http-host-header localhost
```

Mantén esa terminal abierta. Copia la dirección
`https://....trycloudflare.com` que aparezca en la salida. La dirección
temporal puede cambiar cuando se reinicia el túnel.

Verifica que la dirección pública carga la web antes de continuar. Si no
carga, revisa los registros del túnel y del proxy. No continúes con la
configuración móvil hasta que el acceso público funcione.

> **Seguridad:** un túnel temporal publica el servicio en Internet. No
> uses datos reales, contraseñas personales ni información sensible.
> Detén el túnel con `Ctrl+C` al terminar las pruebas. Para un
> despliegue estable, configura un dominio y controles de acceso
> adecuados.

### Paso 3. Configurar `mobile/.env`

Abre una segunda ventana de PowerShell y entra a la carpeta móvil:

``` powershell
cd C:\Users\user\Downloads\consulta-ciudadano\consulta-ciudadano\mobile
```

Crea `.env` únicamente si no existe:

``` powershell
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
notepad .env
```

Configura `EXPO_PUBLIC_API_URL` con la URL que realmente corresponda a
la API. En la configuración de demostración usada en las pruebas, la
ruta era `/api`:

``` dotenv
EXPO_PUBLIC_API_URL=https://<dominio-actual-del-tunel>.trycloudflare.com/api
```

Reemplaza el ejemplo por tu dominio real. No escribas los símbolos `<` y
`>` en la URL. Si tu configuración de proxy publica la API en otra ruta,
utiliza la ruta definida por el proyecto.

No publiques el archivo `.env` ni lo sobrescribas si ya contiene una URL
válida.

### Paso 4. Instalar dependencias e iniciar Expo

Desde `mobile/`:

``` powershell
npm ci
npx expo start --clear
```

`npm ci` instala las versiones del archivo `package-lock.json`. Puede
mostrar avisos de dependencias obsoletas o vulnerabilidades. Revisa los
avisos por separado; no ejecutes `npm audit fix --force` sin evaluar los
cambios, porque puede introducir incompatibilidades.

Cuando Metro inicie, aparecerá un código QR y una dirección parecida a
`exp://192.168.1.20:8081`.

### Paso 5. Abrir en Android

1.  Instala Expo Go desde Google Play:
    https://play.google.com/store/apps/details?id=host.exp.exponent
2.  Conecta el teléfono y el PC a la misma red Wi-Fi.
3.  Escanea el QR con Expo Go.
4.  Mantén abierta la terminal de Expo. También deben permanecer activos
    Docker y el túnel si la API depende de ellos.

Si Metro no conecta, primero comprueba la red local y el firewall. El
túnel de Cloudflare usado para la API no sustituye al servidor Metro que
entrega el código de la app.

### Compilar una aplicación instalable (opcional)

La ejecución con Expo Go es para desarrollo y pruebas. Para crear una
compilación independiente, revisa la configuración de Expo/EAS del
proyecto y sus requisitos. Por ejemplo, si EAS CLI está disponible y la
cuenta está configurada:

``` powershell
npx eas-cli build --platform android --profile preview
```

No se considera que exista un APK de producción hasta completar y
verificar la compilación.

## 5. Uso del sistema web

Ingresa en `https://localhost` cuando uses Docker, o en la URL local
configurada cuando ejecutes el servidor sin Docker.

  -----------------------------------------------------------------------
  Módulo                              Funciones principales
  ----------------------------------- -----------------------------------
  Ciudadanos                          Buscar, registrar, editar, cambiar
                                      el estado (Requerido/No requerido)
                                      e inactivar

  Usuarios                            Crear y editar cuentas, asignar
                                      perfiles y activar/inactivar
                                      usuarios

  Perfiles y permisos                 Crear perfiles y configurar
                                      permisos

  Reportes                            Filtrar ciudadanos y descargar
                                      reportes PDF

  Auditoría                           Buscar operaciones y consultar los
                                      valores anteriores y posteriores
  -----------------------------------------------------------------------

Inactivar un ciudadano conserva sus datos y el historial de auditoría.

## 6. Uso de la app móvil

### Registro de personal

Los datos de ejemplo para el servicio simulado de Defensa son:

  Campo            Valor
  ---------------- ----------------------
  Identificación   `900100001`
  Nombres          `Laura`
  Apellidos        `Rojas Demo`
  Fuerza pública   Policía
  Rango            Patrullero
  ID de fuerza     `POL-DEMO-01`
  Correo           `laura@demo.example`

El servicio simulado valida los datos y envía una contraseña al correo
de prueba. Con Docker, abre http://localhost:8025 en el PC para
consultar el mensaje. En el teléfono, `localhost` no apunta al PC.

### Inicio de sesión y consultas

-   Inicia sesión con la identificación y la contraseña generada por el
    registro.
-   Para consultar, escanea el código de barras del reverso de una
    cédula de prueba o introduce manualmente el número.
-   Si usas el lector, concede el permiso de cámara.
-   Los PNG de prueba están en `fixtures/cedulas/`.

  Identificación de prueba   Resultado esperado
  -------------------------- -------------------------
  `100200001`                No requerido
  `100200002`                Requerido
  `999999999`                Ciudadano no encontrado

Cada consulta debe quedar registrada de acuerdo con las funciones de
auditoría implementadas. Estos identificadores son ficticios y no deben
confundirse con documentos reales.

## 7. Auditoría de cambios

La tabla `auditoria` registra, según la operación implementada:

-   `actor`: usuario o cuenta que realizó la operación.
-   `accion`: operación realizada, como `INSERT`, `UPDATE`, `DELETE`,
    `LOGIN` o `CONSULTA`.
-   `tabla` y `registro_id`: registro afectado.
-   `antes` y `despues`: valores JSON, sin contraseñas ni hashes.
-   `ip`, `solicitud_id` y fecha UTC.

Los triggers de base de datos registran los cambios que cubren; la API
también registra eventos de aplicación como consultas y accesos.

Consulta de ejemplo en MySQL Workbench:

``` sql
USE consulta_ciudadano;

SELECT id, fecha, actor, accion, tabla, registro_id, antes, despues
FROM auditoria
ORDER BY id DESC
LIMIT 50;
```

## 8. Estructura del proyecto

``` text
consulta-ciudadano/
├── server/       API REST, ORM, seguridad e integraciones
├── web/          Administración web
├── mobile/       App React Native/Expo
├── database/     Scripts SQL de esquema y permisos
├── fixtures/     Datos ficticios para demostración
├── infra/        Configuración del proxy HTTPS (Caddy)
├── docs/         Arquitectura, trazabilidad y documentación
├── compose.yaml  Orquestación Docker
└── Dockerfile    Imagen de la aplicación
```

Consulta `docs/ESTADO_CUMPLIMIENTO.md` para conocer el estado funcional
y los pendientes registrados. Los resultados previos de pruebas que
existan en `docs/evidencia/` son evidencias guardadas, no sustituyen una
nueva ejecución de las pruebas.

La presentación ejecutiva editable, si está presente en la versión del
repositorio, se encuentra en
`docs/Presentacion_ejecutiva_Consulta_Ciudadano.pptx`.

## 9. Pruebas

### Servidor

Las pruebas usan una base de datos separada (`consulta_ciudadano_test`)
que puede reiniciarse durante su preparación. Ejecuta estos comandos
solo si la base de pruebas está configurada y no contiene datos que
necesites conservar.

Desde `server/`:

``` powershell
node scripts/setup-test-db.js
$env:DB_NAME="consulta_ciudadano_test"
$env:DB_USER="cc_test"
$env:DB_PASSWORD="CcTest2026"
npm test
Remove-Item Env:DB_NAME, Env:DB_USER, Env:DB_PASSWORD
```

### Móvil

Desde `mobile/`:

``` powershell
npm test
```

### Prueba manual recomendada

1.  Confirmar que `docker compose ps` muestra los servicios activos.
2.  Abrir la administración web local.
3.  Abrir la app desde Expo Go.
4.  Probar el inicio de sesión con cuentas de demostración.
5.  Realizar consultas usando identificadores ficticios.
6.  Revisar que las respuestas de la API sean correctas y que se
    registren los eventos esperados.

## 10. Problemas frecuentes

  -----------------------------------------------------------------------
  Problema                            Solución
  ----------------------------------- -----------------------------------
  `.env.example` no se encuentra o    Entra en la carpeta que contiene
  aparece                             `compose.yaml` antes de ejecutar
  `no configuration file provided`    los comandos.

  Docker no inicia                    Abre Docker Desktop y espera a que
                                      el motor esté listo.

  Puerto 3306 ocupado                 Comprueba si tienes MySQL local
                                      activo o cambia la publicación del
                                      puerto en `compose.yaml`.

  `app` no aparece como `healthy`     Ejecuta `docker compose logs app` y
                                      revisa el error concreto.

  No conecta a MySQL                  Comprueba `DB_HOST`, `DB_PORT`,
                                      usuario y contraseña en el archivo
                                      de entorno correspondiente.

  No llega el correo de prueba        Abre http://localhost:8025 y
                                      comprueba la configuración SMTP.
                                      Con Docker el host suele ser
                                      `correo`; en modo local,
                                      `127.0.0.1`.

  Defensa rechaza el registro         Comprueba que los campos coincidan
                                      con los datos de prueba del
                                      servicio simulado.

  `cloudflared` no se reconoce        Comprueba que esté instalado, abre
                                      una terminal nueva o ejecuta el
                                      `.exe` mediante su ruta completa.

  La URL de Cloudflare no abre        Mantén activo el túnel, usa la URL
                                      de la ejecución actual y verifica
                                      primero `https://localhost`.

  Cloudflare carga una página en      Comprueba la respuesta HTTP y el
  blanco                              contenido recibido; revisa los
                                      registros del túnel y del proxy. En
                                      esta configuración, el encabezado
                                      `localhost` puede ser necesario
                                      para Caddy.

  Expo Go no conecta con Metro        Comprueba que el teléfono y el PC
                                      estén en la misma Wi-Fi, que Metro
                                      siga activo y que el firewall no
                                      bloquee el puerto.

  La app abre, pero no consulta datos Revisa `EXPO_PUBLIC_API_URL`, la
                                      ruta `/api`, la URL actual del
                                      túnel y los registros del backend.
                                      Reinicia Expo con
                                      `npx expo start --clear` después de
                                      cambiar `.env`.

  La cámara no abre                   Revisa los permisos de cámara de
                                      Android y vuelve a abrir el lector.
                                      Como alternativa, usa la consulta
                                      manual.

  Los cambios de `.env` no se         Reinicia el proceso que consume la
  reflejan                            variable. Para Expo, usa
                                      `npx expo start --clear`. Si es una
                                      variable integrada en un APK,
                                      recompila la app.
  -----------------------------------------------------------------------

## 11. Seguridad y límites de la configuración de demostración

-   Las credenciales y los datos de este README son exclusivamente de
    demostración.
-   No introduzcas datos personales reales en una instancia de prueba
    expuesta mediante Cloudflare Tunnel.
-   Un túnel temporal es público para quien tenga la URL y no equivale a
    un despliegue de producción con autenticación perimetral, control de
    acceso, monitoreo y dominio administrado.
-   No publiques `.env`, tokens, contraseñas ni información sensible en
    el repositorio.
-   Mantén actualizadas las dependencias, pero revisa el impacto de los
    cambios antes de aplicarlos.
-   Antes de desplegar el sistema para usuarios reales, revisa la
    autorización, protección de datos, HTTPS, gestión de sesiones,
    copias de seguridad, auditoría y configuración de producción.
