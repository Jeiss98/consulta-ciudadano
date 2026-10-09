import "dotenv/config";
import mysql from "mysql2/promise";
import { readFile } from "node:fs/promises";
const connection = await mysql.createConnection({
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.INIT_DB_USER || "root",
  password: process.env.INIT_DB_PASSWORD || "",
  multipleStatements: true,
});
try {
  for (const file of ["01-schema.sql", "02-permissions.sql"])
    await connection.query(
      await readFile(
        new URL(`../../database/${file}`, import.meta.url),
        "utf8",
      ),
    );
  console.log(
    "Base consulta_ciudadano, tablas, triggers y cuenta cc_app creadas.",
  );
} finally {
  await connection.end();
}
