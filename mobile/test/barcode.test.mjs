import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { yellowCardFixture } from "../../fixtures/cedulas/amarilla-sintetica.mjs";
const code = await readFile(
  new URL("../src/barcode.js", import.meta.url),
  "utf8",
);
const { extractIdentification, identificationFromScan } = await import(
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

for (const id of [
  "12345",
  "123456",
  "1234567",
  "98765432",
  "100200001",
  "1012345678",
]) {
  test(`cédula amarilla: conserva el número ${id} y quita solo su relleno`, () => {
    assert.equal(extractIdentification(yellowCardFixture(id)), id);
  });
}

test("no confunde identificación con AFIS, ficha ni fecha de nacimiento", () => {
  assert.equal(
    extractIdentification(yellowCardFixture("100200002")),
    "100200002",
  );
});

test("admite ficha corta con relleno NUL o espacios sin desplazar la identificación", () => {
  for (const fingerCard of ["123456\0\0", "123456  "]) {
    assert.equal(
      extractIdentification(yellowCardFixture("100200002", { fingerCard })),
      "100200002",
    );
  }
});

test("permite nombres compuestos, tildes y segundos nombres o apellidos vacíos", () => {
  for (const overrides of [
    { surname: "MUÑOZ", name: "JOSÉ MARÍA" },
    { middleName: "" },
    { secondSurname: "" },
    { secondSurname: "", middleName: "", gender: "M" },
  ]) {
    assert.equal(
      extractIdentification(yellowCardFixture("100200001", overrides)),
      "100200001",
    );
  }
});

test("permite relleno de espacios dentro de los campos de nombres", () => {
  const value = yellowCardFixture();
  const padded =
    value.slice(0, 58) +
    value.slice(58, 150).replace(/\0/g, " ") +
    value.slice(150);
  assert.equal(extractIdentification(padded), "100200001");
});

test("rechaza payloads truncados, desplazados o con separadores eliminados", () => {
  const value = yellowCardFixture();
  for (const broken of [
    value.slice(0, 57),
    value.slice(0, 159),
    value.slice(0, 167),
    value.slice(1),
    " " + value,
    value.replace(/\0/g, ""),
    value.replace(/\0+/g, "\0"),
    value.replace("PubDSK_1", "OTRO____"),
    value.replace("100200001", "1002X0001"),
  ])
    assert.throws(() => extractIdentification(broken));
});

test("rechaza campos dañados y fechas imposibles sin devolver otra identificación", () => {
  for (const overrides of [
    { afis: "ABCDEFGHIJ" },
    { fingerCard: "ABCD1234" },
    { surname: "" },
    { surname: "12345678" },
    { name: "" },
    { name: "PERSONA\0OTRA" },
    { gender: "X" },
    { birthDate: "19810229" },
    { birthDate: "19801301" },
    { birthDate: "19800230" },
    { birthDate: "29990101" },
    { birthDate: "19800001" },
    { birthDate: "19800100" },
  ])
    assert.throws(() =>
      extractIdentification(yellowCardFixture("100200001", overrides)),
    );
  for (const id of ["0", "1234", "12345678901"]) {
    assert.throws(() => extractIdentification(yellowCardFixture(id)));
  }
});

test("no une dígitos separados por NUL ni convierte entradas que no son texto", () => {
  for (const value of [
    null,
    undefined,
    100200001,
    {},
    [],
    "null",
    "1".repeat(4097),
    "100\u0000200001",
    "CC:100\u0000200001",
    "0000000000000000",
  ]) {
    assert.throws(() => extractIdentification(value));
  }
});

test("Android usa raw aunque displayValue haya quitado los NUL o sea otro número", () => {
  const raw = yellowCardFixture("100200002");
  for (const data of [raw.replace(/\0/g, ""), "87654321", undefined]) {
    assert.equal(
      identificationFromScan({ type: "pdf417", raw, data }),
      "100200002",
    );
  }
});

test("usa data cuando el lector no entrega raw", () => {
  assert.equal(
    identificationFromScan({ type: "pdf417", data: yellowCardFixture() }),
    "100200001",
  );
  assert.equal(
    identificationFromScan({ type: "code128", raw: "", data: "100200001" }),
    "100200001",
  );
  assert.equal(
    identificationFromScan({ type: "pdf417", data: "CC:100200002" }),
    "100200002",
  );
});

test("no usa displayValue si raw existe pero está dañado", () => {
  assert.throws(() =>
    identificationFromScan({
      type: "pdf417",
      raw: "ilegible",
      data: "100200001",
    }),
  );
});

test("rechaza otros tipos de código y eventos vacíos", () => {
  for (const event of [
    null,
    {},
    { type: "qr", data: "100200001" },
    { type: "code128", data: yellowCardFixture() },
  ]) {
    assert.throws(() => identificationFromScan(event));
  }
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
