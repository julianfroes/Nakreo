import type { EstadoProyectado } from '../../game/proyeccion'
import { nombreDe } from '../vista'
import { textoEvento } from '../../shared/textos'

/** Cabecera fija: mis créditos, de quién es el turno, rivales y último evento. */
export function BarraEstado({ p }: { p: EstadoProyectado }) {
  const miTurno = p.jugadorActivo === p.yo.id && p.fase.tipo !== 'fin'
  const nombre = (id: string) => nombreDe(p, id)
  const ultimo = p.registro[p.registro.length - 1]

  return (
    <header className="sticky top-0 z-10 border-b border-slate-800 bg-slate-950/95 px-4 pb-2 pt-3 backdrop-blur">
      <div
        className={`flex items-center justify-between rounded-xl px-4 py-2 ${
          miTurno ? 'animate-latido bg-cyan-500 text-slate-950' : 'bg-slate-800'
        }`}
      >
        <span className="font-bold">{miTurno ? '¡Tu turno!' : `Turno de ${nombre(p.jugadorActivo)}`}</span>
        <span className="text-xl font-bold" aria-label={`${p.yo.creditos} créditos`}>
          ◈ {p.yo.creditos}
        </span>
      </div>

      <ul className="mt-2 flex gap-2 overflow-x-auto pb-1 text-xs">
        {p.jugadores
          .filter((j) => j.id !== p.yo.id)
          .map((j) => (
            <li
              key={j.id}
              className={`shrink-0 rounded-lg border px-2 py-1 ${
                j.eliminado ? 'border-slate-800 text-slate-600 line-through' : 'border-slate-700'
              } ${j.id === p.jugadorActivo ? 'border-cyan-500' : ''}`}
            >
              <span className="font-semibold">{j.nombre}</span> ◈{j.creditos} 🂠{j.cartasVivas}
            </li>
          ))}
        <li className="shrink-0 rounded-lg border border-slate-800 px-2 py-1 text-slate-500">
          Mazo {p.mazoRestante}
        </li>
      </ul>

      {ultimo && <p className="mt-1 truncate text-xs text-slate-400">{textoEvento(ultimo, nombre)}</p>}
    </header>
  )
}
