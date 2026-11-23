import type { JugadorSala } from '../protocolo'

/** Estado de un jugador en el lobby: desconectado, conectado o listo (solo es una guía visual). */
export function EstadoJugadorSala({ j }: { j: Pick<JugadorSala, 'conectado' | 'listo'> }) {
  if (!j.conectado) return <span className="text-slate-400">○ desconectado</span>
  if (j.listo) return <span className="text-emerald-400">✓ listo</span>
  return <span className="text-amber-300">● conectado</span>
}

/** «3/6», con aviso «Sala llena» cuando no cabe nadie más. */
export function Aforo({ actual, max }: { actual: number; max: number }) {
  return (
    <span aria-live="polite" aria-label={`${actual} de ${max} jugadores`}>
      {actual}/{max}
      {actual >= max && (
        <span className="ml-2 rounded bg-amber-500 px-2 py-0.5 align-middle text-sm font-bold text-slate-950">
          Sala llena
        </span>
      )}
    </span>
  )
}
