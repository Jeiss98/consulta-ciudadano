/**
 * Contrato de la demostración: Code 128/PDF417 con identificación numérica,
 * PDF417 CC:<identificación> o JSON {"identificacion":"..."}.
 * Rechaza datos ambiguos: no toma el primer número de una cédula real.
 */
export function extractIdentification(raw) {
  const value = String(raw || "")
    .replace(/\0/g, "")
    .trim();
  if (/^\d{5,15}$/.test(value)) return value;
  const tagged = value.match(/^CC:(\d{5,15})$/i);
  if (tagged) return tagged[1];
  try {
    const data = JSON.parse(value);
    if (
      typeof data.identificacion === "string" &&
      /^\d{5,15}$/.test(data.identificacion)
    )
      return data.identificacion;
  } catch {}
  throw new Error(
    "Código no compatible. Usa una cédula de demostración del proyecto.",
  );
}
