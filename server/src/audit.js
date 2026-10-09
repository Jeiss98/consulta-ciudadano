import { db, Audit } from "./models.js";
/** Los triggers guardan cambios incluso si se ejecuta SQL fuera de la aplicación. */
export async function audited(req, work) {
  return db.transaction(async (transaction) => {
    await db.query("SET @audit_actor = ?, @audit_ip = ?, @audit_request = ?", {
      replacements: [
        req.user?.identificacion || "REGISTRO",
        req.ip || null,
        req.requestId || null,
      ],
      transaction,
    });
    try {
      return await work(transaction);
    } finally {
      // Las variables son de conexión: siempre limpiarlas antes de devolverla al pool.
      await db.query(
        "SET @audit_actor = NULL, @audit_ip = NULL, @audit_request = NULL",
        { transaction },
      );
    }
  });
}
export async function event(
  req,
  accion,
  tabla,
  registroId,
  despues = null,
  transaction,
) {
  return Audit.create(
    {
      actor: req.user?.identificacion || "ANONIMO",
      accion,
      tabla,
      registro_id: String(registroId),
      despues,
      ip: req.ip,
      solicitud_id: req.requestId,
      fecha: new Date(),
    },
    { transaction },
  );
}
