/**
 * Galería SOLO PARA DESARROLLO (#/dev?vista=...). Renderiza las pantallas con
 * estados armados con el motor, para revisarlas sin jugar una partida.
 * No se incluye en el build de producción (ver App.tsx).
 *
 *   #/dev?vista=juego&esc=defensa&como=a
 *   #/dev?vista=lobby
 *   #/dev?vista=mesa&esc=defensa
 */
import { Juego } from '../client/components/Juego'
import { CerrarSalaConfirmar, ControlesFin } from '../host/components/ControlesAnfitrion'
import { aplicar } from '../game/engine'
import { proyectarEstado, proyectarPublico } from '../game/proyeccion'
import { crearRng } from '../game/rng'
import { crearPartida } from '../game/setup'
import type { EstadoJuego, Intencion, Rol } from '../game/types'
import { Lobby } from '../host/components/Lobby'
import { Mesa } from '../host/components/Mesa'
import type { SnapshotHost } from '../host/HostServidor'
import { useHashRoute } from '../shared/useHashRoute'

const NOMBRES = ['Ana', 'Beto', 'Carla', 'Diego', 'Elena', 'Fede']
const rng = crearRng(3)

function base(n: number, manos: Record<string, Rol[]> = {}, creditos: Record<string, number> = {}) {
  const e = crearPartida(NOMBRES.slice(0, n).map((nombre, i) => ({ id: 'abcdef'[i], nombre })), crearRng(1))
  let id = 1000
  for (const j of e.jugadores) {
    if (manos[j.id]) j.cartas = manos[j.id].map((rol) => ({ id: id++, rol, revelada: false }))
    if (creditos[j.id] !== undefined) j.creditos = creditos[j.id]
  }
  return e
}

function pasos(e: EstadoJuego, ...is: Intencion[]): EstadoJuego {
  return is.reduce((acc, i) => {
    const r = aplicar(acc, i, rng)
    if (!r.ok) throw new Error(r.error.mensaje)
    return r.estado
  }, e)
}

const MANOS: Record<string, Rol[]> = { a: ['directorFinanciero', 'saboteador'], b: ['jefeSeguridad', 'ingeniero'] }

const ESCENARIOS: Record<string, (n: number) => EstadoJuego> = {
  turno: (n) => base(n, MANOS, { a: 5 }),
  rico: (n) => base(n, MANOS, { a: 15 }),
  espera: (n) => base(n, MANOS),
  desafio: (n) => pasos(base(n, MANOS), { tipo: 'elegirAccion', jugador: 'a', accion: 'dividendos' }),
  bloqueo: (n) =>
    pasos(
      base(n, { ...MANOS, a: ['saboteador', 'ingeniero'] }, { a: 3 }),
      { tipo: 'elegirAccion', jugador: 'a', accion: 'sabotaje', objetivo: 'b' },
      ...['b', 'c', 'd', 'e', 'f'].slice(0, n - 1).map((jugador) => ({ tipo: 'pasar', jugador }) as Intencion),
    ),
  defensa: (n) =>
    pasos(
      base(n, MANOS),
      { tipo: 'elegirAccion', jugador: 'a', accion: 'dividendos' },
      { tipo: 'desafiar', jugador: 'b' },
    ),
  perder: (n) => pasos(base(n, MANOS, { a: 7 }), { tipo: 'elegirAccion', jugador: 'a', accion: 'golpe', objetivo: 'b' }),
  reasignar: (n) =>
    pasos(
      base(n, { ...MANOS, a: ['ingeniero', 'jefeSeguridad'] }),
      { tipo: 'elegirAccion', jugador: 'a', accion: 'reasignacion' },
      ...['b', 'c', 'd', 'e', 'f'].slice(0, n - 1).map((jugador) => ({ tipo: 'pasar', jugador }) as Intencion),
    ),
  eliminado: (n) => {
    const e = base(n, MANOS)
    e.jugadores[0].cartas.forEach((c) => (c.revelada = true))
    e.jugadorActivo = 'b'
    return e
  },
  fin: () => {
    const e = base(2, { b: ['ingeniero', 'ingeniero'] }, { a: 7 })
    e.jugadores[1].cartas[1].revelada = true // a Beto solo le queda una carta
    return pasos(e, { tipo: 'elegirAccion', jugador: 'a', accion: 'golpe', objetivo: 'b' })
  },
  // Mesa con partida avanzada: cartas perdidas y registro largo
  avanzada: (n) => {
    let e = base(n, MANOS, { a: 7 })
    e = pasos(e, { tipo: 'elegirAccion', jugador: 'a', accion: 'golpe', objetivo: 'b' })
    e = pasos(e, { tipo: 'elegirCartaAPerder', jugador: 'b', cartaId: e.jugadores[1].cartas[0].id })
    e = pasos(e, { tipo: 'elegirAccion', jugador: 'b', accion: 'dividendos' }, { tipo: 'desafiar', jugador: 'a' })
    return e
  },
}

function snapshot(e: EstadoJuego | null, n: number): SnapshotHost {
  return {
    codigo: 'K7MQP',
    jugadores: NOMBRES.slice(0, n).map((nombre, i) => ({ id: 'abcdef'[i], nombre, conectado: i !== 2 })),
    iniciada: e !== null,
    mesa: e ? proyectarPublico(e) : null,
    puedeIniciar: e === null && n >= 2,
    senalizacionOk: true,
  }
}

export default function Galeria() {
  const p = useHashRoute().params
  const vista = p.get('vista') ?? 'juego'
  const n = Number(p.get('n') ?? 4)
  const esc = p.get('esc') ?? 'turno'
  const como = p.get('como') ?? 'a'
  const construir = ESCENARIOS[esc] ?? ESCENARIOS.turno
  const e = construir(n)

  if (vista === 'lobby') return <Lobby s={snapshot(null, n)} />
  if (vista === 'mesa') return <Mesa s={snapshot(e, e.jugadores.length)} />
  if (p.get('anfitrion') === '1') {
    return (
      <Juego
        p={proyectarEstado(e, como)}
        modoAnfitrion
        menuAnfitrion={<CerrarSalaConfirmar />}
        controlesFin={<ControlesFin s={snapshot(e, e.jugadores.length)} />}
      />
    )
  }
  return <Juego p={proyectarEstado(e, como)} />
}
