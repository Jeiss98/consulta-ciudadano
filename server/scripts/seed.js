import bcrypt from "bcryptjs";
import {
  db,
  User,
  Profile,
  Option,
  Permission,
  Citizen,
} from "../src/models.js";
import { audited } from "../src/audit.js";
import { password } from "../src/validation.js";
const adminPassword = password.parse(process.env.ADMIN_PASSWORD || "Admin2026");
try {
  await audited(
    { user: { identificacion: "SEMILLA" }, ip: "local" },
    async (transaction) => {
      const options = [
        [
          "CIUDADANOS",
          "Ciudadanos",
          ["ciudadanos.leer", "Consultar ciudadanos"],
          ["ciudadanos.escribir", "Crear y editar ciudadanos"],
        ],
        [
          "USUARIOS",
          "Usuarios",
          ["usuarios.gestionar", "Administrar usuarios"],
        ],
        [
          "SEGURIDAD",
          "Perfiles y permisos",
          ["seguridad.gestionar", "Administrar perfiles y permisos"],
        ],
        ["REPORTES", "Reportes", ["reportes.generar", "Generar reporte PDF"]],
        [
          "CONSULTA",
          "Consulta móvil",
          ["consulta.realizar", "Consultar antecedentes"],
        ],
        [
          "AUDITORIA",
          "Auditoría",
          ["auditoria.leer", "Consultar historial de cambios"],
        ],
      ];
      for (const [codigo, nombre, ...permissions] of options) {
        const [option] = await Option.findOrCreate({
          where: { codigo },
          defaults: { nombre },
          transaction,
        });
        for (const [code, label] of permissions)
          await Permission.findOrCreate({
            where: { codigo: code },
            defaults: { nombre: label, opcion_id: option.id },
            transaction,
          });
      }
      const [admin, createdAdmin] = await Profile.findOrCreate({
        where: { codigo: "ADMINISTRADOR" },
        defaults: { nombre: "Administrador" },
        transaction,
      });
      const [force, createdForce] = await Profile.findOrCreate({
        where: { codigo: "FUERZA_PUBLICA" },
        defaults: { nombre: "Personal de fuerza pública" },
        transaction,
      });
      if (createdAdmin)
        await admin.setPermisos(
          (await Permission.findAll({ transaction })).filter(
            (x) => x.codigo !== "consulta.realizar",
          ),
          { transaction },
        );
      if (createdForce)
        await force.setPermisos(
          await Permission.findAll({
            where: { codigo: "consulta.realizar" },
            transaction,
          }),
          { transaction },
        );
      const [user, created] = await User.findOrCreate({
        where: { identificacion: "100000001" },
        defaults: {
          nombres: "Administrador",
          apellidos: "Demo",
          correo: "admin@demo.example",
          password_hash: await bcrypt.hash(adminPassword, 12),
          activo: true,
        },
        transaction,
      });
      if (created) await user.setPerfiles([admin], { transaction });
      const rows = [
        ["100200001", "Camila", "Vega Demo", false, "O", "+"],
        ["100200002", "Mateo", "Ríos Demo", true, "A", "+"],
        ["100200003", "Valentina", "Sol Demo", false, "B", "-"],
        ["100200004", "Nicolás", "Pardo Demo", true, "AB", "+"],
        ["100200005", "Mariana", "Lago Demo", false, "O", "-"],
        ["100200006", "Samuel", "Cruz Demo", false, "A", "-"],
      ];
      for (const [
        identificacion,
        nombres,
        apellidos,
        requerido,
        grupo_sanguineo,
        rh,
      ] of rows)
        await Citizen.findOrCreate({
          where: { identificacion },
          defaults: {
            nombres,
            apellidos,
            requerido,
            grupo_sanguineo,
            rh,
            fecha_nacimiento: "1998-05-12",
            fecha_expedicion: "2016-06-15",
            lugar_nacimiento: "Bogotá",
            lugar_expedicion: "Bogotá",
            estatura: 1.7,
            activo: true,
          },
          transaction,
        });
    },
  );
  console.log(
    "Datos ficticios cargados. Administrador: 100000001; contraseña: ADMIN_PASSWORD de .env.",
  );
} finally {
  await db.close();
}
