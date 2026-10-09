import { z } from "zod";
export const identification = z
  .string()
  .trim()
  .regex(/^\d{5,15}$/, "Usa entre 5 y 15 dígitos.");
const name = z
  .string()
  .trim()
  .min(2)
  .max(80)
  .regex(/^[\p{L}\p{M} .'-]+$/u, "Escribe un nombre válido.");
export const password = z
  .string()
  .min(6)
  .max(64)
  .regex(/[A-Z]/, "Incluye una mayúscula.")
  .regex(/[a-z]/, "Incluye una minúscula.")
  .regex(/[0-9]/, "Incluye un número.");
export const RANKS = {
  Policía: [
    "Patrullero",
    "Subintendente",
    "Intendente",
    "Subteniente",
    "Teniente",
    "Capitán",
    "Mayor",
    "Coronel",
    "General",
  ],
  Ejército: [
    "Soldado",
    "Cabo",
    "Sargento",
    "Subteniente",
    "Teniente",
    "Capitán",
    "Mayor",
    "Coronel",
    "General",
  ],
  Armada: [
    "Marinero",
    "Cabo",
    "Suboficial",
    "Teniente de corbeta",
    "Teniente de fragata",
    "Capitán de corbeta",
    "Capitán de navío",
    "Almirante",
  ],
  "Fuerza Aérea": [
    "Soldado",
    "Técnico",
    "Subteniente",
    "Teniente",
    "Capitán",
    "Mayor",
    "Coronel",
    "General",
  ],
};
const base = {
  identificacion: identification,
  nombres: name,
  apellidos: name,
  correo: z.email().max(150),
};
export const registration = z
  .object({
    ...base,
    fuerza: z.enum(Object.keys(RANKS)),
    rango: z.string().max(60),
    id_fuerza: z.string().trim().min(2).max(30),
  })
  .refine((d) => RANKS[d.fuerza].includes(d.rango), {
    path: ["rango"],
    message: "El rango no corresponde a la fuerza.",
  });
export const userInput = z.object({
  ...base,
  password: password.optional(),
  activo: z.boolean(),
  perfiles: z.array(z.number().int().positive()).min(1),
});
const date = z.iso
  .date()
  .refine(
    (v) => v <= new Date().toISOString().slice(0, 10),
    "No puede ser una fecha futura.",
  );
export const citizenInput = z
  .object({
    identificacion: identification,
    nombres: name,
    apellidos: name,
    fecha_nacimiento: date,
    lugar_nacimiento: z.string().trim().min(2).max(120),
    fecha_expedicion: date,
    lugar_expedicion: z.string().trim().min(2).max(120),
    rh: z.enum(["+", "-"]),
    grupo_sanguineo: z.enum(["A", "B", "AB", "O"]),
    estatura: z.coerce.number().min(0.5).max(2.5),
    requerido: z.boolean(),
    activo: z.boolean(),
  })
  .refine((d) => d.fecha_expedicion >= d.fecha_nacimiento, {
    path: ["fecha_expedicion"],
    message: "La expedición debe ser posterior al nacimiento.",
  });
export const profileInput = z.object({
  codigo: z.string().regex(/^[A-Z_]{3,40}$/),
  nombre: z.string().trim().min(3).max(80),
  permisos: z.array(z.number().int().positive()),
});
export const loginInput = z.object({
  identificacion: identification,
  password: z.string().min(1).max(64),
  canal: z.enum(["web", "movil"]).default("movil"),
});
export const filterInput = z.enum(["todos", "requeridos", "no_requeridos"]);
