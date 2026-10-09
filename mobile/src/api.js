const base = (process.env.EXPO_PUBLIC_API_URL || "").replace(/\/$/, "");
export async function request(path, { token, body, method = "GET" } = {}) {
  if (!base.startsWith("https://") && !base.startsWith("http://"))
    throw new Error(
      "Configura EXPO_PUBLIC_API_URL con la dirección del servidor (http:// o https://).",
    );
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    path.startsWith("/consulta/") ? 3000 : 12000,
  );
  try {
    const response = await fetch(`${base}${path}`, {
      method,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "X-Requested-With": "ConsultaCiudadano",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await response.json();
    if (!response.ok) {
      const error = new Error(
        data.errors?.map((e) => `${e.field}: ${e.message}`).join(" · ") ||
          data.message ||
          "No fue posible completar la operación.",
      );
      error.status = response.status;
      throw error;
    }
    return data;
  } catch (error) {
    if (error.name === "AbortError")
      throw new Error(
        "La conexión tardó demasiado. Revisa la red e intenta nuevamente.",
      );
    if (error instanceof TypeError)
      throw new Error("No se pudo conectar al servidor. Revisa tu conexión.");
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
