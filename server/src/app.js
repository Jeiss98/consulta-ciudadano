import express from "express";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";
import { Op } from "sequelize";
import { z } from "zod";
import {
  db,
  User,
  Profile,
  Permission,
  Option,
  Citizen,
  Session,
  Audit,
  UserProfile,
  userIncludes,
  publicUser,
} from "./models.js";
import {
  registration,
  userInput,
  citizenInput,
  profileInput,
  loginInput,
  filterInput,
  identification,
  RANKS,
} from "./validation.js";
import { authenticate, allow, login, cookieOptions } from "./auth.js";
import { audited, event } from "./audit.js";
import {
  generatePassword,
  validateDefense,
  sendCredentials,
} from "./integrations.js";
import { HttpError, errorHandler } from "./errors.js";
import { citizenPdf } from "./pdf.js";
export const app = express();
app.disable("x-powered-by");
// Un único proxy controlado (Caddy) en el despliegue Docker; localmente, ninguno.
app.set("trust proxy", process.env.TRUST_PROXY === "true" ? 1 : false);
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        imgSrc: ["'self'", "data:"],
        upgradeInsecureRequests: null,
      },
    },
  }),
);
app.use(express.json({ limit: "32kb" }));
app.use((req, res, next) => {
  req.requestId = randomUUID();
  res.set("X-Request-ID", req.requestId);
  next();
});
// Las escrituras web requieren cabecera no simple. No se habilita CORS.
app.use("/api", (req, res, next) => {
  res.set("Cache-Control", "no-store");
  if (
    !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
    req.get("X-Requested-With") !== "ConsultaCiudadano"
  )
    throw new HttpError(403, "Solicitud no autorizada.");
  next();
});
const authLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 80,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { message: "Demasiados intentos. Espera unos minutos." },
});
app.get("/api/salud", async (req, res) => {
  await db.authenticate();
  res.json({ estado: "disponible" });
});
app.get("/api/catalogos", (_req, res) => res.json({ rangos: RANKS }));
app.post("/api/auth/login", authLimit, async (req, res) => {
  const data = loginInput.parse(req.body);
  const result = await login(req, data);
  if (data.canal === "web") {
    res.cookie("cc_session", result.token, cookieOptions);
    delete result.token;
  }
  res.json(result);
});
app.post("/api/auth/registro", authLimit, async (req, res) => {
  const data = registration.parse(req.body);
  if (await User.findOne({ where: { identificacion: data.identificacion } }))
    throw new HttpError(409, "La identificación ya está registrada.");
  if (!(await validateDefense(data)))
    throw new HttpError(
      422,
      "Los datos no coinciden con el registro de Defensa.",
    );
  const password = generatePassword();
  try {
    await audited(req, async (transaction) => {
      const profile = await Profile.findOne({
        where: { codigo: "FUERZA_PUBLICA" },
        transaction,
      });
      if (!profile)
        throw new HttpError(503, "El servicio no está inicializado.");
      const user = await User.create(
        {
          ...data,
          password_hash: await bcrypt.hash(password, 12),
          activo: true,
        },
        { transaction },
      );
      await user.setPerfiles([profile], { transaction });
      await sendCredentials(data, password);
      await event(
        req,
        "CORREO_ENVIADO",
        "usuarios",
        user.id,
        { destinatario: data.correo },
        transaction,
      );
    });
  } catch (error) {
    if (error.status === 503)
      await event(req, "CORREO_FALLIDO", "usuarios", data.identificacion, {
        resultado: "Registro revertido",
      });
    throw error;
  }
  res
    .status(201)
    .json({
      message:
        "Registro completado. Revisa el correo para conocer tu contraseña.",
    });
});
app.use("/api", authenticate);
app.get("/api/auth/me", (req, res) => res.json(req.user));
app.get("/api/opciones", async (req, res) => {
  const permissions = await Permission.findAll({
    where: { codigo: { [Op.in]: req.user.permisos } },
  });
  res.json(
    await Option.findAll({
      where: { id: { [Op.in]: permissions.map((p) => p.opcion_id) } },
    }),
  );
});
app.post("/api/auth/logout", async (req, res) => {
  await Session.destroy({ where: { hash: req.tokenHash } });
  res.clearCookie("cc_session", { ...cookieOptions, maxAge: undefined });
  res.json({ message: "Sesión cerrada." });
});
const admin = (p) => allow(p, "ADMINISTRADOR");
const pageQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  size: z.coerce.number().int().min(1).max(100).default(10),
  q: z.string().max(100).default(""),
});
function pageMeta(count, page, size) {
  return { total: count, page, pages: Math.max(1, Math.ceil(count / size)) };
}
function citizenWhere(query) {
  const filter = filterInput.parse(query.estado || "todos");
  const where = {};
  if (query.incluir_inactivos !== "true") where.activo = true;
  if (filter !== "todos") where.requerido = filter === "requeridos";
  if (query.q)
    where[Op.or] = ["identificacion", "nombres", "apellidos"].map((key) => ({
      [key]: { [Op.like]: `%${query.q.replace(/[\%_]/g, "\\$&")}%` },
    }));
  return where;
}
app.get("/api/ciudadanos", admin("ciudadanos.leer"), async (req, res) => {
  const { page, size, q } = pageQuery.parse(req.query);
  const { rows, count } = await Citizen.findAndCountAll({
    where: citizenWhere({ ...req.query, q }),
    order: [
      ["apellidos", "ASC"],
      ["id", "ASC"],
    ],
    limit: size,
    offset: (page - 1) * size,
  });
  res.json({ items: rows, ...pageMeta(count, page, size) });
});
app.post("/api/ciudadanos", admin("ciudadanos.escribir"), async (req, res) => {
  const data = citizenInput.parse(req.body);
  const row = await audited(req, (t) =>
    Citizen.create(data, { transaction: t }),
  );
  res.status(201).json(row);
});
app.put(
  "/api/ciudadanos/:id",
  admin("ciudadanos.escribir"),
  async (req, res) => {
    const data = citizenInput.parse(req.body);
    const row = await audited(req, async (transaction) => {
      const row = await Citizen.findByPk(req.params.id, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!row) throw new HttpError(404, "Ciudadano no encontrado");
      return row.update(data, { transaction });
    });
    res.json(row);
  },
);
app.delete(
  "/api/ciudadanos/:id",
  admin("ciudadanos.escribir"),
  async (req, res) => {
    await audited(req, async (transaction) => {
      const row = await Citizen.findByPk(req.params.id, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!row) throw new HttpError(404, "Ciudadano no encontrado");
      if (!row.activo)
        throw new HttpError(409, "El ciudadano ya está inactivo.");
      await row.update({ activo: false }, { transaction });
    });
    res.status(204).end();
  },
);
app.get(
  "/api/consulta/:identificacion",
  allow("consulta.realizar", "FUERZA_PUBLICA"),
  async (req, res) => {
    const value = identification.parse(req.params.identificacion);
    const row = await Citizen.findOne({
      where: { identificacion: value, activo: true },
      attributes: ["identificacion", "requerido"],
    });
    await event(req, "CONSULTA", "ciudadanos", value, {
      resultado: row
        ? row.requerido
          ? "Requerido"
          : "No requerido"
        : "Ciudadano no encontrado",
    });
    if (!row) throw new HttpError(404, "Ciudadano no encontrado");
    res.json({
      identificacion: row.identificacion,
      estado: row.requerido ? "Requerido" : "No requerido",
      requerido: row.requerido,
    });
  },
);
app.get(
  "/api/reportes/ciudadanos.pdf",
  admin("reportes.generar"),
  async (req, res) => {
    const filter = filterInput.parse(req.query.estado || "todos");
    const rows = await Citizen.findAll({
      where: citizenWhere({ estado: filter }),
      order: [
        ["apellidos", "ASC"],
        ["id", "ASC"],
      ],
      // requerido es necesario para la columna Estado del PDF
      attributes: ["identificacion", "nombres", "apellidos", "requerido"],
    });
    if (!rows.length)
      throw new HttpError(
        404,
        "No hay ciudadanos para el filtro seleccionado.",
      );
    const pdf = await citizenPdf(rows, filter);
    res
      .type("application/pdf")
      .attachment(`ciudadanos-${filter}.pdf`)
      .send(pdf);
  },
);
app.get("/api/usuarios", admin("usuarios.gestionar"), async (req, res) => {
  const { page, size, q } = pageQuery.parse(req.query);
  const where = q
    ? {
        [Op.or]: ["identificacion", "nombres", "apellidos"].map((key) => ({
          [key]: { [Op.like]: `%${q.replace(/[\%_]/g, "\\$&")}%` },
        })),
      }
    : {};
  const { rows, count } = await User.findAndCountAll({
    where,
    include: userIncludes,
    distinct: true,
    limit: size,
    offset: (page - 1) * size,
    order: [["id", "DESC"]],
  });
  res.json({ items: rows.map(publicUser), ...pageMeta(count, page, size) });
});
async function saveUser(req, id) {
  const data = userInput.parse(req.body);
  if (!id && !data.password)
    throw new HttpError(
      400,
      "La contraseña es obligatoria al crear un usuario.",
    );
  return audited(req, async (transaction) => {
    const adminProfile = await Profile.findOne({
      where: { codigo: "ADMINISTRADOR" },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    const profiles = await Profile.findAll({
      where: { id: { [Op.in]: data.perfiles } },
      transaction,
    });
    if (profiles.length !== new Set(data.perfiles).size)
      throw new HttpError(400, "Algún perfil no existe.");
    let row = id
      ? await User.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE })
      : null;
    if (id && !row) throw new HttpError(404, "Usuario no encontrado.");
    if (row) {
      const wasAdmin = await UserProfile.findOne({
        where: { usuario_id: row.id, perfil_id: adminProfile.id },
        transaction,
      });
      if (
        wasAdmin &&
        row.activo &&
        (!data.activo || !data.perfiles.includes(adminProfile.id))
      ) {
        const activeAdmins = await User.count({
          where: { activo: true },
          include: [
            { model: Profile, as: "perfiles", where: { id: adminProfile.id } },
          ],
          transaction,
        });
        if (activeAdmins <= 1)
          throw new HttpError(
            409,
            "Debe permanecer al menos un administrador activo.",
          );
      }
    }
    const { password, perfiles, ...values } = data;
    if (password) values.password_hash = await bcrypt.hash(password, 12);
    row = row
      ? await row.update(values, { transaction })
      : await User.create(values, { transaction });
    await row.setPerfiles(profiles, { transaction });
    if (id)
      await Session.destroy({ where: { usuario_id: row.id }, transaction });
    return publicUser(
      await User.findByPk(row.id, { include: userIncludes, transaction }),
    );
  });
}
app.post("/api/usuarios", admin("usuarios.gestionar"), async (req, res) =>
  res.status(201).json(await saveUser(req)),
);
app.put("/api/usuarios/:id", admin("usuarios.gestionar"), async (req, res) =>
  res.json(await saveUser(req, req.params.id)),
);
app.get("/api/seguridad", async (req, res) => {
  if (
    !req.user.perfiles.some((p) => p.codigo === "ADMINISTRADOR") ||
    !req.user.permisos.some((p) =>
      ["usuarios.gestionar", "seguridad.gestionar"].includes(p),
    )
  )
    throw new HttpError(403, "Sin permiso.");
  const [perfiles, opciones, permisos] = await Promise.all([
    Profile.findAll({
      include: [
        { model: Permission, as: "permisos", through: { attributes: [] } },
      ],
      order: [["id", "ASC"]],
    }),
    Option.findAll(),
    Permission.findAll(),
  ]);
  res.json({ perfiles, opciones, permisos });
});
async function saveProfile(req, id) {
  const data = profileInput.parse(req.body);
  return audited(req, async (transaction) => {
    let profile = id
      ? await Profile.findByPk(id, {
          transaction,
          lock: transaction.LOCK.UPDATE,
        })
      : null;
    if (id && !profile) throw new HttpError(404, "Perfil no encontrado.");
    if (
      profile &&
      ["ADMINISTRADOR", "FUERZA_PUBLICA"].includes(profile.codigo) &&
      data.codigo !== profile.codigo
    )
      throw new HttpError(
        400,
        "El código del perfil base no se puede cambiar.",
      );
    const permissions = await Permission.findAll({
      where: { id: { [Op.in]: data.permisos } },
      transaction,
    });
    if (permissions.length !== new Set(data.permisos).size)
      throw new HttpError(400, "Algún permiso no existe.");
    if (
      profile?.codigo === "ADMINISTRADOR" &&
      !permissions.some((p) => p.codigo === "seguridad.gestionar")
    )
      throw new HttpError(
        409,
        "El administrador debe conservar la gestión de seguridad.",
      );
    profile = profile
      ? await profile.update(
          { codigo: data.codigo, nombre: data.nombre },
          { transaction },
        )
      : await Profile.create(
          { codigo: data.codigo, nombre: data.nombre },
          { transaction },
        );
    await profile.setPermisos(permissions, { transaction });
    return profile;
  });
}
app.post("/api/perfiles", admin("seguridad.gestionar"), async (req, res) =>
  res.status(201).json(await saveProfile(req)),
);
app.put("/api/perfiles/:id", admin("seguridad.gestionar"), async (req, res) =>
  res.json(await saveProfile(req, req.params.id)),
);
app.put("/api/opciones/:id", admin("seguridad.gestionar"), async (req, res) => {
  const data = z
    .object({ nombre: z.string().trim().min(3).max(80) })
    .parse(req.body);
  const result = await audited(req, async (transaction) => {
    const option = await Option.findByPk(req.params.id, { transaction });
    if (!option) throw new HttpError(404, "Opción no encontrada.");
    return option.update(data, { transaction });
  });
  res.json(result);
});
app.get("/api/auditoria", admin("auditoria.leer"), async (req, res) => {
  const { page, size, q } = pageQuery.parse(req.query);
  const where = q
    ? {
        [Op.or]: ["actor", "tabla", "accion", "registro_id"].map((key) => ({
          [key]: { [Op.like]: `%${q.replace(/[\%_]/g, "\\$&")}%` },
        })),
      }
    : {};
  const { rows, count } = await Audit.findAndCountAll({
    where,
    order: [["id", "DESC"]],
    limit: size,
    offset: (page - 1) * size,
  });
  res.json({ items: rows, ...pageMeta(count, page, size) });
});
app.use("/api", (_req, res) =>
  res.status(404).json({ message: "Ruta no encontrada." }),
);
app.use(express.static(fileURLToPath(new URL("../../web", import.meta.url))));
app.use(errorHandler);
