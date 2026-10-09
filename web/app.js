import { api, escapeHtml as e } from "./api.js";
const $ = (s) => document.querySelector(s);
const icons = {
  citizens:
    '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M5 16q4-6 8 0m2-7h3m-3 5h3"/>',
  users:
    '<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2m2-15a3 3 0 0 1 0 6m1 3a5 5 0 0 1 3 5"/>',
  security:
    '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6z"/><path d="m8 12 3 3 5-6"/>',
  reports: '<path d="M14 3H5v18h14V8zM14 3v6h5M8 13h8m-8 4h6"/>',
  audit: '<circle cx="12" cy="12" r="9"/><path d="M12 7v6l4 2"/>',
  search: '<circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/>',
};
const icon = (name) =>
  `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor">${icons[name] || icons.security}</svg>`;
const brand = `<div class="brand"><img src="/marca.svg" alt=""><span>Consulta Ciudadano<small>Sistema de registro</small></span></div>`;
let user = null,
  view = "citizens",
  page = 1,
  q = "",
  filter = "todos",
  inactive = false,
  rows = [],
  security = null,
  requestVersion = 0;
const views = {
  citizens: [
    "Ciudadanos",
    "Administra la información y el estado de los ciudadanos.",
    "ciudadanos.leer",
  ],
  users: [
    "Usuarios",
    "Gestiona el acceso de las personas que operan el sistema.",
    "usuarios.gestionar",
  ],
  security: [
    "Perfiles y permisos",
    "Define las opciones disponibles para cada perfil.",
    "seguridad.gestionar",
  ],
  reports: [
    "Reportes",
    "Genera el listado de ciudadanos en formato PDF.",
    "reportes.generar",
  ],
  audit: [
    "Auditoría",
    "Consulta quién hizo un cambio y compara sus valores.",
    "auditoria.leer",
  ],
};
const can = (p) => user?.permisos.includes(p);
const permitted = () => Object.keys(views).filter((key) => can(views[key][2]));
const initials = (n, a = "") =>
  e(`${n?.[0] || ""}${a?.[0] || ""}`.toUpperCase());
const badge = (text, type = "") =>
  `<span class="badge ${type}">${e(text)}</span>`;
function toast(message) {
  $("#toast").textContent = message;
  $("#toast").classList.add("show");
  setTimeout(() => $("#toast").classList.remove("show"), 4500);
}
function renderLogin() {
  user = null;
  requestVersion++;
  $("#dialog").close();
  $("#app").innerHTML =
    `<main class="login"><section class="login-story">${brand}<div class="story-content"><h1>La información correcta.<br><span>En el momento indicado.</span></h1><p>Un punto de encuentro entre el registro ciudadano y la consulta en campo.</p><div class="document-art" aria-hidden="true"><div class="art-head"><span>REGISTRO CIUDADANO</span><span>CC</span></div><div class="art-line"></div><div class="art-line short"></div><div class="check">✓</div><div class="art-bottom"><span>Identidad · Estado · Consulta</span><span>●</span></div></div></div><div class="login-foot">REGISTRADURÍA KONRAD LORENZ · PROYECTO ACADÉMICO</div></section><section class="login-form-wrap"><form id="login" class="login-form"><div class="eyebrow">Acceso administrativo</div><h2>Bienvenido de nuevo</h2><p class="muted">Ingresa tus credenciales para continuar.</p><label class="form-field">Identificación<input name="identificacion" inputmode="numeric" pattern="[0-9]{5,15}" autocomplete="username" placeholder="Tu número de identificación" required></label><label class="form-field">Contraseña<input name="password" type="password" autocomplete="current-password" placeholder="Ingresa tu contraseña" required maxlength="64"></label><div class="error" id="login-error" role="alert"></div><button class="primary wide">Ingresar al sistema <span>→</span></button><div class="note">El personal de la fuerza pública ingresa desde la aplicación móvil.<br>Demostración con datos ficticios.</div></form></section></main>`;
  $("#login").onsubmit = async (event) => {
    event.preventDefault();
    const button = $("#login button");
    button.disabled = true;
    $("#login-error").textContent = "";
    try {
      const result = await api("/auth/login", {
        method: "POST",
        body: {
          ...Object.fromEntries(new FormData(event.target)),
          canal: "web",
        },
      });
      user = result.user;
      view = permitted()[0] || "citizens";
      renderShell();
    } catch (error) {
      $("#login-error").textContent = error.message;
    } finally {
      button.disabled = false;
    }
  };
}
async function renderShell() {
  try {
    const options = await api("/opciones");
    const map = {
      CIUDADANOS: "citizens",
      USUARIOS: "users",
      SEGURIDAD: "security",
      REPORTES: "reports",
      AUDITORIA: "audit",
    };
    for (const option of options) {
      if (map[option.codigo]) views[map[option.codigo]][0] = option.nombre;
    }
  } catch (error) {
    if (!user) return;
    toast(error.message);
  }
  const nav = permitted();
  $("#app").innerHTML =
    `<div class="shell"><aside class="sidebar">${brand}<div class="nav-label">Administración</div><nav class="nav">${nav.map((key) => `<button data-nav="${key}" class="${key === view ? "active" : ""}">${icon(key)}${views[key][0]}</button>`).join("")}</nav><div class="sidebar-bottom"><b>Registraduría Konrad Lorenz</b>Proyecto académico<br>Datos de demostración</div></aside><main class="main"><header class="topbar"><span class="breadcrumb">Sistema de registro &nbsp; / &nbsp; <b id="breadcrumb"></b></span><select class="mobile-toggle" aria-label="Sección">${nav.map((key) => `<option value="${key}">${views[key][0]}</option>`).join("")}</select><div class="user-menu"><div class="avatar">${initials(user.nombres, user.apellidos)}</div><span class="user-info">${e(user.nombres)}<small>Administrador</small></span><button id="logout" class="logout">Cerrar sesión ↗</button></div></header><div id="content" class="page"></div></main></div>`;
  document
    .querySelectorAll("[data-nav]")
    .forEach((b) => (b.onclick = () => navigate(b.dataset.nav)));
  $(".mobile-toggle").onchange = (event) => navigate(event.target.value);
  $("#logout").onclick = async () => {
    try {
      await api("/auth/logout", { method: "POST" });
      renderLogin();
    } catch (error) {
      toast(error.message);
    }
  };
  if (!nav.length) {
    $("#content").innerHTML =
      '<div class="empty">No tienes opciones asignadas. Contacta a un administrador.</div>';
    return;
  }
  navigate(nav.includes(view) ? view : nav[0]);
}
function navigate(key) {
  view = key;
  page = 1;
  q = "";
  filter = "todos";
  inactive = false;
  document
    .querySelectorAll("[data-nav]")
    .forEach((b) => b.classList.toggle("active", b.dataset.nav === view));
  $(".mobile-toggle").value = view;
  $("#breadcrumb").textContent = views[view][0];
  renderPage();
}
function heading(action = "") {
  return `<div class="page-heading"><div><div class="eyebrow">Sistema de registro</div><h1>${views[view][0]}</h1><p>${views[view][1]}</p></div>${action}</div>`;
}
function searchToolbar() {
  return `<div class="toolbar"><form id="search-form" class="search">${icon("search")}<input id="search" aria-label="Buscar" placeholder="${view === "audit" ? "Usuario, tabla o acción…" : "Buscar por identificación o nombre…"}" value="${e(q)}"></form>${view === "citizens" ? `<div class="filters"><label class="check-label"><input id="inactive" type="checkbox" ${inactive ? "checked" : ""}>Incluir inactivos</label><select id="filter" aria-label="Estado"><option value="todos">Todos los estados</option><option value="requeridos">Requeridos</option><option value="no_requeridos">No requeridos</option></select></div>` : '<span class="muted">Presiona Enter para buscar</span>'}</div>`;
}
async function renderPage() {
  const version = ++requestVersion;
  if (view === "reports") return renderReports();
  const action =
    (view === "citizens" && can("ciudadanos.escribir")) ||
    view === "users" ||
    view === "security"
      ? `<button id="new" class="primary">+ ${view === "citizens" ? "Nuevo ciudadano" : view === "users" ? "Nuevo usuario" : "Nuevo perfil"}</button>`
      : "";
  $("#content").innerHTML =
    heading(action) + '<div class="loading">Cargando registros…</div>';
  try {
    if (view === "security") {
      security = await api("/seguridad");
      if (version !== requestVersion) return;
      renderSecurity();
      return;
    }
    const path = {
      citizens: "ciudadanos",
      users: "usuarios",
      audit: "auditoria",
    }[view];
    const data = await api(
      `/${path}?${new URLSearchParams({ page, size: 8, q, estado: filter, incluir_inactivos: inactive })}`,
    );
    if (version !== requestVersion) return;
    rows = data.items;
    $("#content").innerHTML =
      heading(action) +
      `<section class="panel">${searchToolbar()}<div class="table-wrap">${renderTable()}</div><div class="table-footer"><span>${data.total ? `${(page - 1) * 8 + 1}–${Math.min(page * 8, data.total)} de ${data.total} registros` : "Sin registros"}</span><div class="pager"><button id="prev" aria-label="Página anterior" ${page <= 1 ? "disabled" : ""}>←</button><span>${page} / ${data.pages}</span><button id="next" aria-label="Página siguiente" ${page >= data.pages ? "disabled" : ""}>→</button></div></div></section><p class="below-note">${icon("security")}${view === "audit" ? "Historial de solo lectura. Los cambios guardan sus valores anteriores y nuevos." : "Los cambios realizados en este módulo quedan registrados en la auditoría."}</p>`;
    $("#search-form").onsubmit = (event) => {
      event.preventDefault();
      q = $("#search").value.trim();
      page = 1;
      renderPage();
    };
    $("#prev").onclick = () => {
      page--;
      renderPage();
    };
    $("#next").onclick = () => {
      page++;
      renderPage();
    };
    if (view === "citizens") {
      $("#filter").value = filter;
      $("#filter").onchange = (event) => {
        filter = event.target.value;
        page = 1;
        renderPage();
      };
      $("#inactive").onchange = (event) => {
        inactive = event.target.checked;
        page = 1;
        renderPage();
      };
    }
    if ($("#new"))
      $("#new").onclick = () =>
        view === "citizens" ? citizenForm() : userForm();
    document.querySelectorAll("[data-edit]").forEach(
      (b) =>
        (b.onclick = () => {
          const row = rows.find((r) => String(r.id) === b.dataset.edit);
          view === "citizens" ? citizenForm(row) : userForm(row);
        }),
    );
    document
      .querySelectorAll("[data-audit]")
      .forEach(
        (b) =>
          (b.onclick = () =>
            auditDetail(rows.find((r) => String(r.id) === b.dataset.audit))),
      );
  } catch (error) {
    if (version === requestVersion && user) {
      $("#content").innerHTML =
        heading() + `<div class="error">${e(error.message)}</div>`;
    }
  }
}
function renderTable() {
  if (!rows.length)
    return '<div class="empty">No hay registros que coincidan con tu búsqueda.</div>';
  if (view === "citizens")
    return `<table><thead><tr><th>Ciudadano</th><th>Identificación</th><th>Grupo / RH</th><th>Estado</th><th>Registro</th><th></th></tr></thead><tbody>${rows.map((r) => `<tr><td><div class="person"><span class="avatar">${initials(r.nombres, r.apellidos)}</span><div><strong>${e(r.nombres)} ${e(r.apellidos)}</strong><small>${e(r.lugar_nacimiento)}</small></div></div></td><td class="mono">${e(r.identificacion)}</td><td>${e(r.grupo_sanguineo)} ${e(r.rh)}</td><td>${badge(r.requerido ? "Requerido" : "No requerido", r.requerido ? "red" : "")}</td><td>${badge(r.activo ? "Activo" : "Inactivo", r.activo ? "" : "gray")}</td><td class="action-cell">${can("ciudadanos.escribir") ? `<button class="text-button" data-edit="${r.id}">Editar ↗</button>` : ""}</td></tr>`).join("")}</tbody></table>`;
  if (view === "users")
    return `<table><thead><tr><th>Usuario</th><th>Identificación</th><th>Perfiles</th><th>Estado</th><th></th></tr></thead><tbody>${rows.map((r) => `<tr><td><strong>${e(r.nombres)} ${e(r.apellidos)}</strong><div class="help">${e(r.correo)}</div></td><td class="mono">${e(r.identificacion)}</td><td>${r.perfiles.map((p) => `<span class="tag">${e(p.nombre)}</span>`).join(" ")}</td><td>${badge(r.activo ? "Activo" : "Inactivo", r.activo ? "" : "gray")}</td><td><button class="text-button" data-edit="${r.id}">Editar ↗</button></td></tr>`).join("")}</tbody></table>`;
  return `<table><thead><tr><th>Fecha y hora</th><th>Usuario</th><th>Acción</th><th>Tabla / Registro</th><th></th></tr></thead><tbody>${rows.map((r) => `<tr><td>${e(new Date(r.fecha).toLocaleString("es-CO", { timeZone: "America/Bogota" }))}</td><td class="mono">${e(r.actor)}</td><td>${badge(r.accion, r.accion === "DELETE" ? "red" : "gray")}</td><td>${e(r.tabla)}<div class="help">${e(r.registro_id)}</div></td><td><button class="text-button" data-audit="${r.id}">Ver detalle ↗</button></td></tr>`).join("")}</tbody></table>`;
}
function openDialog(title, body, submitLabel = "Guardar cambios") {
  $("#dialog").innerHTML =
    `<form id="modal-form"><header class="modal-head"><h2 id="dialog-title">${title}</h2><button type="button" class="close" aria-label="Cerrar">×</button></header><div class="modal-body">${body}<div id="modal-error" class="error" role="alert"></div></div><footer class="modal-footer"><button type="button" class="secondary cancel">${submitLabel ? "Cancelar" : "Cerrar"}</button>${submitLabel ? `<button type="submit" class="primary">${submitLabel}</button>` : ""}</footer></form>`;
  $("#dialog .close").onclick = () => $("#dialog").close();
  $("#dialog .cancel").onclick = () => $("#dialog").close();
  $("#dialog").showModal();
}
const input = (label, name, value = "", type = "text", extra = "") =>
  `<label class="form-field">${label}<input name="${name}" value="${e(value)}" type="${type}" ${extra} required></label>`;
const select = (label, name, options, value) =>
  `<label class="form-field">${label}<select name="${name}">${options.map((v) => `<option value="${e(Array.isArray(v) ? v[0] : v)}" ${String(Array.isArray(v) ? v[0] : v) === String(value) ? "selected" : ""}>${e(Array.isArray(v) ? v[1] : v)}</option>`).join("")}</select></label>`;
function bindSave(callback) {
  $("#modal-form").onsubmit = async (event) => {
    event.preventDefault();
    const button = $("#modal-form button[type=submit]");
    button.disabled = true;
    $("#modal-error").textContent = "";
    try {
      await callback(new FormData(event.target));
      $("#dialog").close();
      toast("Cambios guardados correctamente.");
      if (user) {
        user = await api("/auth/me");
        renderShell();
      }
    } catch (error) {
      $("#modal-error").textContent = error.message;
    } finally {
      button.disabled = false;
    }
  };
}
function citizenForm(r = {}) {
  openDialog(
    r.id ? "Editar ciudadano" : "Nuevo ciudadano",
    `<div class="form-grid">${input("Identificación", "identificacion", r.identificacion, "text", 'pattern="[0-9]{5,15}" inputmode="numeric"')}${select(
      "Estado judicial",
      "requerido",
      [
        [false, "No requerido"],
        [true, "Requerido"],
      ],
      r.requerido || false,
    )}${input("Nombres", "nombres", r.nombres, "text", 'maxlength="80"')}${input("Apellidos", "apellidos", r.apellidos, "text", 'maxlength="80"')}${input("Fecha de nacimiento", "fecha_nacimiento", r.fecha_nacimiento, "date")}${input("Lugar de nacimiento", "lugar_nacimiento", r.lugar_nacimiento, "text", 'maxlength="120"')}${input("Fecha de expedición", "fecha_expedicion", r.fecha_expedicion, "date")}${input("Lugar de expedición", "lugar_expedicion", r.lugar_expedicion, "text", 'maxlength="120"')}${select("Grupo sanguíneo", "grupo_sanguineo", ["O", "A", "B", "AB"], r.grupo_sanguineo || "O")}${select("Factor RH", "rh", ["+", "-"], r.rh || "+")}${input("Estatura (metros)", "estatura", r.estatura || "1.70", "number", 'min="0.50" max="2.50" step="0.01"')}${select(
      "Registro",
      "activo",
      [
        [true, "Activo"],
        [false, "Inactivo"],
      ],
      r.activo ?? true,
    )}</div>`,
  );
  bindSave(async (form) => {
    const data = Object.fromEntries(form);
    data.requerido = data.requerido === "true";
    data.activo = data.activo === "true";
    data.estatura = Number(data.estatura);
    await api(`/ciudadanos${r.id ? "/" + r.id : ""}`, {
      method: r.id ? "PUT" : "POST",
      body: data,
    });
  });
}
async function userForm(r = {}) {
  try {
    security = await api("/seguridad");
  } catch (error) {
    toast(error.message);
    return;
  }
  openDialog(
    r.id ? "Editar usuario" : "Nuevo usuario",
    `<div class="form-grid">${input("Identificación", "identificacion", r.identificacion, "text", 'pattern="[0-9]{5,15}"')}${select(
      "Estado",
      "activo",
      [
        [true, "Activo"],
        [false, "Inactivo"],
      ],
      r.activo ?? true,
    )}${input("Nombres", "nombres", r.nombres)}${input("Apellidos", "apellidos", r.apellidos)}<div class="full">${input("Correo electrónico", "correo", r.correo, "email")}</div><label class="form-field full">${r.id ? "Nueva contraseña (opcional)" : "Contraseña"}<input type="password" name="password" autocomplete="new-password" minlength="6" maxlength="64" ${r.id ? "" : "required"}><span class="help">Mínimo 6 caracteres, una mayúscula, una minúscula y un número.</span></label><div class="full"><label>Perfiles</label><div class="choices">${security.perfiles.map((p) => `<label class="check-label"><input type="checkbox" name="perfiles" value="${p.id}" ${r.perfiles?.some((rp) => rp.id === p.id) ? "checked" : ""}>${e(p.nombre)}</label>`).join("")}</div><p class="help">Puedes asignar varios perfiles. Editar un usuario cierra sus sesiones activas.</p></div></div>`,
  );
  bindSave(async (form) => {
    const data = Object.fromEntries(form);
    data.activo = data.activo === "true";
    data.perfiles = form.getAll("perfiles").map(Number);
    if (!data.password) delete data.password;
    await api(`/usuarios${r.id ? "/" + r.id : ""}`, {
      method: r.id ? "PUT" : "POST",
      body: data,
    });
    if (r.id === user.id) {
      await api("/auth/logout", { method: "POST" }).catch(() => {});
      renderLogin();
    }
  });
}
function renderSecurity() {
  $("#content").innerHTML =
    heading('<button id="new" class="primary">+ Nuevo perfil</button>') +
    `<div class="profile-grid">${security.perfiles.map((p) => `<article class="panel profile-card"><span class="eyebrow">Perfil de acceso</span><h3>${e(p.nombre)}</h3><p>${e(p.codigo)}</p><div class="tag-list">${p.permisos.map((x) => `<span class="tag">${e(x.nombre)}</span>`).join("") || '<span class="muted">Sin permisos asignados</span>'}</div><button class="secondary" data-profile="${p.id}">Editar permisos ↗</button></article>`).join("")}</div><h2 class="section-title">Opciones del sistema</h2><section class="panel">${security.opciones.map((o) => `<div class="option-row"><span>${e(o.nombre)} <small class="muted"> · ${e(o.codigo)}</small></span><button class="text-button" data-option="${o.id}">Cambiar nombre</button></div>`).join("")}</section><p class="below-note">${icon("security")}El catálogo de permisos corresponde a las funcionalidades implementadas.</p>`;
  $("#new").onclick = () => profileForm();
  document
    .querySelectorAll("[data-profile]")
    .forEach(
      (b) =>
        (b.onclick = () =>
          profileForm(
            security.perfiles.find((p) => p.id === Number(b.dataset.profile)),
          )),
    );
  document.querySelectorAll("[data-option]").forEach(
    (b) =>
      (b.onclick = () => {
        const o = security.opciones.find(
          (o) => o.id === Number(b.dataset.option),
        );
        openDialog("Editar opción", input("Nombre", "nombre", o.nombre));
        bindSave(async (form) =>
          api(`/opciones/${o.id}`, {
            method: "PUT",
            body: Object.fromEntries(form),
          }),
        );
      }),
  );
}
function profileForm(p = {}) {
  openDialog(
    p.id ? "Editar perfil" : "Nuevo perfil",
    `${input("Nombre", "nombre", p.nombre)}${input("Código", "codigo", p.codigo, "text", p.id && ["ADMINISTRADOR", "FUERZA_PUBLICA"].includes(p.codigo) ? "readonly" : 'pattern="[A-Z_]{3,40}" placeholder="Ejemplo: APOYO_REGISTRO"')}<p class="help">Los perfiles adicionales complementan los perfiles base; el canal web requiere Administrador y el móvil, Fuerza pública.</p><div class="choices vertical">${security.permisos.map((x) => `<label class="check-label"><input type="checkbox" name="permisos" value="${x.id}" ${p.permisos?.some((pp) => pp.id === x.id) ? "checked" : ""}>${e(x.nombre)}</label>`).join("")}</div>`,
  );
  bindSave(async (form) =>
    api(`/perfiles${p.id ? "/" + p.id : ""}`, {
      method: p.id ? "PUT" : "POST",
      body: {
        ...Object.fromEntries(form),
        permisos: form.getAll("permisos").map(Number),
      },
    }),
  );
}
function auditDetail(r) {
  const before = r.antes || {},
    after = r.despues || {};
  const fields = [...new Set([...Object.keys(before), ...Object.keys(after)])];
  const value = (v) =>
    v === undefined
      ? "—"
      : typeof v === "object"
        ? JSON.stringify(v)
        : String(v);
  openDialog(
    "Detalle del movimiento",
    `<p class="muted">${e(r.actor)} · ${e(r.accion)} · ${e(r.tabla)} #${e(r.registro_id)}</p><p class="help">${e(new Date(r.fecha).toLocaleString("es-CO", { timeZone: "America/Bogota" }))} · IP ${e(r.ip || "Conexión directa a MySQL")}</p><div class="table-wrap"><table class="changes"><thead><tr><th>Campo</th><th>Antes</th><th>Después</th></tr></thead><tbody>${fields.map((f) => `<tr><td>${e(f)}</td><td class="${JSON.stringify(before[f]) !== JSON.stringify(after[f]) ? "old" : ""}">${e(value(before[f]))}</td><td class="${JSON.stringify(before[f]) !== JSON.stringify(after[f]) ? "new" : ""}">${e(value(after[f]))}</td></tr>`).join("") || '<tr><td colspan="3">Operación sin cambios de valores.</td></tr>'}</tbody></table></div>`,
    null,
  );
}
function renderReports() {
  $("#content").innerHTML =
    heading() +
    `<div class="report-grid"><section class="panel card-pad"><span class="eyebrow">Exportación PDF</span><h3>Selecciona los ciudadanos</h3><p>El reporte incluye la identificación, los nombres y los apellidos de cada registro activo.</p><form id="report-form"><div class="radio-group"><label><input type="radio" name="estado" value="todos" checked>Todos los ciudadanos</label><label><input type="radio" name="estado" value="requeridos">Requeridos</label><label><input type="radio" name="estado" value="no_requeridos">No requeridos</label></div><button class="primary wide">↓ Descargar reporte PDF</button><div class="error" id="report-error" role="alert"></div></form><p class="help">Incluye filtro, fecha, hora y total de registros.</p></section><section class="card-pad"><div class="paper"><h3>Consulta Ciudadano</h3><div class="paper-head">REGISTRADURÍA KONRAD LORENZ</div><h4>Reporte de ciudadanos</h4><p class="help">Vista de estructura del documento</p><div class="paper-row"><b>Identificación</b><b>Nombres</b><b>Apellidos</b></div>${[1, 2, 3, 4, 5].map(() => '<div class="paper-row"><span class="paper-line"></span><span class="paper-line"></span><span class="paper-line"></span></div>').join("")}</div><p class="preview-caption">El archivo se genera con los datos actuales de MySQL.</p></section></div>`;
  $("#report-form").onsubmit = async (event) => {
    event.preventDefault();
    const button = $("#report-form button");
    button.disabled = true;
    $("#report-error").textContent = "";
    try {
      const state = new FormData(event.target).get("estado");
      const blob = await api(`/reportes/ciudadanos.pdf?estado=${state}`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ciudadanos-${state}.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      toast("Reporte generado correctamente.");
    } catch (error) {
      $("#report-error").textContent = error.message;
    } finally {
      button.disabled = false;
    }
  };
}
window.addEventListener("session-expired", () => {
  if (user) {
    renderLogin();
    toast("Tu sesión terminó. Ingresa nuevamente.");
  }
});
try {
  user = await api("/auth/me");
  if (user.perfiles.some((p) => p.codigo === "ADMINISTRADOR")) renderShell();
  else renderLogin();
} catch {
  renderLogin();
}
