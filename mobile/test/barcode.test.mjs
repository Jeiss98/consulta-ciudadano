import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const code = await readFile(
  new URL("../src/barcode.js", import.meta.url),
  "utf8",
);
const { extractIdentification } = await import(
  "data:text/javascript;base64," + Buffer.from(code).toString("base64")
);
test("identificación de Code 128, PDF417 y JSON de demostración", () => {
  assert.equal(extractIdentification("100200001"), "100200001");
  assert.equal(extractIdentification("CC:100200002"), "100200002");
  assert.equal(
    extractIdentification('{"identificacion":"100200003"}'),
    "100200003",
  );
});
test("rechaza contenido ambiguo para evitar consultar a otra persona", () => {
  for (const value of [
    "",
    "abc",
    "123",
    "datos 100200001 19980101",
    "https://ejemplo.com/100200001",
    '{"identificacion":100200001}',
  ])
    assert.throws(() => extractIdentification(value));
});
