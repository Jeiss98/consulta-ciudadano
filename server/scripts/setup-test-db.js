import "dotenv/config";
import mysql from "mysql2/promise";
import { readFile } from "node:fs/promises";
const c = await mysql.createConnection({
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.TEST_DB_ROOT_USER || "root",
  password: process.env.TEST_DB_ROOT_PASSWORD || "",
  multipleStatements: true,
});
try {
  const sql = (
    await readFile(
      new URL("../../database/01-schema.sql", import.meta.url),
      "utf8",
    )
  ).replaceAll("consulta_ciudadano", "consulta_ciudadano_test");
  await c.query(sql);
  await c.query(
    "CREATE USER IF NOT EXISTS 'cc_test'@'%' IDENTIFIED BY 'CcTest2026'",
  );
  await c.query(
    "GRANT ALL PRIVILEGES ON consulta_ciudadano_test.* TO 'cc_test'@'%'",
  );
  console.log("Base exclusiva de pruebas inicializada.");
} finally {
  await c.end();
}
