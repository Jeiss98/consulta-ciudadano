# Escaneo de la cédula amarilla

## Uso en Android

1. Configura `mobile/.env` a partir de `mobile/.env.example` con una API accesible desde el teléfono.
2. En `mobile`, ejecuta `npm ci` y `npm start`. Abre el proyecto con Expo Go compatible con SDK 58, o genera un APK siguiendo el README.
3. Inicia sesión y pulsa **Escanear código de barras**. Concede permiso de cámara.
4. Enfoca completo el PDF417 del **reverso de la cédula amarilla**. Mantén el documento horizontal dentro del marco, evita reflejos y ajusta la distancia. Usa **Encender luz**, **Acercar** o **Alejar** si hace falta.
5. La cámara se cierra al interpretar el código. Compara el número mostrado con el impreso en el frente y pulsa **Confirmar y consultar**.
6. Si la lectura falla, pulsa **Volver a leer** o **Ingresar número manualmente**. Si no coincide el número, vuelve a escanear o ingrésalo manualmente.

La lectura no requiere conexión. La consulta posterior sí requiere la API y una sesión. Un número correctamente leído puede dar **Sin registro en la base** si no está registrado en la base del proyecto. Los antecedentes proceden de esa base, no del código de barras ni de un servicio oficial.

## Implementación y alcance

La cámara usa `expo-camera`. En Android el evento expone `raw` (contenido original) y `data` (texto de presentación). Se prefiere `raw`; solo cuando está ausente o vacío se utiliza `data`. Un `raw` inválido no se sustituye por un `data` distinto.

El parser reconoce la distribución **PubDSK de posiciones fijas** documentada por [Eitol/colombian-cedula-reader](https://github.com/Eitol/colombian-cedula-reader#explicación). Es una referencia técnica comunitaria, no una especificación oficial ni una certificación de todas las variantes de cédula. No se incorporaron datos personales de sus ejemplos.

Los índices empiezan en cero y el final es exclusivo:

| Campo | Inicio | Final |
| --- | ---: | ---: |
| Cabecera con AFIS y marcador PubDSK | 0 | 40 |
| Ficha | 40 | 48 |
| Identificación, con relleno de ceros a la izquierda | 48 | 58 |
| Primer apellido | 58 | 81 |
| Segundo apellido | 81 | 104 |
| Primer nombre | 104 | 127 |
| Segundo nombre | 127 | 150 |
| Sexo | 151 | 152 |
| Nacimiento AAAAMMDD | 152 | 160 |

Se conservan los caracteres NUL y espacios antes de extraer los campos. Se comprueban cabecera, ficha, número, nombres, sexo y fecha para rechazar texto desplazado o incompleto. La aplicación devuelve únicamente la identificación; no registra ni transmite el payload, nombres, fecha o datos biométricos. Solo el número confirmado se envía a `/consulta/:id`.

Se mantienen los códigos ficticios numéricos, `CC:<número>` y JSON con `identificacion` de tipo texto. La API existente acepta identificaciones de 5 a 15 dígitos; el campo de la cédula amarilla tiene 10 posiciones, por lo que el parser admite de 5 a 10 dígitos después de quitar su relleno. No se amplió el contrato del servidor.

**Límites:** no incluye OCR del frente, cédula digital/MRZ, interpretación de variantes sin PubDSK, autenticación del documento ni recuperación de bytes perdidos por el lector. Si el SDK elimina los separadores o cambia la codificación y desplaza los campos, se rechaza la lectura. La cola binaria no se interpreta ni se valida como información biométrica. No se debe confundir una estructura reconocida con una prueba de autenticidad.

Referencia de la cámara: [Expo Camera](https://docs.expo.dev/versions/v58.0.0/sdk/camera/). La elección de `raw` se verificó además en `expo-camera/src/Camera.types.ts` y en los serializadores Android de la dependencia instalada.

## Pruebas reproducibles

```powershell
cd mobile
npm ci
npm test
npm run export:android
```

Para regenerar los códigos ficticios:

```powershell
cd server
npm ci
npm run demo:codes
```

`fixtures/cedulas/*-amarilla-sintetica.png` contiene PDF417 con campos ficticios y relleno NUL. Son datos de ensayo, sin biometría, generados por `amarilla-sintetica.mjs`. Permiten probar los tres resultados del sistema con `100200001`, `100200002` y `999999999`. No son imágenes ni copias de una cédula y no demuestran la lectura óptica de una cédula física. Los PNG cortos anteriores siguen disponibles.

En un teléfono deben comprobarse: permiso concedido/denegado, enfoque sobre una cédula física, luz/zoom, pausa tras errores, reintento, confirmación/cancelación, una sola consulta aunque lleguen varios eventos, segundo plano, error de red y documento inexistente. No subas fotos ni payloads de cédulas reales al repositorio.
