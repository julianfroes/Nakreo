import { describe, expect, it } from 'vitest'
import { aplicar } from './engine'
import { crearRng } from './rng'
import { crearPartida } from './setup'
import type { EstadoJuego, EventoJuego, Intencion, Jugador, Rol } from './types'

/** Salir de la partida: qué pasa en cada fase según el papel del jugador que se va. */

const rng = crearRng(42)

const ids = (n: number) =>
  Array.from({ length: n }, (_, k) => ({ id: 'abcdefgh'[k], nombre: `J${k}` }))

type CartaDef = Rol | `${Rol}*`

function escenario(
  n: number,
  manos: Record<string, CartaDef[]> = {},
  creditos: Record<string, number> = {},
): EstadoJuego {
  const e = crearPartida(ids(n), crearRng(1))
  let nextId = 1000
  for (const jug of e.jugadores) {
    if (manos[jug.id]) {
      jug.cartas = manos[jug.id].map((def) => {
        const especial = def.endsWith('*')
        const rol = (especial ? def.slice(0, -1) : def) as Rol
        return especial
          ? { id: nextId++, rol, especial: true, revelada: false }
          : { id: nextId++, rol, revelada: false }
      })
    }
    if (creditos[jug.id] !== undefined) jug.creditos = creditos[jug.id]
  }
  return e
}

function paso(e: EstadoJuego, i: Intencion): EstadoJuego {
  const r = aplicar(e, i, rng)
  if (!r.ok) throw new Error(`Intención ilegal: ${r.error.codigo} - ${r.error.mensaje}`)
  return r.estado
}

const sale = (e: EstadoJuego, jugador: string) => paso(e, { tipo: 'salir', jugador })

const j = (e: EstadoJuego, id: string): Jugador => e.jugadores.find((x) => x.id === id)!
const carta = (e: EstadoJuego, id: string, k: number) => j(e, id).cartas[k].id
const vivas = (e: EstadoJuego, id: string) => j(e, id).cartas.filter((c) => !c.revelada).length
const idsTotales = (e: EstadoJuego) =>
  [...e.mazo, ...e.jugadores.flatMap((x) => x.cartas)].map((c) => c.id).sort((x, y) => x - y)
const hubo = (e: EstadoJuego, tipo: EventoJuego['tipo']) => e.registro.some((ev) => ev.tipo === tipo)

describe('salir: lo básico', () => {
  it('revela sus cartas al descarte público, queda retirado y sin créditos', () => {
    let e = escenario(3, { a: ['rh', 'ceo*'] }, { a: 5 })
    const r = aplicar(e, { tipo: 'salir', jugador: 'a' }, rng)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    e = r.estado
    expect(j(e, 'a')).toMatchObject({ retirado: true, eliminado: true, creditos: 0 })
    expect(j(e, 'a').cartas.every((c) => c.revelada)).toBe(true)
    // Las dos cartas quedan a la vista (descarte) y el log lo dice.
    expect(r.eventos.filter((ev) => ev.tipo === 'cartaPerdida')).toEqual([
      { tipo: 'cartaPerdida', jugador: 'a', rol: 'rh', especial: false },
      { tipo: 'cartaPerdida', jugador: 'a', rol: 'ceo', especial: true },
    ])
    expect(r.eventos).toContainEqual({ tipo: 'jugadorRetirado', jugador: 'a' })
    expect(r.eventos.some((ev) => ev.tipo === 'jugadorEliminado')).toBe(false) // no es una eliminación
  })

  it('en su turno: el turno pasa al siguiente jugador vivo', () => {
    let e = escenario(3)
    e = sale(e, 'a')
    expect(e.fase.tipo).toBe('accion')
    expect(e.jugadorActivo).toBe('b')
  })

  it('con dos jugadores, el otro gana al instante', () => {
    const e = sale(escenario(2), 'a')
    expect(e.fase).toEqual({ tipo: 'fin', ganador: 'b' })
    expect(e.registro.some((ev) => ev.tipo === 'partidaTerminada' && ev.ganador === 'b')).toBe(true)
  })

  it('fuera de su turno y sin nada pendiente: solo se retira, el turno no cambia', () => {
    let e = escenario(4)
    e = sale(e, 'c')
    expect(e.jugadorActivo).toBe('a')
    expect(e.fase.tipo).toBe('accion')
    // La rotación se salta al retirado.
    e = paso(e, { tipo: 'elegirAccion', jugador: 'a', accion: 'sueldoMinimo' })
    e = paso(e, { tipo: 'elegirAccion', jugador: 'b', accion: 'sueldoMinimo' })
    expect(e.jugadorActivo).toBe('d')
  })

  it('un retirado ya no puede actuar ni volver a salir', () => {
    let e = escenario(3)
    e = sale(e, 'c')
    expect(aplicar(e, { tipo: 'pasar', jugador: 'c' }).ok).toBe(false)
    expect(aplicar(e, { tipo: 'salir', jugador: 'c' }).ok).toBe(false)
  })

  it('no se puede salir de una partida terminada', () => {
    const e = sale(escenario(2), 'a')
    const r = aplicar(e, { tipo: 'salir', jugador: 'b' })
    expect(r.ok).toBe(false)
  })

  it('no se pierde ni se duplica ninguna carta', () => {
    const e = escenario(4)
    const antes = idsTotales(e)
    expect(idsTotales(sale(e, 'b'))).toEqual(antes)
  })
})

describe('salir: ventanas de desafío y bloqueo', () => {
  it('un jugador al que se le preguntaba si desafía deja de contar; si era el último, la acción sigue', () => {
    let e = escenario(3, { a: ['rh', 'ceo'] })
    e = paso(e, { tipo: 'elegirAccion', jugador: 'a', accion: 'malversacion' })
    e = paso(e, { tipo: 'pasar', jugador: 'b' })
    e = sale(e, 'c') // era el único pendiente: la ventana se cierra como si hubiera pasado
    expect(j(e, 'a').creditos).toBe(5) // 2 + 3
    expect(e.jugadorActivo).toBe('b')
  })

  it('si quedan otros pendientes, la ventana sigue abierta sin él', () => {
    let e = escenario(4, { a: ['rh', 'ceo'] })
    e = paso(e, { tipo: 'elegirAccion', jugador: 'a', accion: 'malversacion' })
    e = sale(e, 'd')
    expect(e.fase).toMatchObject({ tipo: 'ventanaDesafioAccion', pendientes: ['b', 'c'] })
  })

  it('si se va quien hizo la acción, se cancela sin devolver créditos y el turno continúa', () => {
    let e = escenario(3, { a: ['ceo', 'rh'] }, { a: 3 })
    e = paso(e, { tipo: 'elegirAccion', jugador: 'a', accion: 'despido', objetivo: 'b' })
    e = sale(e, 'a')
    expect(hubo(e, 'accionCancelada')).toBe(true)
    expect(j(e, 'a').creditos).toBe(0)
    expect(vivas(e, 'b')).toBe(2)
    expect(e.jugadorActivo).toBe('b')
    expect(e.fase.tipo).toBe('accion')
  })

  it('si se va el objetivo, la acción se desvanece y el atacante no recupera sus créditos', () => {
    let e = escenario(3, { a: ['ceo', 'rh'] }, { a: 3 })
    e = paso(e, { tipo: 'elegirAccion', jugador: 'a', accion: 'despido', objetivo: 'b' })
    e = sale(e, 'b')
    expect(hubo(e, 'accionCancelada')).toBe(true)
    expect(j(e, 'a').creditos).toBe(0)
    expect(e.jugadorActivo).toBe('c') // b ya no está en la rotación
  })

  it('ventana de bloqueo abierta a todos (Nómina): el que se va deja de contar', () => {
    let e = escenario(4)
    e = paso(e, { tipo: 'elegirAccion', jugador: 'a', accion: 'nomina' })
    e = sale(e, 'd')
    e = sale(e, 'c')
    expect(e.fase).toMatchObject({ tipo: 'ventanaBloqueo', pendientes: ['b'] })
    e = paso(e, { tipo: 'pasar', jugador: 'b' })
    expect(j(e, 'a').creditos).toBe(4) // la Nómina se cobra
  })

  it('un bloqueador que no es el objetivo se va: el bloqueo cae y la acción procede', () => {
    let e = escenario(3)
    e = paso(e, { tipo: 'elegirAccion', jugador: 'a', accion: 'nomina' })
    e = paso(e, { tipo: 'bloquear', jugador: 'c', rol: 'rh' })
    expect(e.fase.tipo).toBe('ventanaDesafioBloqueo')
    e = sale(e, 'c')
    expect(j(e, 'a').creditos).toBe(4)
    expect(e.jugadorActivo).toBe('b')
  })

  it('el objetivo que bloqueaba se va: la acción se desvanece (sin reembolso)', () => {
    let e = escenario(3, { a: ['ceo', 'rh'] }, { a: 3 })
    e = paso(e, { tipo: 'elegirAccion', jugador: 'a', accion: 'despido', objetivo: 'b' })
    e = paso(e, { tipo: 'pasar', jugador: 'b' })
    e = paso(e, { tipo: 'pasar', jugador: 'c' })
    e = paso(e, { tipo: 'bloquear', jugador: 'b', rol: 'sindicalizado' })
    e = sale(e, 'b')
    expect(vivas(e, 'a')).toBe(2)
    expect(j(e, 'a').creditos).toBe(0)
    expect(e.jugadorActivo).toBe('c')
  })

  it('se va el actor mientras se discute su bloqueo: la acción se cancela', () => {
    let e = escenario(3, { a: ['ceo', 'rh'] }, { a: 3 })
    e = paso(e, { tipo: 'elegirAccion', jugador: 'a', accion: 'despido', objetivo: 'b' })
    e = paso(e, { tipo: 'pasar', jugador: 'b' })
    e = paso(e, { tipo: 'pasar', jugador: 'c' })
    e = paso(e, { tipo: 'bloquear', jugador: 'b', rol: 'sindicalizado' })
    e = sale(e, 'a')
    expect(hubo(e, 'accionCancelada')).toBe(true)
    expect(e.jugadorActivo).toBe('b')
    expect(vivas(e, 'b')).toBe(2)
  })
})

describe('salir: habilidades especiales', () => {
  /** a pone una Demanda a b, que decide a la vez si se cubre o «explota el site». */
  function demandaHastaExplosion() {
    let e = escenario(3, { b: ['ingeniero*', 'ceo'] }, { a: 7, b: 5 })
    e = paso(e, { tipo: 'elegirAccion', jugador: 'a', accion: 'demandaLaboral', objetivo: 'b' })
    expect(e.fase).toMatchObject({ tipo: 'ventanaBloqueo', explosion: true })
    return e
  }

  /** a despide a b, b alega Sindicalizado sin tenerlo, lo descubren y le queda la segunda oportunidad de explotar. */
  function despidoHastaSegundaOportunidad() {
    let e = escenario(3, { a: ['ceo', 'rh'], b: ['ceo', 'ingeniero*'] }, { a: 3, b: 5 })
    e = paso(e, { tipo: 'elegirAccion', jugador: 'a', accion: 'despido', objetivo: 'b' })
    e = paso(e, { tipo: 'pasar', jugador: 'b' })
    e = paso(e, { tipo: 'pasar', jugador: 'c' })
    e = paso(e, { tipo: 'bloquear', jugador: 'b', rol: 'sindicalizado' })
    e = paso(e, { tipo: 'desafiar', jugador: 'a' })
    e = paso(e, { tipo: 'revelarCarta', jugador: 'b', cartaId: carta(e, 'b', 0) }) // un CEO: no es Sindicalizado
    expect(e.fase.tipo).toBe('ventanaIngeniero')
    return e
  }

  it('segunda oportunidad: si se va el objetivo cuyo bloqueo cayó, el despido se desvanece', () => {
    const e = sale(despidoHastaSegundaOportunidad(), 'b')
    expect(hubo(e, 'accionCancelada')).toBe(true)
    expect(e.jugadorActivo).toBe('c')
  })

  it('segunda oportunidad: si se va el atacante, el despido se cancela', () => {
    const e = sale(despidoHastaSegundaOportunidad(), 'a')
    expect(hubo(e, 'accionCancelada')).toBe(true)
    expect(vivas(e, 'b')).toBe(1)
    expect(e.jugadorActivo).toBe('b')
  })

  it('se va el objetivo mientras decide si explota el site: la demanda se desvanece', () => {
    const e = sale(demandaHastaExplosion(), 'b')
    expect(hubo(e, 'accionCancelada')).toBe(true)
    expect(j(e, 'a').creditos).toBe(0)
    expect(e.jugadorActivo).toBe('c')
  })

  it('se va el atacante mientras el objetivo decide: la demanda se cancela', () => {
    const e = sale(demandaHastaExplosion(), 'a')
    expect(hubo(e, 'accionCancelada')).toBe(true)
    expect(vivas(e, 'b')).toBe(2)
    expect(e.jugadorActivo).toBe('b')
  })

  it('se va quien explotaba el site tras declararlo: la acción se desvanece', () => {
    let e = demandaHastaExplosion()
    e = paso(e, { tipo: 'explotarSite', jugador: 'b' })
    expect(e.fase.tipo).toBe('ventanaDesafioReaccion')
    e = sale(e, 'b')
    expect(hubo(e, 'accionCancelada')).toBe(true)
    expect(vivas(e, 'a')).toBe(2) // la explosión no llegó a ocurrir
  })

  it('si el último que debía desafiar la explosión se va, la explosión procede', () => {
    let e = demandaHastaExplosion()
    e = paso(e, { tipo: 'explotarSite', jugador: 'b' })
    e = paso(e, { tipo: 'pasar', jugador: 'a' })
    e = sale(e, 'c')
    expect(e.fase).toMatchObject({ tipo: 'perdiendoCarta', jugador: 'a' }) // el atacante paga primero
  })

  it('«Excusa de mérito» (Jefe de Área Especial): si se va quien se salvaba, su farol cae', () => {
    let e = escenario(3, { a: ['ceo', 'jefeArea*'] })
    e = paso(e, { tipo: 'elegirAccion', jugador: 'a', accion: 'malversacion' })
    e = paso(e, { tipo: 'desafiar', jugador: 'b' })
    e = paso(e, { tipo: 'salvarse', jugador: 'a' })
    expect(e.fase.tipo).toBe('ventanaDesafioReaccion')
    e = sale(e, 'a')
    expect(j(e, 'a').retirado).toBe(true)
    expect(vivas(e, 'b')).toBe(2) // el desafiante no pierde nada
    expect(e.jugadorActivo).toBe('b')
  })
})

describe('salir: durante un desafío', () => {
  it('el desafiado se va: pierde el desafío, la acción se cancela y el desafiante no pierde nada', () => {
    let e = escenario(3, { a: ['ceo', 'rh'] })
    e = paso(e, { tipo: 'elegirAccion', jugador: 'a', accion: 'malversacion' })
    e = paso(e, { tipo: 'desafiar', jugador: 'b' })
    expect(e.fase.tipo).toBe('revelacion')
    e = sale(e, 'a')
    expect(vivas(e, 'b')).toBe(2)
    expect(j(e, 'a').creditos).toBe(0)
    expect(e.jugadorActivo).toBe('b')
  })

  it('un bloqueador (no objetivo) desafiado se va: el bloqueo cae y la acción procede', () => {
    let e = escenario(4)
    e = paso(e, { tipo: 'elegirAccion', jugador: 'a', accion: 'nomina' })
    e = paso(e, { tipo: 'bloquear', jugador: 'c', rol: 'rh' })
    e = paso(e, { tipo: 'desafiar', jugador: 'd' })
    expect(e.fase.tipo).toBe('revelacion')
    e = sale(e, 'c')
    expect(j(e, 'a').creditos).toBe(4)
    expect(vivas(e, 'd')).toBe(2)
  })

  it('el desafiante se va: el desafío se cae y la acción sigue, sin intercambio de cartas', () => {
    let e = escenario(3, { a: ['ceo', 'rh'] })
    const cartasA = j(e, 'a').cartas.map((c) => c.id)
    e = paso(e, { tipo: 'elegirAccion', jugador: 'a', accion: 'malversacion' })
    e = paso(e, { tipo: 'desafiar', jugador: 'b' })
    e = sale(e, 'b')
    expect(j(e, 'a').creditos).toBe(5)
    expect(j(e, 'a').cartas.map((c) => c.id)).toEqual(cartasA) // nadie mostró ni cambió cartas
    expect(e.jugadorActivo).toBe('c')
  })

  it('el desafiante de un bloqueo se va: el bloqueo se sostiene', () => {
    let e = escenario(3, { a: ['ceo', 'rh'] }, { a: 3 })
    e = paso(e, { tipo: 'elegirAccion', jugador: 'a', accion: 'despido', objetivo: 'b' })
    e = paso(e, { tipo: 'pasar', jugador: 'b' })
    e = paso(e, { tipo: 'pasar', jugador: 'c' })
    e = paso(e, { tipo: 'bloquear', jugador: 'b', rol: 'sindicalizado' })
    e = paso(e, { tipo: 'desafiar', jugador: 'c' })
    e = sale(e, 'c')
    expect(vivas(e, 'b')).toBe(2) // el Despido quedó bloqueado
    expect(hubo(e, 'accionCancelada')).toBe(true)
  })

  it('el actor que desafiaba un bloqueo se va: la acción se cancela', () => {
    let e = escenario(3, { a: ['ceo', 'rh'] }, { a: 3 })
    e = paso(e, { tipo: 'elegirAccion', jugador: 'a', accion: 'despido', objetivo: 'b' })
    e = paso(e, { tipo: 'pasar', jugador: 'b' })
    e = paso(e, { tipo: 'pasar', jugador: 'c' })
    e = paso(e, { tipo: 'bloquear', jugador: 'b', rol: 'sindicalizado' })
    e = paso(e, { tipo: 'desafiar', jugador: 'a' })
    e = sale(e, 'a')
    expect(vivas(e, 'b')).toBe(2)
    expect(e.jugadorActivo).toBe('b')
  })

  it('el que debía elegir qué carta perder se va: pierde todas y el flujo sigue sin él', () => {
    let e = escenario(3, { a: ['ceo', 'rh'] })
    e = paso(e, { tipo: 'elegirAccion', jugador: 'a', accion: 'malversacion' })
    e = paso(e, { tipo: 'desafiar', jugador: 'b' })
    e = paso(e, { tipo: 'revelarCarta', jugador: 'a', cartaId: carta(e, 'a', 1) }) // a tenía RH
    expect(e.fase).toMatchObject({ tipo: 'perdiendoCarta', jugador: 'b' })
    e = sale(e, 'b')
    expect(j(e, 'a').creditos).toBe(5) // la acción de a siguió adelante
    expect(e.jugadorActivo).toBe('c') // b ya no está
  })

  it('se va el actor mientras otro elige qué carta perder: su acción se cancela', () => {
    let e = escenario(3, { a: ['ceo', 'rh'] })
    e = paso(e, { tipo: 'elegirAccion', jugador: 'a', accion: 'malversacion' })
    e = paso(e, { tipo: 'desafiar', jugador: 'b' })
    e = paso(e, { tipo: 'revelarCarta', jugador: 'a', cartaId: carta(e, 'a', 1) })
    e = sale(e, 'a')
    expect(e.fase).toMatchObject({ tipo: 'perdiendoCarta', jugador: 'b' })
    e = paso(e, { tipo: 'elegirCartaAPerder', jugador: 'b', cartaId: carta(e, 'b', 0) })
    expect(vivas(e, 'b')).toBe(1)
    expect(j(e, 'a').creditos).toBe(0) // no cobró
    expect(e.fase.tipo).toBe('accion')
    expect(e.jugadorActivo).toBe('b')
  })
})

describe('salir: reasignación', () => {
  it('las cartas robadas vuelven al mazo y el turno pasa', () => {
    let e = escenario(3, { a: ['ingeniero', 'rh'] })
    const total = idsTotales(e)
    const mazo = e.mazo.length
    e = paso(e, { tipo: 'elegirAccion', jugador: 'a', accion: 'reasignacion' })
    e = paso(e, { tipo: 'pasar', jugador: 'b' })
    e = paso(e, { tipo: 'pasar', jugador: 'c' })
    expect(e.fase.tipo).toBe('reasignando')
    expect(e.mazo.length).toBe(mazo - 2)
    e = sale(e, 'a')
    expect(e.mazo.length).toBe(mazo)
    expect(idsTotales(e)).toEqual(total)
    expect(e.fase.tipo).toBe('accion')
    expect(e.jugadorActivo).toBe('b')
  })
})

describe('salir: efecto en la partida', () => {
  it('si su salida deja a un solo jugador, la partida termina aunque hubiera algo pendiente', () => {
    let e = escenario(2, { a: ['ceo', 'rh'] }, { a: 3 })
    e = paso(e, { tipo: 'elegirAccion', jugador: 'a', accion: 'despido', objetivo: 'b' })
    e = sale(e, 'b')
    expect(e.fase).toEqual({ tipo: 'fin', ganador: 'a' })
  })

  it('el descarte público conserva las cartas de los retirados (nunca vuelven al mazo)', () => {
    let e = escenario(4)
    const mazo = e.mazo.length
    e = sale(e, 'b')
    e = sale(e, 'c')
    expect(e.mazo.length).toBe(mazo)
    expect(j(e, 'b').cartas.every((c) => c.revelada)).toBe(true)
    expect(j(e, 'c').cartas.every((c) => c.revelada)).toBe(true)
  })
})
