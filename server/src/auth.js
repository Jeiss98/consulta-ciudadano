import { randomBytes, createHash } from "node:crypto";
import bcrypt from "bcryptjs";
import { Op } from "sequelize";
import {
  db,
  User,
  Attempt,
  Session,
  userIncludes,
  publicUser,
} from "./models.js";
import { config } from "./config.js";
import { HttpError } from "./errors.js";
import { event } from "./audit.js";
export const hashToken = (token) =>
  createHash("sha256").update(token).digest("hex");
const dummyHash = bcrypt.hashSync("NoEsUnaClave1", 12);
export function tokenFrom(req) {
  const header = req.get("authorization");
  if (header?.startsWith("Bearer ")) return header.slice(7);
  return (req.headers.cookie || "")
    .split(";")
    .map((x) => x.trim())
    .find((x) => x.startsWith("cc_session="))
    ?.slice(11);
}
export async function authenticate(req, res, next) {
  const token = tokenFrom(req);
  if (!token) throw new HttpError(401, "Inicia sesión para continuar.");
  const session = await Session.findOne({
    where: { hash: hashToken(token), expira: { [Op.gt]: new Date() } },
  });
  const user =
    session &&
    (await User.findByPk(session.usuario_id, { include: userIncludes }));
  if (!user?.activo)
    throw new HttpError(401, "La sesión venció o el usuario está inactivo.");
  req.user = publicUser(user);
  req.tokenHash = session.hash;
  next();
}
export function allow(permission, profile) {
  return (req, res, next) => {
    if (
      !req.user.permisos.includes(permission) ||
      (profile && !req.user.perfiles.some((p) => p.codigo === profile))
    )
      throw new HttpError(
        403,
        "No tienes permiso para realizar esta operación.",
      );
    next();
  };
}
export async function login(req, data) {
  // Un registro por identificación y bloqueo de fila evita perder fallos concurrentes.
  await Attempt.findOrCreate({
    where: { identificacion: data.identificacion },
    defaults: { fallos: 0 },
  });
  const result = await db.transaction(async (transaction) => {
    const attempt = await Attempt.findByPk(data.identificacion, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (attempt.bloqueado_hasta && attempt.bloqueado_hasta > new Date())
      return { blocked: true };
    if (attempt.bloqueado_hasta) {
      attempt.fallos = 0;
      attempt.bloqueado_hasta = null;
    }
    const user = await User.findOne({
      where: { identificacion: data.identificacion },
      include: userIncludes,
      transaction,
    });
    const match = await bcrypt.compare(
      data.password,
      user?.password_hash || dummyHash,
    );
    const profile = data.canal === "web" ? "ADMINISTRADOR" : "FUERZA_PUBLICA";
    if (
      !match ||
      !user?.activo ||
      !user.perfiles.some((p) => p.codigo === profile)
    ) {
      attempt.fallos++;
      if (attempt.fallos >= 5)
        attempt.bloqueado_hasta = new Date(Date.now() + 15 * 60 * 1000);
      await attempt.save({ transaction });
      return { invalid: true };
    }
    attempt.fallos = 0;
    attempt.bloqueado_hasta = null;
    await attempt.save({ transaction });
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + config.tokenHours * 3600 * 1000);
    await Session.create(
      { hash: hashToken(token), usuario_id: user.id, expira: expiresAt },
      { transaction },
    );
    await event(
      { ...req, user: publicUser(user) },
      "LOGIN",
      "usuarios",
      user.id,
      { canal: data.canal },
      transaction,
    );
    return { token, expiresAt, user: publicUser(user) };
  });
  if (result.blocked)
    throw new HttpError(
      429,
      "Acceso bloqueado temporalmente. Intenta de nuevo en 15 minutos.",
    );
  if (result.invalid)
    throw new HttpError(401, "Identificación o contraseña inválidas.");
  return result;
}
export const cookieOptions = {
  httpOnly: true,
  secure: config.secureCookie,
  sameSite: "strict",
  path: "/api",
  maxAge: config.tokenHours * 3600 * 1000,
};
