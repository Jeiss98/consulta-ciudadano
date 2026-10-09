import http from "node:http";
import { SMTPServer } from "smtp-server";

const emails = [];

// 1. Servidor SMTP en 127.0.0.1:1025
const smtp = new SMTPServer({
  authOptional: true,
  disabledCommands: ["AUTH", "STARTTLS"],
  onData(stream, session, callback) {
    let raw = "";
    stream.on("data", (chunk) => (raw += chunk));
    stream.on("end", () => {
      const toMatch = raw.match(/To:\s*([^\r\n]+)/i);
      const subjectMatch = raw.match(/Subject:\s*([^\r\n]+)/i);
      const parts = raw.split(/\r?\n\r?\n/);
      const body = parts.slice(1).join("\n\n").trim();
      const pwdMatch = body.match(/Contrase(?:=C3=B1|ñ)a:\s*([^\r\n]+)/i);
      const idMatch = body.match(/Identificaci(?:=C3=B3|ó)n:\s*([^\r\n]+)/i);

      const email = {
        id: emails.length + 1,
        to: toMatch ? toMatch[1].trim() : "desconocido",
        subject: subjectMatch ? subjectMatch[1].trim() : "Sin asunto",
        body,
        identificacion: idMatch ? idMatch[1].trim() : null,
        password: pwdMatch ? pwdMatch[1].trim() : null,
        date: new Date().toLocaleTimeString(),
      };

      emails.unshift(email);
      console.log("\n==================================================");
      console.log("📨 CORREO DE REGISTRO RECIBIDO:");
      console.log(`Para: ${email.to}`);
      console.log(`Asunto: ${email.subject}`);
      if (email.password) {
        console.log(`👤 IDENTIFICACIÓN: ${email.identificacion}`);
        console.log(`🔑 CONTRASEÑA ASIGNADA: ${email.password}`);
      }
      console.log("==================================================\n");
      callback();
    });
  },
});

smtp.listen(1025, "127.0.0.1", () => {
  console.log("Servidor SMTP de pruebas activo en 127.0.0.1:1025");
});

// 2. Visor web en 127.0.0.1:8025
const server = http.createServer((req, res) => {
  if (req.url === "/api/emails") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify(emails));
  }

  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(`<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Buzón de Correos · Consulta Ciudadano</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    :root { font-family: system-ui, -apple-system, sans-serif; background: #0b1517; color: #e6f1f2; }
    body { max-width: 800px; margin: 0 auto; padding: 2rem 1rem; }
    header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #1a3c42; padding-bottom: 1rem; margin-bottom: 1.5rem; }
    h1 { font-size: 1.3rem; margin: 0; display: flex; align-items: center; gap: 0.5rem; }
    .badge { background: #134e48; color: #5eead4; padding: 0.2rem 0.6rem; border-radius: 9999px; font-size: 0.8rem; font-weight: 600; }
    .empty { background: #112529; border: 1px dashed #204850; padding: 2.5rem; text-align: center; border-radius: 8px; color: #8da4a8; }
    .email-card { background: #132a2f; border: 1px solid #1f434a; border-radius: 8px; padding: 1.25rem; margin-bottom: 1rem; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.2); }
    .email-header { display: flex; justify-content: space-between; margin-bottom: 0.5rem; font-size: 0.85rem; color: #8da4a8; }
    .email-subject { font-size: 1.05rem; font-weight: bold; color: #f0fdfa; margin-bottom: 0.5rem; }
    .email-to { color: #99f6e4; }
    .email-body { background: #091214; padding: 1rem; border-radius: 6px; font-family: monospace; white-space: pre-wrap; font-size: 0.95rem; border-left: 3px solid #14b8a6; }
    .key-badge { display: inline-block; background: #065f46; color: #a7f3d0; padding: 0.35rem 0.6rem; border-radius: 4px; font-weight: bold; margin-top: 0.75rem; font-size: 1rem; }
  </style>
  <script>
    setInterval(() => {
      fetch('/api/emails').then(r => r.json()).then(data => {
        const container = document.getElementById('list');
        if (data.length === 0) return;
        container.innerHTML = data.map(m => \`
          <article class="email-card">
            <div class="email-header">
              <span>Para: <strong class="email-to">\${m.to}</strong></span>
              <span>\${m.date}</span>
            </div>
            <div class="email-subject">\${m.subject}</div>
            <pre class="email-body">\${m.body}</pre>
            \${m.password ? \`<div class="key-badge">🔑 Contraseña: \${m.password}</div>\` : ''}
          </article>
        \`).join('');
      });
    }, 2000);
  </script>
</head>
<body>
  <header>
    <h1>📬 Buzón de Demostración (Simulador de Correo)</h1>
    <span class="badge">Puerto 1025 (SMTP) / 8025 (Web)</span>
  </header>
  <main id="list">
    ${
      emails.length === 0
        ? `<div class="empty">No hay correos aún. Cuando crees una cuenta o usuario, aquí aparecerá el mensaje con la contraseña generada.</div>`
        : emails
            .map(
              (m) => `
          <article class="email-card">
            <div class="email-header">
              <span>Para: <strong class="email-to">${m.to}</strong></span>
              <span>${m.date}</span>
            </div>
            <div class="email-subject">${m.subject}</div>
            <pre class="email-body">${m.body}</pre>
            ${m.password ? `<div class="key-badge">🔑 Contraseña: ${m.password}</div>` : ""}
          </article>
        `,
            )
            .join("")
    }
  </main>
</body>
</html>`);
});

server.listen(8025, "127.0.0.1", () => {
  console.log("Visor web de correos disponible en http://localhost:8025");
});
