import bwipjs from "bwip-js";
import { mkdir, writeFile } from "node:fs/promises";
import { yellowCardFixture } from "../../fixtures/cedulas/amarilla-sintetica.mjs";
const dir = new URL("../../fixtures/cedulas/", import.meta.url);
await mkdir(dir, { recursive: true });
for (const [id, label] of [
  ["100200001", "no-requerido"],
  ["100200002", "requerido"],
  ["999999999", "no-encontrado"],
]) {
  for (const type of ["pdf417", "code128"]) {
    const buffer = await bwipjs.toBuffer({
      bcid: type,
      text: type === "pdf417" ? `CC:${id}` : id,
      scale: 3,
      ...(type === "code128" ? { height: 15 } : {}),
      includetext: true,
      textxalign: "center",
      padding: 16,
      backgroundcolor: "FFFFFF",
    });
    await writeFile(new URL(`${id}-${label}-${type}.png`, dir), buffer);
  }
  const yellowCard = await bwipjs.toBuffer({
    bcid: "pdf417",
    text: yellowCardFixture(id),
    binarytext: true,
    columns: 14,
    eclevel: 5,
    scale: 3,
    padding: 16,
    backgroundcolor: "FFFFFF",
  });
  await writeFile(
    new URL(`${id}-${label}-amarilla-sintetica.png`, dir),
    yellowCard,
  );
}
console.log("Códigos ficticios generados en fixtures/cedulas.");
