import {
  randomInt,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { Attempt, Session, User } from "./models.js";
import { authenticate } from "./auth.js";
import { identification, password } from "./validation.js";
import { audited, event } from "./audit.js";
import { sendMail } from "./integrations.js";
import { HttpError } from "./errors.js";

export const passwordRecovery = Router();
const secret = randomBytes(32);
const challenges = new Map();
const lifetime = 10 * 60 * 1000;
const cooldown = 60 * 1000;
const requestInput = z.object({
  identificacion: identification,
  correo: z.email().max(150),
});
const confirmation = z.object({
  codigo: z.string().regex(/^\d{6}$/, "Escribe los seis dígitos del código."),
  password,
});

function digest(code) {
  return createHmac("sha256", secret).update(code).digest();
}

async function sendCode(user, purpose, sessionHash = null) {
  const now = Date.now();
  for (const [key, challenge] of challenges) {
    if (challenge.expires <= now) challenges.delete(key);
  }
  const key = purpose + ":" + user.id;
  const previous = challenges.get(key);
  if (previous && now - previous.created < cooldown) return false;
  if (challenges.size >= 5000 && !previous)
    throw new HttpError(
      503,
      "El servicio está ocupado. Intenta en unos minutos.",
    );

  const code = String(randomInt(1_000_000)).padStart(6, "0");
  const challenge = {
    digest: digest(code),
    created: now,
    expires: now + lifetime,
    remaining: 5,
    passwordHash: user.password_hash,
    email: user.correo,
    sessionHash,
  };
  challenges.set(key, challenge);
  try {
    await sendMail(
      user.correo,
      purpose === "cambio"
        ? "Cambio de contraseña · Consulta Ciudadano"
        : "Recuperación de contraseña · Consulta Ciudadano",
      "Escribe este código de seis dígitos en la app. Vence en 10 minutos.\n\n" +
        code,
      "No se pudo enviar el código. Intenta nuevamente.",
    );
  } catch (error) {
    if (challenges.get(key) === challenge) challenges.delete(key);
    throw error;
  }
  return true;
}

passwordRecovery.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    message: { message: "Demasiados intentos. Espera unos minutos." },
  }),
);

passwordRecovery.post("/solicitar", async (req, res) => {
  const { identificacion, correo } = requestInput.parse(req.body);
  const user = await User.findOne({ where: { identificacion, activo: true } });
  if (user && user.correo.toLowerCase() === correo.toLowerCase()) {
    try {
      await sendCode(user, "recuperacion");
    } catch {
      await event(req, "RECUPERACION_CORREO_FALLIDO", "usuarios", user.id);
    }
  }
  res.json({
    message: "Si los datos coinciden, recibirás un código en tu correo.",
  });
});

passwordRecovery.use("/cambio", authenticate);
passwordRecovery.post("/cambio/solicitar", async (req, res) => {
  const { actual } = z
    .object({ actual: z.string().min(1).max(64) })
    .parse(req.body);
  const user = await User.findByPk(req.user.id);
  if (!user?.activo || !(await bcrypt.compare(actual, user.password_hash)))
    throw new HttpError(400, "La contraseña actual es incorrecta.");
  if (!(await sendCode(user, "cambio", req.tokenHash)))
    throw new HttpError(429, "Espera un minuto antes de pedir otro código.");
  res.json({ message: "Enviamos un código a tu correo registrado." });
});

async function confirmPassword(req, identificationValue, data, purpose) {
  let usedChallenge;
  await audited(req, async (transaction) => {
    const attempt = await Attempt.findByPk(identificationValue, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    const user = await User.findOne({
      where: { identificacion: identificationValue, activo: true },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    const challenge = user && challenges.get(purpose + ":" + user.id);
    const expectedSession = purpose === "cambio" ? req.tokenHash : null;
    if (
      !challenge ||
      challenge.expires <= Date.now() ||
      challenge.remaining <= 0 ||
      challenge.passwordHash !== user.password_hash ||
      challenge.email !== user.correo ||
      challenge.sessionHash !== expectedSession
    ) {
      throw new HttpError(
        400,
        "El código es inválido o venció. Solicita uno nuevo.",
      );
    }
    challenge.remaining--;
    if (!timingSafeEqual(challenge.digest, digest(data.codigo))) {
      throw new HttpError(
        400,
        challenge.remaining
          ? "El código es incorrecto."
          : "Agotaste los intentos. Solicita un código nuevo.",
      );
    }
    await user.update(
      { password_hash: await bcrypt.hash(data.password, 12) },
      { transaction },
    );
    await Session.destroy({ where: { usuario_id: user.id }, transaction });
    if (attempt)
      await attempt.update(
        { fallos: 0, bloqueado_hasta: null },
        { transaction },
      );
    await event(
      req,
      purpose === "cambio" ? "CONTRASENA_CAMBIADA" : "CONTRASENA_RECUPERADA",
      "usuarios",
      user.id,
      null,
      transaction,
    );
    usedChallenge = { id: user.id, challenge };
  });
  const challengeKey = purpose + ":" + usedChallenge.id;
  if (challenges.get(challengeKey) === usedChallenge.challenge)
    challenges.delete(challengeKey);
}

passwordRecovery.post("/confirmar", async (req, res) => {
  const data = confirmation
    .extend({ identificacion: identification })
    .parse(req.body);
  await confirmPassword(req, data.identificacion, data, "recuperacion");
  res.json({ message: "Contraseña actualizada. Ya puedes iniciar sesión." });
});

passwordRecovery.post("/cambio/confirmar", async (req, res) => {
  await confirmPassword(
    req,
    req.user.identificacion,
    confirmation.parse(req.body),
    "cambio",
  );
  res.json({ message: "Contraseña actualizada. Ya puedes iniciar sesión." });
});
