/**
 * Payload SINTÉTICO para probar la distribución PubDSK. No es un documento,
 * no contiene información biométrica ni datos copiados de una persona.
 * Independiente del parser móvil: los anchos provienen de docs/ESCANEO.md.
 */
export function yellowCardFixture(
  identification = "100200001",
  overrides = {},
) {
  const fields = {
    afis: "0312345678",
    fingerCard: "87654321",
    surname: "PRUEBA",
    secondSurname: "DEMOSTRACION",
    name: "PERSONA",
    middleName: "FICTICIA",
    gender: "F",
    birthDate: "19800229",
    ...overrides,
  };
  const nameField = (name) => name.padEnd(23, "\0");
  const header = fields.afis + "\0".repeat(15) + "PubDSK_1" + "\0".repeat(7);
  const text =
    header +
    fields.fingerCard +
    identification.padStart(10, "0") +
    nameField(fields.surname) +
    nameField(fields.secondSurname) +
    nameField(fields.name) +
    nameField(fields.middleName) +
    "0" +
    fields.gender +
    fields.birthDate +
    "150010O+";
  return text.padEnd(531, "\0");
}
