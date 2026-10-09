import { app } from "./app.js";
import { db } from "./models.js";
import { config } from "./config.js";
await db.authenticate();
const server = app.listen(config.port, "0.0.0.0", () =>
  console.log(`Consulta Ciudadano disponible en el puerto ${config.port}`),
);
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () =>
    server.close(async () => {
      await db.close();
      process.exit(0);
    }),
  );
