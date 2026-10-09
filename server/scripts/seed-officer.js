import bcrypt from "bcryptjs";
import { User, Profile, db } from "../src/models.js";

const force = await Profile.findOne({ where: { codigo: "FUERZA_PUBLICA" } });
const [user] = await User.findOrCreate({
  where: { identificacion: "900100001" },
  defaults: {
    nombres: "Laura",
    apellidos: "Rojas Demo",
    correo: "laura@demo.example",
    fuerza: "Policía",
    rango: "Patrullero",
    id_fuerza: "POL-DEMO-01",
    password_hash: await bcrypt.hash("Oficial2026", 12),
    activo: true,
  },
});
await user.setPerfiles([force]);
console.log("Oficial listo para la app movil:", user.identificacion);
await db.close();
process.exit(0);
