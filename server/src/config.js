import "dotenv/config";
export const config = {
  port: Number(process.env.PORT || 3000),
  db: {
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT || 3306),
    name: process.env.DB_NAME || "consulta_ciudadano",
    user: process.env.DB_USER || "cc_app",
    password: process.env.DB_PASSWORD || "",
  },
  defenseUrl: process.env.DEFENSE_URL || "http://127.0.0.1:4001/validar",
  defenseKey: process.env.DEFENSE_API_KEY || "",
  secureCookie: process.env.COOKIE_SECURE === "true",
  tokenHours: Number(process.env.TOKEN_HOURS || 8),
};
if (process.env.NODE_ENV === "production" && !config.secureCookie) {
  throw new Error(
    "En producción configura COOKIE_SECURE=true y publica mediante HTTPS.",
  );
}
