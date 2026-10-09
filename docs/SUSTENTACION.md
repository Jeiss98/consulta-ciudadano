# Guía breve de presentación y sustentación

## Presentación ejecutiva

### 1. Necesidad del cliente

La Registraduría necesita administrar los datos del ciudadano y permitir que el personal de fuerza pública consulte su estado desde un teléfono. La solución conecta el registro web con una aplicación móvil autenticada.

### 2. Demostración del registro

Entrar como administrador, buscar un ciudadano y editar su estado. Mostrar que no se puede duplicar una identificación. Explicar que la inactivación conserva el historial.

### 3. Demostración móvil

Registrar a Laura con los datos ficticios de Defensa. Mostrar el correo en Mailpit. Iniciar sesión y escanear los códigos de “Requerido”, “No requerido” y “Ciudadano no encontrado”.

### 4. Control de acceso y trazabilidad

Mostrar los perfiles y permisos. Inactivar una cuenta. Abrir Auditoría y comparar el antes y el después de una modificación. Explicar que los triggers también registran SQL directo.

### 5. Reporte para el cliente

Filtrar ciudadanos y descargar el PDF. Mostrar identificación, nombres, apellidos, filtro, fecha y total. El beneficio concreto es obtener una copia del registro con el criterio elegido.

### 6. Cierre técnico

La entrega conserva las siete historias de usuario y añade la auditoría solicitada. Node/JavaScript y MySQL corresponden al cambio de tecnología solicitado. Para demostrar el escaneo físico se necesitan el teléfono, los códigos ficticios y HTTPS configurado.

## Preguntas para el líder técnico

**¿Por qué hay un ORM?** Sequelize relaciona modelos JavaScript con tablas MySQL y genera consultas parametrizadas. Se usa SQL explícito para crear el esquema, los permisos y los triggers.

**¿Cómo se almacenan las contraseñas?** Como hashes bcrypt con factor 12. La contraseña original no queda en MySQL ni en auditoría. La contraseña inicial se envía por SMTP porque lo pide el enunciado.

**¿Cómo se identifica quién cambió un ciudadano?** La API pasa el actor a una variable de la conexión durante la transacción. El trigger guarda actor, valores y contexto. Una operación SQL sin contexto guarda la cuenta MySQL.

**¿Qué diferencia hay entre perfil y permiso?** El perfil reúne permisos y se asigna al usuario. El permiso habilita una operación concreta. El servidor aplica las restricciones aunque se oculte o modifique la interfaz.

**¿Qué ocurre al desactivar un usuario?** La API revoca sus sesiones y cada petición vuelve a comprobar si está activo.

**¿Cómo funciona Defensa?** Es un servicio simulado separado que contrasta los datos contra cuatro registros ficticios, tal como permite HU-003. No hay conexión con una entidad real.

**¿Qué pasa si falla el correo?** Se revierte la creación del usuario y se guarda un evento de fallo. No se deja un usuario creado sin que SMTP haya aceptado sus credenciales.

**¿Cómo se prueba?** Hay pruebas de integración con MySQL, SMTP y Defensa separados, pruebas del parser y comprobación del bundle Android. La cámara y la latencia extremo a extremo se validan en un teléfono.

**¿Se borran los ciudadanos?** En la aplicación se inactivan. Los informes y la consulta móvil solo usan los activos.

**¿La auditoría es inalterable?** La cuenta de la aplicación no puede borrarla ni modificarla. Una cuenta root conserva control de la base. Por eso cada operador de MySQL debe usar una cuenta propia.
