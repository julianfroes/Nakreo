import { CARTAS_POR_JUGADOR } from '../../game/config'
import type { CartaPerdida, EstadoProyectado } from '../../game/proyeccion'
import { IconoRol } from '../../shared/iconos/IconoRol'
import { uiCarta } from '../../shared/rolesUI'
import { textoEvento } from '../../shared/textos'
import { nombreDe } from '../vista'

/** Vidas = cartas que le quedan. Corazón lleno = carta viva, vacío = carta perdida. */
function Vidas({ vivas, perdidas }: { vivas: number; perdidas: CartaPerdida[] }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1" aria-label={`${vivas} de ${CARTAS_POR_JUGADOR} vidas`}>
      {Array.from({ length: CARTAS_POR_JUGADOR }, (_, i) => (
        <span key={i} aria-hidden className={i < vivas ? 'text-rose-400' : 'text-slate-600'}>
          {i < vivas ? '♥' : '♡'}
        </span>
      ))}
      {perdidas.map((c, i) => (
        <span
          key={i}
          role="img"
          aria-label={`Perdió: ${uiCarta(c.rol, c.especial).nombre}`}
          title={`Perdió: ${uiCarta(c.rol, c.especial).nombre}`}
          className="opacity-70"
        >
          <IconoRol rol={c.rol} especial={c.especial} tamano={24} decorativo />
        </span>
      ))}
    </span>
  )
}

/**
 * Cabecera del jugador: mis monedas y vidas, de quién es el turno, los rivales y el último evento.
 *  - Móvil: barra fija arriba, con los rivales en una tira con scroll.
 *  - Ordenador: bloque del panel izquierdo, con los rivales como tarjetas en rejilla.
 * Cada rival es una tarjeta con identidad estable (`data-jugador`), pensada para animarla
 * cuando cambia el turno, desafía, pasa o pierde una vida.
 */
export function BarraEstado({ p }: { p: EstadoProyectado }) {
  const miTurno = p.jugadorActivo === p.yo.id && p.fase.tipo !== 'fin'
  const nombre = (id: string) => nombreDe(p, id)
  const ultimo = p.registro[p.registro.length - 1]
  const yo = p.jugadores.find((j) => j.id === p.yo.id)

  return (
    <header className="sticky top-0 z-10 border-b border-slate-800 bg-slate-950/95 px-4 pb-2 pt-3 backdrop-blur lg:static lg:rounded-3xl lg:border lg:border-slate-700 lg:bg-slate-900/70 lg:p-5">
      <div
        className={`flex items-center justify-between gap-3 rounded-xl px-4 py-2 lg:rounded-2xl lg:px-6 lg:py-4 ${
          miTurno ? 'animate-latido bg-cyan-500 text-slate-950' : 'bg-slate-800'
        }`}
      >
        <span className="font-bold lg:text-xl">{miTurno ? '¡Tu turno!' : `Turno de ${nombre(p.jugadorActivo)}`}</span>
        <span className="flex items-center gap-3 text-xl font-bold lg:text-2xl">
          <span aria-label={`${p.yo.creditos} monedas`}>◈ {p.yo.creditos}</span>
          {yo && <Vidas vivas={yo.cartasVivas} perdidas={yo.cartasReveladas} />}
        </span>
      </div>

      <ul
        aria-label="Rivales"
        className="mt-2 flex gap-2 overflow-x-auto pb-1 lg:mt-4 lg:grid lg:grid-cols-2 lg:gap-3 lg:overflow-visible lg:pb-0 xl:grid-cols-3"
      >
        {p.jugadores
          .filter((j) => j.id !== p.yo.id)
          .map((j) => (
            <li
              key={j.id}
              data-jugador={j.id}
              className={`flex min-w-28 shrink-0 flex-col gap-0.5 rounded-lg border px-3 py-1.5 lg:min-w-0 lg:gap-1.5 lg:rounded-2xl lg:px-4 lg:py-3 ${
                j.eliminado ? 'border-slate-800 text-slate-600' : 'border-slate-700'
              } ${j.id === p.jugadorActivo && !j.eliminado ? 'border-cyan-400 bg-cyan-950/40' : ''}`}
            >
              <span className="flex items-center justify-between gap-2">
                <span className={`truncate text-sm font-semibold lg:text-lg ${j.eliminado ? 'line-through' : ''}`}>
                  {j.nombre}
                </span>
                {j.id === p.jugadorActivo && !j.eliminado && (
                  <span className="hidden rounded bg-cyan-500 px-1.5 py-0.5 text-xs font-bold text-slate-950 lg:inline">
                    TURNO
                  </span>
                )}
              </span>
              {j.eliminado ? (
                <span className="text-xs lg:text-sm">{j.retirado ? 'Retirado' : 'Eliminado'}</span>
              ) : (
                <span className="flex items-center justify-between gap-2 text-base font-bold lg:text-xl">
                  <span className="text-amber-300" aria-label={`${j.creditos} monedas`}>◈ {j.creditos}</span>
                  <Vidas vivas={j.cartasVivas} perdidas={j.cartasReveladas} />
                </span>
              )}
            </li>
          ))}
        <li className="flex min-w-16 shrink-0 flex-col justify-center rounded-lg border border-slate-800 px-3 py-1.5 text-center text-xs text-slate-500 lg:min-w-0 lg:rounded-2xl lg:py-3 lg:text-sm">
          Mazo
          <span className="text-base font-bold lg:text-xl">{p.mazoRestante}</span>
        </li>
      </ul>

      {/* En ordenador el registro del panel derecho ya muestra lo último que pasó. */}
      {ultimo && <p className="mt-1 truncate text-xs text-slate-400 lg:hidden">{textoEvento(ultimo, nombre)}</p>}
    </header>
  )
}
