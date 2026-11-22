import { CARTAS_POR_JUGADOR } from '../../game/config'
import type { EstadoProyectado } from '../../game/proyeccion'
import type { Rol } from '../../game/types'
import { ROL_UI } from '../../shared/rolesUI'
import { textoEvento } from '../../shared/textos'
import { nombreDe } from '../vista'

/** Vidas = cartas que le quedan. Corazón lleno = carta viva, vacío = carta perdida. */
function Vidas({ vivas, perdidas }: { vivas: number; perdidas: Rol[] }) {
  return (
    <span className="inline-flex items-center gap-1" aria-label={`${vivas} de ${CARTAS_POR_JUGADOR} vidas`}>
      {Array.from({ length: CARTAS_POR_JUGADOR }, (_, i) => (
        <span key={i} aria-hidden className={i < vivas ? 'text-rose-400' : 'text-slate-600'}>
          {i < vivas ? '♥' : '♡'}
        </span>
      ))}
      {perdidas.map((rol, i) => (
        <span key={i} className="text-xs opacity-60" title={`Perdió: ${ROL_UI[rol].nombre}`}>
          {ROL_UI[rol].icono}
        </span>
      ))}
    </span>
  )
}

/** Cabecera fija: mis monedas y vidas, de quién es el turno, rivales y último evento. */
export function BarraEstado({ p }: { p: EstadoProyectado }) {
  const miTurno = p.jugadorActivo === p.yo.id && p.fase.tipo !== 'fin'
  const nombre = (id: string) => nombreDe(p, id)
  const ultimo = p.registro[p.registro.length - 1]
  const yo = p.jugadores.find((j) => j.id === p.yo.id)

  return (
    <header className="sticky top-0 z-10 border-b border-slate-800 bg-slate-950/95 px-4 pb-2 pt-3 backdrop-blur">
      <div
        className={`flex items-center justify-between gap-3 rounded-xl px-4 py-2 ${
          miTurno ? 'animate-latido bg-cyan-500 text-slate-950' : 'bg-slate-800'
        }`}
      >
        <span className="font-bold">{miTurno ? '¡Tu turno!' : `Turno de ${nombre(p.jugadorActivo)}`}</span>
        <span className="flex items-center gap-3 text-xl font-bold">
          <span aria-label={`${p.yo.creditos} monedas`}>◈ {p.yo.creditos}</span>
          {yo && <Vidas vivas={yo.cartasVivas} perdidas={yo.cartasReveladas} />}
        </span>
      </div>

      <ul className="mt-2 flex gap-2 overflow-x-auto pb-1">
        {p.jugadores
          .filter((j) => j.id !== p.yo.id)
          .map((j) => (
            <li
              key={j.id}
              className={`flex min-w-28 shrink-0 flex-col gap-0.5 rounded-lg border px-3 py-1.5 ${
                j.eliminado ? 'border-slate-800 text-slate-600' : 'border-slate-700'
              } ${j.id === p.jugadorActivo && !j.eliminado ? 'border-cyan-400 bg-cyan-950/40' : ''}`}
            >
              <span className={`truncate text-sm font-semibold ${j.eliminado ? 'line-through' : ''}`}>
                {j.nombre}
              </span>
              {j.eliminado ? (
                <span className="text-xs">Eliminado</span>
              ) : (
                <span className="flex items-center justify-between gap-2 text-base font-bold">
                  <span className="text-amber-300" aria-label={`${j.creditos} monedas`}>◈ {j.creditos}</span>
                  <Vidas vivas={j.cartasVivas} perdidas={j.cartasReveladas} />
                </span>
              )}
            </li>
          ))}
        <li className="flex min-w-16 shrink-0 flex-col justify-center rounded-lg border border-slate-800 px-3 py-1.5 text-center text-xs text-slate-500">
          Mazo
          <span className="text-base font-bold">{p.mazoRestante}</span>
        </li>
      </ul>

      {ultimo && <p className="mt-1 truncate text-xs text-slate-400">{textoEvento(ultimo, nombre)}</p>}
    </header>
  )
}
