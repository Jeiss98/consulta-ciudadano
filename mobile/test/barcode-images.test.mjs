import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { prepareZXingModule, readBarcodes } from "zxing-wasm/reader";
import { yellowCardFixture } from "../../fixtures/cedulas/amarilla-sintetica.mjs";

const require = createRequire(import.meta.url);
prepareZXingModule({
  overrides: {
    wasmBinary: await readFile(
      require.resolve("zxing-wasm/reader/zxing_reader.wasm"),
    ),
  },
});
const source = await readFile(
  new URL("../src/barcode.js", import.meta.url),
  "utf8",
);
const { identificationFromScan } = await import(
  "data:text/javascript;base64," + Buffer.from(source).toString("base64")
);

for (const [id, label] of [
  ["100200001", "no-requerido"],
  ["100200002", "requerido"],
  ["999999999", "no-encontrado"],
]) {
  for (const variant of ["pdf417", "code128", "amarilla-sintetica"]) {
    test(`decodifica el PNG ${id}-${label}-${variant} y extrae su identificación`, async () => {
      const image = await readFile(
        new URL(
          `../../fixtures/cedulas/${id}-${label}-${variant}.png`,
          import.meta.url,
        ),
      );
      const results = await readBarcodes(image, {
        formats: ["PDF417", "Code128"],
        tryHarder: true,
      });
      assert.equal(results.length, 1);
      assert.equal(results[0].isValid, true);
      const raw = Buffer.from(results[0].bytes).toString("latin1");
      if (variant === "amarilla-sintetica") {
        assert.equal(
          raw,
          yellowCardFixture(id),
          "El PNG debe conservar todos los bytes, incluidos los NUL",
        );
      }
      assert.equal(
        identificationFromScan({
          type: variant === "code128" ? "code128" : "pdf417",
          raw,
        }),
        id,
      );
    });
  }
}
