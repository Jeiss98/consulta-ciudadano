const unsupportedMessage =
  "No se pudo interpretar la cédula. Enfoca completo el código del reverso, evita reflejos y vuelve a leer. También puedes ingresar el número manualmente.";

function unsupported() {
  return new Error(unsupportedMessage);
}

function validDate(value) {
  if (!/^\d{8}$/.test(value)) return false;
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(4, 6));
  const day = Number(value.slice(6, 8));
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    year >= 1800 &&
    date <= new Date() &&
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function validName(field, optional = false) {
  // Solo quitamos el relleno al FINAL de cada campo, nunca del payload completo.
  const name = field.replace(/[\0 ]+$/, "");
  return (
    (optional && name === "") || /^[A-ZÁÉÍÓÚÜÑ][A-ZÁÉÍÓÚÜÑ '\-]*$/i.test(name)
  );
}

function yellowCardIdentification(value) {
  // Distribución PubDSK de la cédula amarilla, documentada en docs/ESCANEO.md.
  // Los offsets requieren conservar los NUL y los espacios del lector.
  // No buscamos números arbitrarios: AFIS, ficha y fecha también son numéricos.
  if (
    value.length < 168 ||
    !/^\d{10}\0+PubDSK_\d\0*$/.test(value.slice(0, 40)) ||
    !/^\d{1,8}[\0 ]*$/.test(value.slice(40, 48)) ||
    !/^\d{10}$/.test(value.slice(48, 58)) ||
    !validName(value.slice(58, 81)) ||
    !validName(value.slice(81, 104), true) ||
    !validName(value.slice(104, 127)) ||
    !validName(value.slice(127, 150), true) ||
    !/^[MF]$/.test(value[151]) ||
    !validDate(value.slice(152, 160))
  )
    throw unsupported();

  const identification = value.slice(48, 58).replace(/^0+/, "");
  // Conserva el contrato actual de la API (5–15 dígitos).
  if (!/^\d{5,10}$/.test(identification)) throw unsupported();
  return identification;
}

/**
 * Interpreta el texto ORIGINAL de PDF417 PubDSK o los códigos de demostración.
 * No guarda ni devuelve el payload ni los otros datos personales del documento.
 */
export function extractIdentification(raw) {
  if (typeof raw !== "string" || raw.length > 4096) throw unsupported();

  // Antes de trim: una normalización global desplazaría los campos de la cédula.
  if (raw.includes("PubDSK_")) return yellowCardIdentification(raw);

  const value = raw.trim();
  if (/^\d{5,15}$/.test(value)) return value;
  const tagged = value.match(/^CC:(\d{5,15})$/i);
  if (tagged) return tagged[1];
  try {
    const data = JSON.parse(value);
    if (
      typeof data?.identificacion === "string" &&
      /^\d{5,15}$/.test(data.identificacion)
    )
      return data.identificacion;
  } catch {}
  throw unsupported();
}

/** Adapta el evento de expo-camera; Android data es displayValue, raw lo conserva. */
export function identificationFromScan(event) {
  if (!event || !["pdf417", "code128"].includes(event.type))
    throw unsupported();
  const value =
    typeof event.raw === "string" && event.raw.length > 0
      ? event.raw
      : event.data;
  if (
    event.type !== "pdf417" &&
    typeof value === "string" &&
    value.includes("PubDSK_")
  )
    throw unsupported();
  // Si raw existe pero es inválido, no recurrimos a un displayValue diferente.
  return extractIdentification(value);
}
