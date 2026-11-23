import { IconoRol } from '../../shared/iconos/IconoRol'
import { uiCarta } from '../../shared/rolesUI'
import type { Descarte as DatosDescarte } from '../descarte'

const ESTADO: Record<string, { texto: string; clases: string }> = {
  eliminado: { texto: 'Eliminado', clases: 'bg-rose-900/70 text-rose-100' },
  retirado: { texto: 'Retirado', clases: 'bg-slate-700 text-slate-100' },
}

/** Las cartas perdidas de todos los jugadores, agrupadas por jugador, con su rol a la vista. */
export function ListaDescarte({ descarte, yo }: { descarte: DatosDescarte; yo: string }) {
  if (descarte.total === 0) {
    return <p className="text-sm text-slate-300">Todavía no se ha perdido ninguna carta.</p>
  }
  return (
    <ul className="space-y-3">
      {descarte.grupos.map((g) => {
        const estado = ESTADO[g.jugador.estado]
        return (
          <li key={g.jugador.id}>
            <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
              <span>
                {g.jugador.nombre}
                {g.jugador.id === yo && <span className="text-cyan-300"> (tú)</span>}
              </span>
              {estado && (
                <span className={`rounded px-1.5 py-0.5 text-xs font-bold uppercase ${estado.clases}`}>
                  {estado.texto}
                </span>
              )}
            </p>
            <ul className="mt-1 flex flex-wrap gap-2">
              {g.cartas.map((c, i) => {
                const ui = uiCarta(c.rol, c.especial)
                return (
                  <li key={i} className={`inline-flex items-center gap-1.5 rounded-lg border-2 px-2 py-1 text-sm ${ui.borde}`}>
                    <IconoRol rol={c.rol} especial={c.especial} tamano={24} decorativo /> {ui.nombre}
                  </li>
                )
              })}
            </ul>
          </li>
        )
      })}
    </ul>
  )
}
