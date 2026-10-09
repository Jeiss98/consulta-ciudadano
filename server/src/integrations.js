import { randomInt } from "node:crypto";
import nodemailer from "nodemailer";
import { config } from "./config.js";
import { HttpError } from "./errors.js";
export function generatePassword() {
  const groups = [
    "ABCDEFGHJKLMNPQRSTUVWXYZ",
    "abcdefghijkmnopqrstuvwxyz",
    "23456789",
  ];
  const all = groups.join("");
  const chars = groups.map((g) => g[randomInt(g.length)]);
  while (chars.length < 6) chars.push(all[randomInt(all.length)]);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}
export async function validateDefense(data) {
  let response;
  try {
    response = await fetch(config.defenseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": config.defenseKey,
      },
      body: JSON.stringify(data),
      signal: AbortSignal.timeout(2500),
    });
    if (!response.ok) throw new Error("defense");
    const result = await response.json();
    if (typeof result.valido !== "boolean") throw new Error("contract");
    return result.valido;
  } catch {
    throw new HttpError(
      503,
      "No fue posible validar con Defensa. Intenta nuevamente.",
    );
  }
}
export async function sendCredentials(data, password) {
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "127.0.0.1",
    port: Number(process.env.SMTP_PORT || 1025),
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
      : undefined,
    connectionTimeout: 3000,
    greetingTimeout: 3000,
    socketTimeout: 5000,
  });
  try {
    await transport.sendMail({
      from: process.env.MAIL_FROM || "registro@consulta.example",
      to: data.correo,
      subject: "Registro confirmado · Consulta Ciudadano",
      text: `Hola ${data.nombres},

Tu registro fue validado.
Identificación: ${data.identificacion}
Contraseña: ${password}

Ingresa desde Consulta Ciudadano.
Demostración académica con datos ficticios.`,
    });
  } catch {
    throw new HttpError(
      503,
      "No se pudo enviar el correo. El registro no se completó; puedes intentarlo otra vez.",
    );
  } finally {
    transport.close();
  }
}
