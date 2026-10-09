import "dotenv/config";
import express from "express";
import { readFile } from "node:fs/promises";
const records = JSON.parse(
  await readFile(new URL("../../fixtures/defensa.json", import.meta.url)),
);
const app = express();
app.use(express.json({ limit: "16kb" }));
app.post("/validar", (req, res) => {
  if (
    !process.env.DEFENSE_API_KEY ||
    req.get("X-API-Key") !== process.env.DEFENSE_API_KEY
  )
    return res.status(401).json({ message: "No autorizado" });
  const normalize = (v) =>
    String(v || "")
      .trim()
      .normalize("NFC")
      .toLocaleLowerCase("es");
  res.json({
    valido: records.some((row) =>
      Object.keys(row).every(
        (key) => normalize(row[key]) === normalize(req.body[key]),
      ),
    ),
  });
});
app.listen(Number(process.env.DEFENSE_PORT || 4001), "0.0.0.0", () =>
  console.log("Defensa simulada disponible."),
);
