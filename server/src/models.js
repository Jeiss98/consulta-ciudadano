import { Sequelize, DataTypes as D } from "sequelize";
import { config } from "./config.js";
export const db = new Sequelize(
  config.db.name,
  config.db.user,
  config.db.password,
  {
    dialect: "mysql",
    host: config.db.host,
    port: config.db.port,
    logging: false,
    timezone: "+00:00",
    pool: { max: 10, min: 0 },
    define: { timestamps: false, freezeTableName: true },
  },
);
const id = { type: D.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true };
export const User = db.define("usuarios", {
  id,
  identificacion: { type: D.STRING(15), unique: true },
  nombres: D.STRING(80),
  apellidos: D.STRING(80),
  correo: D.STRING(150),
  password_hash: D.STRING(100),
  activo: D.BOOLEAN,
  fuerza: D.STRING(30),
  rango: D.STRING(60),
  id_fuerza: D.STRING(30),
});
export const Profile = db.define("perfiles", {
  id,
  codigo: { type: D.STRING(40), unique: true },
  nombre: D.STRING(80),
});
export const Option = db.define("opciones", {
  id,
  codigo: { type: D.STRING(40), unique: true },
  nombre: D.STRING(80),
});
export const Permission = db.define("permisos", {
  id,
  codigo: { type: D.STRING(60), unique: true },
  opcion_id: D.INTEGER.UNSIGNED,
  nombre: D.STRING(100),
});
export const UserProfile = db.define("usuario_perfiles", {
  usuario_id: { type: D.INTEGER.UNSIGNED, primaryKey: true },
  perfil_id: { type: D.INTEGER.UNSIGNED, primaryKey: true },
});
export const ProfilePermission = db.define("perfil_permisos", {
  perfil_id: { type: D.INTEGER.UNSIGNED, primaryKey: true },
  permiso_id: { type: D.INTEGER.UNSIGNED, primaryKey: true },
});
User.belongsToMany(Profile, {
  through: UserProfile,
  foreignKey: "usuario_id",
  otherKey: "perfil_id",
  as: "perfiles",
});
Profile.belongsToMany(Permission, {
  through: ProfilePermission,
  foreignKey: "perfil_id",
  otherKey: "permiso_id",
  as: "permisos",
});
export const Citizen = db.define("ciudadanos", {
  id,
  identificacion: { type: D.STRING(15), unique: true },
  nombres: D.STRING(80),
  apellidos: D.STRING(80),
  fecha_nacimiento: D.DATEONLY,
  lugar_nacimiento: D.STRING(120),
  fecha_expedicion: D.DATEONLY,
  lugar_expedicion: D.STRING(120),
  rh: D.STRING(1),
  grupo_sanguineo: D.STRING(2),
  estatura: D.DECIMAL(3, 2),
  requerido: D.BOOLEAN,
  activo: D.BOOLEAN,
});
export const Session = db.define("sesiones", {
  hash: { type: D.STRING(64), primaryKey: true },
  usuario_id: D.INTEGER.UNSIGNED,
  expira: D.DATE,
});
export const Attempt = db.define("intentos_acceso", {
  identificacion: { type: D.STRING(15), primaryKey: true },
  fallos: D.INTEGER,
  bloqueado_hasta: D.DATE,
});
export const Audit = db.define("auditoria", {
  id: { type: D.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
  actor: D.STRING(100),
  accion: D.STRING(40),
  tabla: D.STRING(60),
  registro_id: D.STRING(80),
  antes: D.JSON,
  despues: D.JSON,
  ip: D.STRING(64),
  solicitud_id: D.STRING(36),
  fecha: D.DATE,
});
export const userIncludes = [
  {
    model: Profile,
    as: "perfiles",
    through: { attributes: [] },
    include: [
      { model: Permission, as: "permisos", through: { attributes: [] } },
    ],
  },
];
export function publicUser(user) {
  const u = user.toJSON();
  delete u.password_hash;
  return {
    ...u,
    permisos: [
      ...new Set(
        (u.perfiles || []).flatMap((p) => p.permisos.map((x) => x.codigo)),
      ),
    ],
  };
}
