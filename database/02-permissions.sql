-- Cuenta exclusiva de la aplicación. Cambiar la clave junto con server/.env.
CREATE USER IF NOT EXISTS 'cc_app'@'%' IDENTIFIED BY 'CcLocal2026_demo';
GRANT SELECT, INSERT, UPDATE, DELETE ON consulta_ciudadano.usuarios TO 'cc_app'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE ON consulta_ciudadano.ciudadanos TO 'cc_app'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE ON consulta_ciudadano.perfiles TO 'cc_app'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE ON consulta_ciudadano.opciones TO 'cc_app'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE ON consulta_ciudadano.permisos TO 'cc_app'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE ON consulta_ciudadano.usuario_perfiles TO 'cc_app'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE ON consulta_ciudadano.perfil_permisos TO 'cc_app'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE ON consulta_ciudadano.sesiones TO 'cc_app'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE ON consulta_ciudadano.intentos_acceso TO 'cc_app'@'%';
GRANT SELECT, INSERT ON consulta_ciudadano.auditoria TO 'cc_app'@'%';
