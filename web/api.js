export async function api(path, options = {}) {
  const response = await fetch(`/api${path}`, {
    credentials: "same-origin",
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-Requested-With": "ConsultaCiudadano",
      ...options.headers,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (!response.ok) {
    const result = await response
      .json()
      .catch(() => ({
        message: "No fue posible comunicarse con el servidor.",
      }));
    if (response.status === 401 && !path.includes("/auth/login"))
      window.dispatchEvent(new Event("session-expired"));
    throw new Error(
      result.errors?.map((e) => `${e.field}: ${e.message}`).join(" · ") ||
        result.message,
    );
  }
  return response.headers.get("content-type")?.includes("application/pdf")
    ? response.blob()
    : response.json();
}
export const escapeHtml = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );
