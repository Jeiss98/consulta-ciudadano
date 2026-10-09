-- MySQL 8.0+ / 8.4. Ejecutar una vez en una base nueva.
CREATE DATABASE IF NOT EXISTS consulta_ciudadano CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE consulta_ciudadano;
CREATE TABLE IF NOT EXISTS usuarios (
 id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, identificacion VARCHAR(15) NOT NULL UNIQUE,
 nombres VARCHAR(80) NOT NULL, apellidos VARCHAR(80) NOT NULL, correo VARCHAR(150) NOT NULL,
 password_hash VARCHAR(100) NOT NULL, activo BOOLEAN NOT NULL DEFAULT TRUE,
 fuerza VARCHAR(30), rango VARCHAR(60), id_fuerza VARCHAR(30)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS perfiles (id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,codigo VARCHAR(40) NOT NULL UNIQUE,nombre VARCHAR(80) NOT NULL) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS opciones (id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,codigo VARCHAR(40) NOT NULL UNIQUE,nombre VARCHAR(80) NOT NULL) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS permisos (id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,codigo VARCHAR(60) NOT NULL UNIQUE,opcion_id INT UNSIGNED NOT NULL,nombre VARCHAR(100) NOT NULL,FOREIGN KEY(opcion_id) REFERENCES opciones(id)) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS usuario_perfiles (usuario_id INT UNSIGNED NOT NULL,perfil_id INT UNSIGNED NOT NULL,PRIMARY KEY(usuario_id,perfil_id),FOREIGN KEY(usuario_id) REFERENCES usuarios(id),FOREIGN KEY(perfil_id) REFERENCES perfiles(id)) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS perfil_permisos (perfil_id INT UNSIGNED NOT NULL,permiso_id INT UNSIGNED NOT NULL,PRIMARY KEY(perfil_id,permiso_id),FOREIGN KEY(perfil_id) REFERENCES perfiles(id),FOREIGN KEY(permiso_id) REFERENCES permisos(id)) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS ciudadanos (
 id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,identificacion VARCHAR(15) NOT NULL UNIQUE,
 nombres VARCHAR(80) NOT NULL,apellidos VARCHAR(80) NOT NULL,
 fecha_nacimiento DATE NOT NULL,lugar_nacimiento VARCHAR(120) NOT NULL,
 fecha_expedicion DATE NOT NULL,lugar_expedicion VARCHAR(120) NOT NULL,
 rh ENUM('+','-') NOT NULL,grupo_sanguineo ENUM('A','B','AB','O') NOT NULL,
 estatura DECIMAL(3,2) NOT NULL,requerido BOOLEAN NOT NULL DEFAULT FALSE,activo BOOLEAN NOT NULL DEFAULT TRUE,
 CHECK(estatura BETWEEN 0.50 AND 2.50),CHECK(fecha_expedicion>=fecha_nacimiento),
 INDEX idx_estado (activo,requerido),INDEX idx_nombre (apellidos,nombres)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS sesiones (hash CHAR(64) PRIMARY KEY,usuario_id INT UNSIGNED NOT NULL,expira DATETIME(3) NOT NULL,FOREIGN KEY(usuario_id) REFERENCES usuarios(id),INDEX(expira)) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS intentos_acceso (identificacion VARCHAR(15) PRIMARY KEY,fallos INT NOT NULL DEFAULT 0,bloqueado_hasta DATETIME(3)) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS auditoria (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,actor VARCHAR(100) NOT NULL,accion VARCHAR(40) NOT NULL,
 tabla VARCHAR(60) NOT NULL,registro_id VARCHAR(80),antes JSON,despues JSON,ip VARCHAR(64),
 solicitud_id VARCHAR(36),fecha DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 INDEX idx_auditoria_fecha(fecha),INDEX idx_auditoria_actor(actor),INDEX idx_auditoria_registro(tabla,registro_id)
) ENGINE=InnoDB;

DROP TRIGGER IF EXISTS audit_usuarios_insert;
CREATE TRIGGER audit_usuarios_insert AFTER INSERT ON usuarios FOR EACH ROW
 INSERT INTO auditoria(actor,accion,tabla,registro_id,antes,despues,ip,solicitud_id)
 VALUES(COALESCE(@audit_actor,CONCAT('BD:',USER())),'INSERT','usuarios',CAST(NEW.id AS CHAR),NULL,JSON_OBJECT('id', NEW.id, 'identificacion', NEW.identificacion, 'nombres', NEW.nombres, 'apellidos', NEW.apellidos, 'correo', NEW.correo, 'activo', NEW.activo, 'fuerza', NEW.fuerza, 'rango', NEW.rango, 'id_fuerza', NEW.id_fuerza),@audit_ip,@audit_request);

DROP TRIGGER IF EXISTS audit_usuarios_update;
CREATE TRIGGER audit_usuarios_update AFTER UPDATE ON usuarios FOR EACH ROW
 INSERT INTO auditoria(actor,accion,tabla,registro_id,antes,despues,ip,solicitud_id)
 VALUES(COALESCE(@audit_actor,CONCAT('BD:',USER())),'UPDATE','usuarios',CAST(NEW.id AS CHAR),JSON_OBJECT('id', OLD.id, 'identificacion', OLD.identificacion, 'nombres', OLD.nombres, 'apellidos', OLD.apellidos, 'correo', OLD.correo, 'activo', OLD.activo, 'fuerza', OLD.fuerza, 'rango', OLD.rango, 'id_fuerza', OLD.id_fuerza, 'clave_modificada', NOT (OLD.password_hash <=> NEW.password_hash)),JSON_OBJECT('id', NEW.id, 'identificacion', NEW.identificacion, 'nombres', NEW.nombres, 'apellidos', NEW.apellidos, 'correo', NEW.correo, 'activo', NEW.activo, 'fuerza', NEW.fuerza, 'rango', NEW.rango, 'id_fuerza', NEW.id_fuerza, 'clave_modificada', NOT (OLD.password_hash <=> NEW.password_hash)),@audit_ip,@audit_request);

DROP TRIGGER IF EXISTS audit_usuarios_delete;
CREATE TRIGGER audit_usuarios_delete AFTER DELETE ON usuarios FOR EACH ROW
 INSERT INTO auditoria(actor,accion,tabla,registro_id,antes,despues,ip,solicitud_id)
 VALUES(COALESCE(@audit_actor,CONCAT('BD:',USER())),'DELETE','usuarios',CAST(OLD.id AS CHAR),JSON_OBJECT('id', OLD.id, 'identificacion', OLD.identificacion, 'nombres', OLD.nombres, 'apellidos', OLD.apellidos, 'correo', OLD.correo, 'activo', OLD.activo, 'fuerza', OLD.fuerza, 'rango', OLD.rango, 'id_fuerza', OLD.id_fuerza),NULL,@audit_ip,@audit_request);

DROP TRIGGER IF EXISTS audit_ciudadanos_insert;
CREATE TRIGGER audit_ciudadanos_insert AFTER INSERT ON ciudadanos FOR EACH ROW
 INSERT INTO auditoria(actor,accion,tabla,registro_id,antes,despues,ip,solicitud_id)
 VALUES(COALESCE(@audit_actor,CONCAT('BD:',USER())),'INSERT','ciudadanos',CAST(NEW.id AS CHAR),NULL,JSON_OBJECT('id', NEW.id, 'identificacion', NEW.identificacion, 'nombres', NEW.nombres, 'apellidos', NEW.apellidos, 'fecha_nacimiento', NEW.fecha_nacimiento, 'lugar_nacimiento', NEW.lugar_nacimiento, 'fecha_expedicion', NEW.fecha_expedicion, 'lugar_expedicion', NEW.lugar_expedicion, 'rh', NEW.rh, 'grupo_sanguineo', NEW.grupo_sanguineo, 'estatura', NEW.estatura, 'requerido', NEW.requerido, 'activo', NEW.activo),@audit_ip,@audit_request);

DROP TRIGGER IF EXISTS audit_ciudadanos_update;
CREATE TRIGGER audit_ciudadanos_update AFTER UPDATE ON ciudadanos FOR EACH ROW
 INSERT INTO auditoria(actor,accion,tabla,registro_id,antes,despues,ip,solicitud_id)
 VALUES(COALESCE(@audit_actor,CONCAT('BD:',USER())),'UPDATE','ciudadanos',CAST(NEW.id AS CHAR),JSON_OBJECT('id', OLD.id, 'identificacion', OLD.identificacion, 'nombres', OLD.nombres, 'apellidos', OLD.apellidos, 'fecha_nacimiento', OLD.fecha_nacimiento, 'lugar_nacimiento', OLD.lugar_nacimiento, 'fecha_expedicion', OLD.fecha_expedicion, 'lugar_expedicion', OLD.lugar_expedicion, 'rh', OLD.rh, 'grupo_sanguineo', OLD.grupo_sanguineo, 'estatura', OLD.estatura, 'requerido', OLD.requerido, 'activo', OLD.activo),JSON_OBJECT('id', NEW.id, 'identificacion', NEW.identificacion, 'nombres', NEW.nombres, 'apellidos', NEW.apellidos, 'fecha_nacimiento', NEW.fecha_nacimiento, 'lugar_nacimiento', NEW.lugar_nacimiento, 'fecha_expedicion', NEW.fecha_expedicion, 'lugar_expedicion', NEW.lugar_expedicion, 'rh', NEW.rh, 'grupo_sanguineo', NEW.grupo_sanguineo, 'estatura', NEW.estatura, 'requerido', NEW.requerido, 'activo', NEW.activo),@audit_ip,@audit_request);

DROP TRIGGER IF EXISTS audit_ciudadanos_delete;
CREATE TRIGGER audit_ciudadanos_delete AFTER DELETE ON ciudadanos FOR EACH ROW
 INSERT INTO auditoria(actor,accion,tabla,registro_id,antes,despues,ip,solicitud_id)
 VALUES(COALESCE(@audit_actor,CONCAT('BD:',USER())),'DELETE','ciudadanos',CAST(OLD.id AS CHAR),JSON_OBJECT('id', OLD.id, 'identificacion', OLD.identificacion, 'nombres', OLD.nombres, 'apellidos', OLD.apellidos, 'fecha_nacimiento', OLD.fecha_nacimiento, 'lugar_nacimiento', OLD.lugar_nacimiento, 'fecha_expedicion', OLD.fecha_expedicion, 'lugar_expedicion', OLD.lugar_expedicion, 'rh', OLD.rh, 'grupo_sanguineo', OLD.grupo_sanguineo, 'estatura', OLD.estatura, 'requerido', OLD.requerido, 'activo', OLD.activo),NULL,@audit_ip,@audit_request);

DROP TRIGGER IF EXISTS audit_perfiles_insert;
CREATE TRIGGER audit_perfiles_insert AFTER INSERT ON perfiles FOR EACH ROW
 INSERT INTO auditoria(actor,accion,tabla,registro_id,antes,despues,ip,solicitud_id)
 VALUES(COALESCE(@audit_actor,CONCAT('BD:',USER())),'INSERT','perfiles',CAST(NEW.id AS CHAR),NULL,JSON_OBJECT('id', NEW.id, 'codigo', NEW.codigo, 'nombre', NEW.nombre),@audit_ip,@audit_request);

DROP TRIGGER IF EXISTS audit_perfiles_update;
CREATE TRIGGER audit_perfiles_update AFTER UPDATE ON perfiles FOR EACH ROW
 INSERT INTO auditoria(actor,accion,tabla,registro_id,antes,despues,ip,solicitud_id)
 VALUES(COALESCE(@audit_actor,CONCAT('BD:',USER())),'UPDATE','perfiles',CAST(NEW.id AS CHAR),JSON_OBJECT('id', OLD.id, 'codigo', OLD.codigo, 'nombre', OLD.nombre),JSON_OBJECT('id', NEW.id, 'codigo', NEW.codigo, 'nombre', NEW.nombre),@audit_ip,@audit_request);

DROP TRIGGER IF EXISTS audit_perfiles_delete;
CREATE TRIGGER audit_perfiles_delete AFTER DELETE ON perfiles FOR EACH ROW
 INSERT INTO auditoria(actor,accion,tabla,registro_id,antes,despues,ip,solicitud_id)
 VALUES(COALESCE(@audit_actor,CONCAT('BD:',USER())),'DELETE','perfiles',CAST(OLD.id AS CHAR),JSON_OBJECT('id', OLD.id, 'codigo', OLD.codigo, 'nombre', OLD.nombre),NULL,@audit_ip,@audit_request);

DROP TRIGGER IF EXISTS audit_opciones_insert;
CREATE TRIGGER audit_opciones_insert AFTER INSERT ON opciones FOR EACH ROW
 INSERT INTO auditoria(actor,accion,tabla,registro_id,antes,despues,ip,solicitud_id)
 VALUES(COALESCE(@audit_actor,CONCAT('BD:',USER())),'INSERT','opciones',CAST(NEW.id AS CHAR),NULL,JSON_OBJECT('id', NEW.id, 'codigo', NEW.codigo, 'nombre', NEW.nombre),@audit_ip,@audit_request);

DROP TRIGGER IF EXISTS audit_opciones_update;
CREATE TRIGGER audit_opciones_update AFTER UPDATE ON opciones FOR EACH ROW
 INSERT INTO auditoria(actor,accion,tabla,registro_id,antes,despues,ip,solicitud_id)
 VALUES(COALESCE(@audit_actor,CONCAT('BD:',USER())),'UPDATE','opciones',CAST(NEW.id AS CHAR),JSON_OBJECT('id', OLD.id, 'codigo', OLD.codigo, 'nombre', OLD.nombre),JSON_OBJECT('id', NEW.id, 'codigo', NEW.codigo, 'nombre', NEW.nombre),@audit_ip,@audit_request);

DROP TRIGGER IF EXISTS audit_opciones_delete;
CREATE TRIGGER audit_opciones_delete AFTER DELETE ON opciones FOR EACH ROW
 INSERT INTO auditoria(actor,accion,tabla,registro_id,antes,despues,ip,solicitud_id)
 VALUES(COALESCE(@audit_actor,CONCAT('BD:',USER())),'DELETE','opciones',CAST(OLD.id AS CHAR),JSON_OBJECT('id', OLD.id, 'codigo', OLD.codigo, 'nombre', OLD.nombre),NULL,@audit_ip,@audit_request);

DROP TRIGGER IF EXISTS audit_permisos_insert;
CREATE TRIGGER audit_permisos_insert AFTER INSERT ON permisos FOR EACH ROW
 INSERT INTO auditoria(actor,accion,tabla,registro_id,antes,despues,ip,solicitud_id)
 VALUES(COALESCE(@audit_actor,CONCAT('BD:',USER())),'INSERT','permisos',CAST(NEW.id AS CHAR),NULL,JSON_OBJECT('id', NEW.id, 'codigo', NEW.codigo, 'opcion_id', NEW.opcion_id, 'nombre', NEW.nombre),@audit_ip,@audit_request);

DROP TRIGGER IF EXISTS audit_permisos_update;
CREATE TRIGGER audit_permisos_update AFTER UPDATE ON permisos FOR EACH ROW
 INSERT INTO auditoria(actor,accion,tabla,registro_id,antes,despues,ip,solicitud_id)
 VALUES(COALESCE(@audit_actor,CONCAT('BD:',USER())),'UPDATE','permisos',CAST(NEW.id AS CHAR),JSON_OBJECT('id', OLD.id, 'codigo', OLD.codigo, 'opcion_id', OLD.opcion_id, 'nombre', OLD.nombre),JSON_OBJECT('id', NEW.id, 'codigo', NEW.codigo, 'opcion_id', NEW.opcion_id, 'nombre', NEW.nombre),@audit_ip,@audit_request);

DROP TRIGGER IF EXISTS audit_permisos_delete;
CREATE TRIGGER audit_permisos_delete AFTER DELETE ON permisos FOR EACH ROW
 INSERT INTO auditoria(actor,accion,tabla,registro_id,antes,despues,ip,solicitud_id)
 VALUES(COALESCE(@audit_actor,CONCAT('BD:',USER())),'DELETE','permisos',CAST(OLD.id AS CHAR),JSON_OBJECT('id', OLD.id, 'codigo', OLD.codigo, 'opcion_id', OLD.opcion_id, 'nombre', OLD.nombre),NULL,@audit_ip,@audit_request);

DROP TRIGGER IF EXISTS audit_usuario_perfiles_insert;
CREATE TRIGGER audit_usuario_perfiles_insert AFTER INSERT ON usuario_perfiles FOR EACH ROW
 INSERT INTO auditoria(actor,accion,tabla,registro_id,antes,despues,ip,solicitud_id)
 VALUES(COALESCE(@audit_actor,CONCAT('BD:',USER())),'INSERT','usuario_perfiles',CONCAT(NEW.usuario_id, ':', NEW.perfil_id),NULL,JSON_OBJECT('usuario_id', NEW.usuario_id, 'perfil_id', NEW.perfil_id),@audit_ip,@audit_request);

DROP TRIGGER IF EXISTS audit_usuario_perfiles_update;
CREATE TRIGGER audit_usuario_perfiles_update AFTER UPDATE ON usuario_perfiles FOR EACH ROW
 INSERT INTO auditoria(actor,accion,tabla,registro_id,antes,despues,ip,solicitud_id)
 VALUES(COALESCE(@audit_actor,CONCAT('BD:',USER())),'UPDATE','usuario_perfiles',CONCAT(NEW.usuario_id, ':', NEW.perfil_id),JSON_OBJECT('usuario_id', OLD.usuario_id, 'perfil_id', OLD.perfil_id),JSON_OBJECT('usuario_id', NEW.usuario_id, 'perfil_id', NEW.perfil_id),@audit_ip,@audit_request);

DROP TRIGGER IF EXISTS audit_usuario_perfiles_delete;
CREATE TRIGGER audit_usuario_perfiles_delete AFTER DELETE ON usuario_perfiles FOR EACH ROW
 INSERT INTO auditoria(actor,accion,tabla,registro_id,antes,despues,ip,solicitud_id)
 VALUES(COALESCE(@audit_actor,CONCAT('BD:',USER())),'DELETE','usuario_perfiles',CONCAT(OLD.usuario_id, ':', OLD.perfil_id),JSON_OBJECT('usuario_id', OLD.usuario_id, 'perfil_id', OLD.perfil_id),NULL,@audit_ip,@audit_request);

DROP TRIGGER IF EXISTS audit_perfil_permisos_insert;
CREATE TRIGGER audit_perfil_permisos_insert AFTER INSERT ON perfil_permisos FOR EACH ROW
 INSERT INTO auditoria(actor,accion,tabla,registro_id,antes,despues,ip,solicitud_id)
 VALUES(COALESCE(@audit_actor,CONCAT('BD:',USER())),'INSERT','perfil_permisos',CONCAT(NEW.perfil_id, ':', NEW.permiso_id),NULL,JSON_OBJECT('perfil_id', NEW.perfil_id, 'permiso_id', NEW.permiso_id),@audit_ip,@audit_request);

DROP TRIGGER IF EXISTS audit_perfil_permisos_update;
CREATE TRIGGER audit_perfil_permisos_update AFTER UPDATE ON perfil_permisos FOR EACH ROW
 INSERT INTO auditoria(actor,accion,tabla,registro_id,antes,despues,ip,solicitud_id)
 VALUES(COALESCE(@audit_actor,CONCAT('BD:',USER())),'UPDATE','perfil_permisos',CONCAT(NEW.perfil_id, ':', NEW.permiso_id),JSON_OBJECT('perfil_id', OLD.perfil_id, 'permiso_id', OLD.permiso_id),JSON_OBJECT('perfil_id', NEW.perfil_id, 'permiso_id', NEW.permiso_id),@audit_ip,@audit_request);

DROP TRIGGER IF EXISTS audit_perfil_permisos_delete;
CREATE TRIGGER audit_perfil_permisos_delete AFTER DELETE ON perfil_permisos FOR EACH ROW
 INSERT INTO auditoria(actor,accion,tabla,registro_id,antes,despues,ip,solicitud_id)
 VALUES(COALESCE(@audit_actor,CONCAT('BD:',USER())),'DELETE','perfil_permisos',CONCAT(OLD.perfil_id, ':', OLD.permiso_id),JSON_OBJECT('perfil_id', OLD.perfil_id, 'permiso_id', OLD.permiso_id),NULL,@audit_ip,@audit_request);
