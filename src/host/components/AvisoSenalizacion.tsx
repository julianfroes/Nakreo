/** Banner fijo: sin servidor de salas nadie nuevo puede unirse (los ya conectados siguen jugando). */
export function AvisoSenalizacion() {
  return (
    <p
      role="alert"
      className="fixed inset-x-0 top-0 z-40 bg-amber-500 px-4 py-2 text-center font-semibold text-slate-950"
    >
      Se perdió la conexión con el servidor de salas: nadie nuevo puede unirse. Reintentando…
    </p>
  )
}
