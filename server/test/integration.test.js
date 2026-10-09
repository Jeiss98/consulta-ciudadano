import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { SMTPServer } from "smtp-server";
import supertest from "supertest";
process.env.DB_NAME = process.env.DB_NAME || "consulta_ciudadano_test";
if (process.env.DB_NAME !== "consulta_ciudadano_test")
  throw new Error("Las pruebas solo se ejecutan en consulta_ciudadano_test.");
process.env.DEFENSE_URL = "http://127.0.0.1:14001/validar";
process.env.DEFENSE_API_KEY = "test-defense-key";
process.env.DEFENSE_PORT = "14001";
process.env.SMTP_HOST = "127.0.0.1";
process.env.SMTP_PORT = "11025";
process.env.COOKIE_SECURE = "false";
const { app } = await import("../src/app.js");
const { db, User, Session, Attempt, Audit, Citizen } = await import(
  "../src/models.js"
);
const { generatePassword } = await import("../src/integrations.js");
const client = supertest(app),
  agent = supertest.agent(app);
let defense,
  smtp,
  mail = [],
  admin,
  officer,
  security,
  refuseMail = false;
const write = (request) => request.set("X-Requested-With", "ConsultaCiudadano");
const adminLogin = () =>
  write(agent.post("/api/auth/login")).send({
    identificacion: "100000001",
    password: "Admin2026",
    canal: "web",
  });
const baseCitizen = {
  identificacion: "880000001",
  nombres: "Prueba",
  apellidos: "Ciudadano",
  fecha_nacimiento: "2000-01-01",
  lugar_nacimiento: "Bogotá",
  fecha_expedicion: "2018-01-02",
  lugar_expedicion: "Bogotá",
  rh: "+",
  grupo_sanguineo: "O",
  estatura: 1.72,
  requerido: false,
  activo: true,
};
before(async () => {
  await db.authenticate();
  await db.query("SET FOREIGN_KEY_CHECKS=0");
  for (const table of [
    "sesiones",
    "intentos_acceso",
    "usuario_perfiles",
    "perfil_permisos",
    "permisos",
    "opciones",
    "perfiles",
    "usuarios",
    "ciudadanos",
    "auditoria",
  ])
    await db.query(`DELETE FROM ${table}`);
  await db.query("SET FOREIGN_KEY_CHECKS=1");
  execFileSync(process.execPath, ["scripts/seed.js"], {
    env: { ...process.env, ADMIN_PASSWORD: "Admin2026" },
    stdio: "pipe",
  });
  smtp = new SMTPServer({
    authOptional: true,
    disabledCommands: ["AUTH", "STARTTLS"],
    onData(stream, session, callback) {
      let data = "";
      stream.on("data", (c) => (data += c));
      stream.on("end", () => {
        if (refuseMail) return callback(new Error("fallo simulado"));
        mail.push(data);
        callback();
      });
    },
  });
  await new Promise((resolve) => smtp.listen(11025, "127.0.0.1", resolve));
  defense = spawn(process.execPath, ["src/defense-mock.js"], {
    env: process.env,
    stdio: "pipe",
  });
  await new Promise((resolve, reject) => {
    defense.stdout.once("data", resolve);
    defense.once("error", reject);
    defense.once("exit", (code) => reject(new Error(`Mock finalizó ${code}`)));
  });
  const login = await adminLogin();
  assert.equal(login.status, 200);
  admin = login.body.user;
  security = (await agent.get("/api/seguridad")).body;
});
after(async () => {
  defense?.kill();
  await new Promise((r) => (smtp ? smtp.close(r) : r()));
  await db.close();
});
test("contraseñas generadas: exactamente 6 y tres clases", () => {
  for (let i = 0; i < 200; i++) {
    const p = generatePassword();
    assert.match(p, /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d).{6}$/);
  }
});
test("login web usa cookie HttpOnly y no devuelve token ni hash", async () => {
  const r = await adminLogin();
  assert.equal(r.status, 200);
  assert.equal(r.body.token, undefined);
  assert.equal(r.body.user.password_hash, undefined);
  assert.match(r.headers["set-cookie"][0], /HttpOnly/);
  assert.match(r.headers["set-cookie"][0], /SameSite=Strict/);
});
test("sin sesión se rechaza y se bloquean peticiones de escritura sin cabecera", async () => {
  assert.equal((await client.get("/api/ciudadanos")).status, 401);
  assert.equal((await client.post("/api/auth/login").send({})).status, 403);
});
test("registro valida Defensa y no crea datos que no coinciden", async () => {
  const fixture = JSON.parse(
    await readFile(new URL("../../fixtures/defensa.json", import.meta.url)),
  )[0];
  const r = await write(client.post("/api/auth/registro")).send({
    ...fixture,
    nombres: "Otra",
  });
  assert.equal(r.status, 422);
  assert.equal(
    await User.count({ where: { identificacion: fixture.identificacion } }),
    0,
  );
});
test("registro SMTP real, bcrypt, credenciales y duplicados", async () => {
  const fixture = JSON.parse(
    await readFile(new URL("../../fixtures/defensa.json", import.meta.url)),
  )[0];
  const r = await write(client.post("/api/auth/registro")).send(fixture);
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.equal(mail.length, 1);
  const password = mail[0].match(
    /Contrase(?:ñ|=C3=B1)a: ([A-Za-z0-9]{6})/,
  )?.[1];
  assert.ok(password, "El correo contiene la contraseña generada");
  const saved = await User.findOne({
    where: { identificacion: fixture.identificacion },
  });
  assert.match(saved.password_hash, /^\$2[aby]\$/);
  assert.notEqual(saved.password_hash, password);
  officer = (
    await write(client.post("/api/auth/login")).send({
      identificacion: fixture.identificacion,
      password,
      canal: "movil",
    })
  ).body;
  assert.ok(officer.token);
  assert.ok(new Date(officer.expiresAt) > new Date());
  assert.equal(
    (await write(client.post("/api/auth/registro")).send(fixture)).status,
    409,
  );
});
test("fallo SMTP revierte registro y deja auditoría del fallo", async () => {
  const fixture = JSON.parse(
    await readFile(new URL("../../fixtures/defensa.json", import.meta.url)),
  )[1];
  refuseMail = true;
  try {
    assert.equal(
      (await write(client.post("/api/auth/registro")).send(fixture)).status,
      503,
    );
    assert.equal(
      await User.count({ where: { identificacion: fixture.identificacion } }),
      0,
    );
    assert.ok(await Audit.findOne({ where: { accion: "CORREO_FALLIDO" } }));
  } finally {
    refuseMail = false;
  }
});
test("fuerza pública no puede administrar ni generar reportes", async () => {
  for (const path of [
    "/api/ciudadanos",
    "/api/usuarios",
    "/api/seguridad",
    "/api/auditoria",
    "/api/reportes/ciudadanos.pdf",
  ])
    assert.equal(
      (await client.get(path).auth(officer.token, { type: "bearer" })).status,
      403,
      path,
    );
});
test("consulta ambos estados y no encontrado; audita cada consulta", async () => {
  for (const [id, expected] of [
    ["100200001", "No requerido"],
    ["100200002", "Requerido"],
  ]) {
    const r = await client
      .get("/api/consulta/" + id)
      .auth(officer.token, { type: "bearer" });
    assert.equal(r.status, 200);
    assert.equal(r.body.estado, expected);
  }
  const r = await client
    .get("/api/consulta/999999999")
    .auth(officer.token, { type: "bearer" });
  assert.equal(r.status, 404);
  assert.equal(r.body.message, "Ciudadano no encontrado");
  assert.equal(
    await Audit.count({ where: { accion: "CONSULTA", actor: "900100001" } }),
    3,
  );
});
let citizen;
test("CRUD ciudadano, validación, duplicado y búsqueda", async () => {
  let r = await write(agent.post("/api/ciudadanos")).send(baseCitizen);
  assert.equal(r.status, 201, JSON.stringify(r.body));
  citizen = r.body;
  assert.equal(
    (await write(agent.post("/api/ciudadanos")).send(baseCitizen)).status,
    409,
  );
  assert.equal(
    (
      await write(agent.post("/api/ciudadanos")).send({
        ...baseCitizen,
        identificacion: "880000002",
        grupo_sanguineo: "Z",
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await write(agent.post("/api/ciudadanos")).send({
        ...baseCitizen,
        identificacion: "880000002",
        fecha_expedicion: "1990-01-01",
      })
    ).status,
    400,
  );
  assert.equal((await agent.get("/api/ciudadanos?q=Prueba")).body.total, 1);
  assert.equal((await agent.get("/api/ciudadanos?q=880000001")).body.total, 1);
});
test("edición audita antes, después y actor; inactivos no se consultan", async () => {
  let r = await write(agent.put("/api/ciudadanos/" + citizen.id)).send({
    ...baseCitizen,
    requerido: true,
    activo: false,
  });
  assert.equal(r.status, 200);
  const log = await Audit.findOne({
    where: {
      tabla: "ciudadanos",
      registro_id: String(citizen.id),
      accion: "UPDATE",
    },
    order: [["id", "DESC"]],
  });
  assert.equal(log.actor, "100000001");
  assert.equal(Number(log.antes.requerido), 0);
  assert.equal(Number(log.despues.requerido), 1);
  assert.ok(log.solicitud_id);
  assert.equal(
    (
      await client
        .get("/api/consulta/" + citizen.identificacion)
        .auth(officer.token, { type: "bearer" })
    ).status,
    404,
  );
  assert.equal((await agent.get("/api/ciudadanos?q=Prueba")).body.total, 0);
  assert.equal(
    (await agent.get("/api/ciudadanos?q=Prueba&incluir_inactivos=true")).body
      .total,
    1,
  );
});
test("SQL directo queda auditado y no hereda actor del pool", async () => {
  await db.query("UPDATE ciudadanos SET estatura=1.80 WHERE id=?", {
    replacements: [citizen.id],
  });
  const log = await Audit.findOne({
    where: {
      tabla: "ciudadanos",
      registro_id: String(citizen.id),
      accion: "UPDATE",
    },
    order: [["id", "DESC"]],
  });
  assert.match(log.actor, /^BD:/);
  assert.equal(log.ip, null);
  assert.equal(Number(log.despues.estatura), 1.8);
});
test("PDF válido para tres filtros y error cuando no hay registros", async () => {
  for (const estado of ["todos", "requeridos", "no_requeridos"]) {
    const r = await agent.get("/api/reportes/ciudadanos.pdf?estado=" + estado);
    assert.equal(r.status, 200);
    assert.match(r.headers["content-type"], /application\/pdf/);
    assert.equal(r.body.subarray(0, 4).toString(), "%PDF");
  }
  await db.transaction(async (transaction) => {
    await Citizen.update({ activo: false }, { where: {}, transaction });
  });
  assert.equal((await agent.get("/api/reportes/ciudadanos.pdf")).status, 404);
  await Citizen.update(
    { activo: true },
    { where: { identificacion: "100200001" } },
  );
});
let staff;
test("administración crea usuario con varios perfiles y audita sin hashes", async () => {
  const r = await write(agent.post("/api/usuarios")).send({
    identificacion: "700000001",
    nombres: "Usuario",
    apellidos: "Pruebas",
    correo: "prueba@demo.example",
    password: "Prueba2026",
    activo: true,
    perfiles: security.perfiles.map((p) => p.id),
  });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  staff = r.body;
  assert.equal(staff.perfiles.length, 2);
  const logs = await Audit.findAll({
    where: { tabla: "usuarios", registro_id: String(staff.id) },
  });
  assert.ok(logs.length);
  assert.ok(!JSON.stringify(logs).includes("password_hash"));
  assert.ok(!JSON.stringify(logs).includes("Prueba2026"));
});
test("inactivar usuario invalida su token y no permite login", async () => {
  const r = await write(client.post("/api/auth/login")).send({
    identificacion: "700000001",
    password: "Prueba2026",
  });
  assert.equal(r.status, 200);
  const data = {
    identificacion: staff.identificacion,
    nombres: staff.nombres,
    apellidos: staff.apellidos,
    correo: staff.correo,
    activo: false,
    perfiles: staff.perfiles.map((p) => p.id),
  };
  assert.equal(
    (await write(agent.put("/api/usuarios/" + staff.id)).send(data)).status,
    200,
  );
  assert.equal(
    (await client.get("/api/auth/me").auth(r.body.token, { type: "bearer" }))
      .status,
    401,
  );
  assert.equal(
    (
      await write(client.post("/api/auth/login")).send({
        identificacion: "700000001",
        password: "Prueba2026",
      })
    ).status,
    401,
  );
});
test("no se puede inactivar el último administrador", async () => {
  const r = await write(agent.put("/api/usuarios/" + admin.id)).send({
    identificacion: admin.identificacion,
    nombres: admin.nombres,
    apellidos: admin.apellidos,
    correo: admin.correo,
    activo: false,
    perfiles: admin.perfiles.map((p) => p.id),
  });
  assert.equal(r.status, 409);
});
test("5 fallos bloquean incluso usando la contraseña correcta", async () => {
  const fixture = JSON.parse(
    await readFile(new URL("../../fixtures/defensa.json", import.meta.url)),
  )[0];
  for (let i = 0; i < 5; i++)
    assert.equal(
      (
        await write(client.post("/api/auth/login")).send({
          identificacion: fixture.identificacion,
          password: "Incorrecta1",
        })
      ).status,
      401,
    );
  assert.equal(
    (
      await write(client.post("/api/auth/login")).send({
        identificacion: fixture.identificacion,
        password: "Cualquier1",
      })
    ).status,
    429,
  );
  const attempt = await Attempt.findByPk(fixture.identificacion);
  assert.equal(attempt.fallos, 5);
  assert.ok(attempt.bloqueado_hasta > new Date());
});
test("perfiles y permisos se aplican a tokens ya emitidos", async () => {
  const profile = security.perfiles.find((p) => p.codigo === "FUERZA_PUBLICA");
  assert.equal(
    (
      await write(agent.put("/api/perfiles/" + profile.id)).send({
        codigo: profile.codigo,
        nombre: profile.nombre,
        permisos: [],
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await client
        .get("/api/consulta/100200001")
        .auth(officer.token, { type: "bearer" })
    ).status,
    403,
  );
  const r = await write(agent.post("/api/perfiles")).send({
    codigo: "APOYO",
    nombre: "Apoyo de prueba",
    permisos: [security.permisos[0].id],
  });
  assert.equal(r.status, 201);
});
test("renombrar una opción conserva sus permisos y se refleja en el menú", async () => {
  const option = security.opciones.find((o) => o.codigo === "CIUDADANOS");
  const r = await write(agent.put("/api/opciones/" + option.id)).send({
    nombre: "Registro de ciudadanos",
  });
  assert.equal(r.status, 200);
  const options = (await agent.get("/api/opciones")).body;
  assert.equal(
    options.find((o) => o.codigo === "CIUDADANOS").nombre,
    "Registro de ciudadanos",
  );
  assert.equal((await agent.get("/api/ciudadanos")).status, 200);
});
test("sesión vencida y cierre de sesión", async () => {
  await Session.update(
    { expira: new Date(Date.now() - 1000) },
    { where: { usuario_id: officer.user.id } },
  );
  assert.equal(
    (await client.get("/api/auth/me").auth(officer.token, { type: "bearer" }))
      .status,
    401,
  );
  assert.equal((await write(agent.post("/api/auth/logout"))).status, 200);
  assert.equal((await agent.get("/api/auth/me")).status, 401);
});
