export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  if (error.name === "ZodError")
    return res
      .status(400)
      .json({
        message: "Revisa los campos del formulario.",
        errors: error.issues.map((i) => ({
          field: i.path.join("."),
          message: i.message,
        })),
      });
  if (error.name === "SequelizeUniqueConstraintError")
    return res
      .status(409)
      .json({
        message: "Ya existe un registro con esa identificación o código.",
      });
  if (error.name === "SequelizeForeignKeyConstraintError")
    return res
      .status(409)
      .json({ message: "El registro está asociado a otros datos." });
  const status = error.status || 500;
  if (status >= 500)
    console.error(
      JSON.stringify({
        solicitud: req.requestId,
        error: error.name,
        message: status === 500 ? "Error interno" : error.message,
      }),
    );
  res
    .status(status)
    .json({
      message:
        status === 500
          ? "No fue posible completar la operación."
          : error.message,
      solicitud: req.requestId,
    });
}
