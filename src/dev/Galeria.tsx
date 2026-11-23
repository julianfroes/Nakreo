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
import { ListaDescarte } from '../client/components/Descarte'
import { calcularDescarte } from '../client/descarte'
import { PanelReglas } from '../shared/components/PanelReglas'
import { IconoRol } from '../shared/iconos/IconoRol'
import { TODOS_LOS_ROLES } from '../game/roles'
import { uiCarta } from '../shared/rolesUI'
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

/** El objetivo de una Demanda laboral la deja pasar: sin bloqueo (Contrademanda) ni «explotar el site». */
const demandaSinReaccion = (objetivo: string): Intencion[] => [{ tipo: 'pasar', jugador: objetivo }]

function pasos(e: EstadoJuego, ...is: Intencion[]): EstadoJuego {
  return is.reduce((acc, i) => {
    const r = aplicar(acc, i, rng)
    if (!r.ok) throw new Error(r.error.mensaje)
    return r.estado
  }, e)
}

const MANOS: Record<string, Rol[]> = { a: ['rh', 'ceo'], b: ['sindicalizado', 'ingeniero'] }

const ESCENARIOS: Record<string, (n: number) => EstadoJuego> = {
  turno: (n) => base(n, MANOS, { a: 5 }),
  rico: (n) => base(n, MANOS, { a: 15 }),
  espera: (n) => base(n, MANOS),
  desafio: (n) => pasos(base(n, MANOS), { tipo: 'elegirAccion', jugador: 'a', accion: 'malversacion' }),
  bloqueo: (n) =>
    pasos(
      base(n, { ...MANOS, a: ['ceo', 'ingeniero'] }, { a: 3 }),
      { tipo: 'elegirAccion', jugador: 'a', accion: 'despido', objetivo: 'b' },
      ...['b', 'c', 'd', 'e', 'f'].slice(0, n - 1).map((jugador) => ({ tipo: 'pasar', jugador }) as Intencion),
    ),
  // El objetivo de un Despido ve a la vez «Alegar Sindicalizado» y «Explotar el site».
  ataque: (n) =>
    pasos(
      base(n, { a: ['ceo', 'rh'], b: ['ingeniero', 'jefeArea'] }, { a: 3, b: 5 }),
      { tipo: 'elegirAccion', jugador: 'a', accion: 'despido', objetivo: 'b' },
      ...['b', 'c', 'd', 'e', 'f'].slice(0, n - 1).map((jugador) => ({ tipo: 'pasar', jugador }) as Intencion),
    ),
  defensa: (n) =>
    pasos(
      base(n, MANOS),
      { tipo: 'elegirAccion', jugador: 'a', accion: 'malversacion' },
      { tipo: 'desafiar', jugador: 'b' },
    ),
  perder: (n) =>
    pasos(
      base(n, MANOS, { a: 7 }),
      { tipo: 'elegirAccion', jugador: 'a', accion: 'demandaLaboral', objetivo: 'b' },
      ...demandaSinReaccion('b'),
    ),
  reasignar: (n) =>
    pasos(
      base(n, { ...MANOS, a: ['ingeniero', 'sindicalizado'] }),
      { tipo: 'elegirAccion', jugador: 'a', accion: 'reasignacion' },
      ...['b', 'c', 'd', 'e', 'f'].slice(0, n - 1).map((jugador) => ({ tipo: 'pasar', jugador }) as Intencion),
    ),
  eliminado: (n) => {
    const e = base(n, MANOS)
    e.jugadores[0].cartas.forEach((c) => (c.revelada = true))
    e.jugadorActivo = 'b'
    return e
  },
  // Alguien abandonó la partida: se ve en la mesa («RETIRADO») y es su propia pantalla de despedida.
  retirado: (n) => pasos(base(n, MANOS), { tipo: 'salir', jugador: 'b' }),
  fin: () => {
    const e = base(2, { b: ['ingeniero', 'ingeniero'] }, { a: 7 })
    e.jugadores[1].cartas[1].revelada = true // a Beto solo le queda una carta
    return pasos(
      e,
      { tipo: 'elegirAccion', jugador: 'a', accion: 'demandaLaboral', objetivo: 'b' },
      ...demandaSinReaccion('b'),
    )
  },
  // Mesa con partida avanzada: cartas perdidas y registro largo
  avanzada: (n) => {
    let e = base(n, MANOS, { a: 7 })
    e = pasos(e, { tipo: 'elegirAccion', jugador: 'a', accion: 'demandaLaboral', objetivo: 'b' }, ...demandaSinReaccion('b'))
    e = pasos(e, { tipo: 'elegirCartaAPerder', jugador: 'b', cartaId: e.jugadores[1].cartas[0].id })
    e = pasos(e, { tipo: 'elegirAccion', jugador: 'b', accion: 'malversacion' }, { tipo: 'desafiar', jugador: 'a' })
    return e
  },
}

/** `sin`: modo sin roles especiales (aforo 6). `yo`: el anfitrión ocupa el asiento «a». */
function snapshot(e: EstadoJuego | null, n: number, sin = false, yo = false): SnapshotHost {
  return {
    codigo: 'K7MQP',
    jugadores: NOMBRES.slice(0, n).map((nombre, i) => ({
      id: 'abcdefgh'[i], nombre, conectado: i !== 2, listo: i === 0 || i === 3,
    })),
    iniciada: e !== null,
    mesa: e ? proyectarPublico(e) : null,
    puedeIniciar: e === null && n >= 2,
    motivoBloqueo: null,
    especiales: !sin,
    max: sin ? 6 : 8,
    asientoLocal: yo ? 'a' : null,
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

  // Paneles de Reglas / Guía rápida: `modo` (guia|reglas), `sin=1` (sin roles especiales),
  // `libre=1` (como en la pantalla principal, con selector de modo) y `pestana`.
  if (vista === 'panel') {
    return (
      <PanelReglas
        abierto
        onCerrar={() => {}}
        modo={p.get('modo') === 'reglas' ? 'reglas' : 'guia'}
        especiales={p.get('libre') === '1' ? undefined : p.get('sin') !== '1'}
        pestana={(p.get('pestana') as 'reglas' | 'acciones' | 'roles' | null) ?? undefined}
      />
    )
  }
  // Los iconos de los roles a distintos tamaños, sobre el fondo de su carta, normales y especiales.
  if (vista === 'iconos') {
    const tamanos = [24, 32, 48, 64]
    return (
      <main className="mx-auto max-w-3xl space-y-4 p-4">
        <h1 className="text-xl font-bold">Iconos de los roles</h1>
        {[false, true].map((especial) => (
          <section key={String(especial)} className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-400">
              {especial ? 'Carta especial' : 'Carta normal'}
            </h2>
            <div className="grid gap-2">
              {TODOS_LOS_ROLES.map((rol) => {
                const ui = uiCarta(rol, especial)
                return (
                  <div
                    key={rol}
                    className={`flex items-center gap-4 rounded-2xl border-2 bg-gradient-to-b px-4 py-3 ${ui.borde} ${ui.fondo}`}
                  >
                    <span className="w-44 font-bold">{ui.nombre}</span>
                    {tamanos.map((t) => (
                      <IconoRol key={t} rol={rol} especial={especial} tamano={t} decorativo />
                    ))}
                  </div>
                )
              })}
            </div>
          </section>
        ))}
      </main>
    )
  }
  if (vista === 'descarte') {
    return (
      <main className="mx-auto max-w-md space-y-3 p-4">
        <h1 className="text-xl font-bold">Descarte</h1>
        <ListaDescarte descarte={calcularDescarte(proyectarEstado(e, como))} yo={como} />
      </main>
    )
  }
  if (vista === 'lobby') return <Lobby s={snapshot(null, n, p.get('sin') === '1', p.get('yo') === '1')} />
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
