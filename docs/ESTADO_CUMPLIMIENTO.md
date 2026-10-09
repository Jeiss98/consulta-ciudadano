# Revisión de cumplimiento y pendientes

Revisión del código y la evidencia entregada frente a `ProyectoII_SistemaConsultaCiudadano (1).pdf`. Se dejan fuera los requisitos de selección de tecnologías.

## Implementado en el código

- Registro móvil con los campos requeridos, validación de rango por fuerza, contraseña generada de seis caracteres y envío por correo.
- Inicio de sesión móvil, opción para recordar credenciales en almacenamiento seguro y consulta de estado.
- Administración de ciudadanos con los datos del enunciado, búsquedas, edición e inactivación.
- Perfiles y permisos aplicados en servidor.
- Reporte PDF con filtro por estado, identificación, nombres, apellidos, fecha y total.

## Parcial o pendiente de validación

- **Defensa:** el proyecto consulta un servicio simulado con registros ficticios. No está conectado a una base de datos real del Departamento de Defensa. La demostración no confirma esta integración externa.
- **Escaneo:** hay cámara y fixtures PDF417/Code 128 de demostración. Falta probarlos en un Android físico y validar un código de una cédula real.
- **Latencia móvil:** la app limita la petición a tres segundos, pero el tiempo extremo a extremo debe medirse con el teléfono y el servidor de destino.
- **Despliegue:** el Compose y HTTPS están configurados; la evidencia suministrada no acredita haber levantado Docker Compose en el equipo de entrega.

## Evidencia existente

`docs/evidencia/pruebas-servidor.txt` registra 19 pruebas aprobadas; `docs/evidencia/pruebas-lector.txt` registra 2; `docs/evidencia/bundle-android.txt` registra la generación del bundle Android. Son resultados documentados por el proyecto y no sustituyen la validación en los dispositivos y servicios externos indicados arriba.

## Entrega

El proyecto contiene fuentes, documentación y scripts SQL. La carpeta puede comprimirse para entregar; el archivo de distribución generado para esta revisión excluye configuraciones `.env`, dependencias instaladas y datos locales.

La guía `docs/SUSTENTACION.md` sirve como guion oral. La presentación ejecutiva se entrega además como archivo editable `.pptx`.
