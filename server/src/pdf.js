import { fileURLToPath } from "node:url";
import PDFDocument from "pdfkit";
export async function citizenPdf(rows, filter) {
  const doc = new PDFDocument({
    size: "A4",
    margin: 42,
    bufferPages: true,
    info: { Title: "Reporte de ciudadanos", Author: "Consulta Ciudadano" },
  });
  doc.registerFont(
    "CC-Regular",
    fileURLToPath(new URL("../../web/fonts/DejaVuSans.ttf", import.meta.url)),
  );
  doc.registerFont(
    "CC-Bold",
    fileURLToPath(
      new URL("../../web/fonts/DejaVuSans-Bold.ttf", import.meta.url),
    ),
  );
  const chunks = [];
  doc.on("data", (chunk) => chunks.push(chunk));
  const done = new Promise((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
  const labels = {
    todos: "Todos",
    requeridos: "Requeridos",
    no_requeridos: "No requeridos",
  };
  const date = new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Bogota",
  }).format(new Date());
  // Columnas: Identificación | Nombres | Apellidos | Estado
  const COL = { id: 50, nombres: 160, apellidos: 330, estado: 468 };
  const W = { id: 100, nombres: 162, apellidos: 130, estado: 88 };
  function header() {
    doc
      .fillColor("#102f39")
      .font("CC-Bold")
      .fontSize(23)
      .text("Consulta Ciudadano", 42, 42);
    doc
      .font("CC-Regular")
      .fontSize(10)
      .fillColor("#527079")
      .text("REGISTRADURÍA KONRAD LORENZ · DEMOSTRACIÓN ACADÉMICA", 42, 75);
    doc
      .fontSize(15)
      .fillColor("#102f39")
      .text("Reporte de ciudadanos", 42, 110);
    doc
      .fontSize(10)
      .text(`Filtro: ${labels[filter]}    |    Total: ${rows.length}`, 42, 136)
      .text(`Generado: ${date} (Bogotá)`, 42, 152);
    doc.rect(42, 180, 511, 26).fill("#e9f3f1");
    doc.fillColor("#102f39").font("CC-Bold");
    doc.text("Identificación", COL.id, 189, { width: W.id, lineBreak: false });
    doc.text("Nombres", COL.nombres, 189, { width: W.nombres, lineBreak: false });
    doc.text("Apellidos", COL.apellidos, 189, { width: W.apellidos, lineBreak: false });
    doc.text("Estado", COL.estado, 189, { width: W.estado, lineBreak: false });
  }
  header();
  let y = 218;
  for (const row of rows) {
    const estadoLabel = row.requerido ? "Requerido" : "No requerido";
    const estadoColor = row.requerido ? "#a44738" : "#236b49";
    const estadoBg = row.requerido ? "#fff0eb" : "#e9f6ec";
    doc.font("CC-Regular").fontSize(10);
    const h = Math.max(
      28,
      doc.heightOfString(row.nombres, { width: W.nombres }) + 14,
      doc.heightOfString(row.apellidos, { width: W.apellidos }) + 14,
    );
    if (y + h > 765) {
      doc.addPage();
      header();
      y = 218;
    }
    doc
      .fillColor("#213d45")
      .text(row.identificacion, COL.id, y, { width: W.id })
      .text(row.nombres, COL.nombres, y, { width: W.nombres })
      .text(row.apellidos, COL.apellidos, y, { width: W.apellidos });
    // Pastilla de estado coloreada
    const badgeH = 16;
    doc.roundedRect(COL.estado, y + 1, W.estado, badgeH, 4).fill(estadoBg);
    doc
      .fillColor(estadoColor)
      .font("CC-Bold")
      .fontSize(8)
      .text(estadoLabel, COL.estado + 4, y + 4, {
        width: W.estado - 8,
        lineBreak: false,
      });
    doc.font("CC-Regular").fontSize(10);
    doc
      .moveTo(42, y + h - 8)
      .lineTo(553, y + h - 8)
      .strokeColor("#e4e9ec")
      .stroke();
    y += h;
  }
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    doc
      .fontSize(9)
      .fillColor("#667b81")
      .text(`Datos ficticios · Página ${i + 1} de ${range.count}`, 42, 788, {
        lineBreak: false,
      });
  }
  doc.end();
  return done;
}
