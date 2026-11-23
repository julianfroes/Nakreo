import { describe, expect, it } from 'vitest'
import { aplicar } from './engine'
import { crearRng } from './rng'
import { crearPartida } from './setup'
import type { EstadoJuego, Intencion, Jugador, Rol } from './types'

/**
 * Cartas especiales: RH (+4), Sindicalizado (Contrademanda), CEO (salta a los
 * Sindicalizados normales), Ingeniero (explotar el site) y Jefe de Área (Excusa
 * de mérito: salvarse de un farol). Reclamos especiales = riesgo doble.
 */

const rng = crearRng(42)

const ids = (n: number) =>
  Array.from({ length: n }, (_, k) => ({ id: 'abcdefgh'[k], nombre: `J${k}` }))

/** Una carta de una mano de prueba: `'ingeniero'` es normal, `'ingeniero*'` es la especial. */
type CartaDef = Rol | `${Rol}*`

function escenario(
  n: number,
  manos: Record<string, CartaDef[]>,
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

const j = (e: EstadoJuego, id: string): Jugador => e.jugadores.find((x) => x.id === id)!
const carta = (e: EstadoJuego, id: string, k: number) => j(e, id).cartas[k].id
const vivas = (e: EstadoJuego, id: string) => j(e, id).cartas.filter((c) => !c.revelada).length

/** Todas las cartas de la partida, para comprobar que no se pierde ni se duplica ninguna. */
const idsTotales = (e: EstadoJuego) =>
  [...e.mazo, ...e.jugadores.flatMap((x) => x.cartas)].map((c) => c.id).sort((x, y) => x - y)

/** Aplica la intención y devuelve el estado y si hubo un evento de ese tipo. */
function pasoConEventos(e: EstadoJuego, i: Intencion, tipo: string) {
  const r = aplicar(e, i, rng)
  if (!r.ok) throw new Error(`Intención ilegal: ${r.error.codigo} - ${r.error.mensaje}`)
  return { estado: r.estado, hubo: r.eventos.some((ev) => ev.tipo === tipo) }
}

describe('8 jugadores', () => {
  it('reparte 16 cartas y deja 4 en el mazo', () => {
    const e = crearPartida(ids(8), crearRng(3))
    expect(e.jugadores).toHaveLength(8)
    expect(e.mazo).toHaveLength(4)
  })

  it('ninguna carta se pierde ni se duplica en una partida de 8 jugadores', () => {
    let e = crearPartida(ids(8), crearRng(99))
    const total = idsTotales(e)
    for (let k = 0; k < 40 && e.fase.tipo === 'accion'; k++) {
      e = paso(e, { tipo: 'elegirAccion', jugador: e.jugadorActivo, accion: 'sueldoMinimo' })
    }
    expect(idsTotales(e)).toEqual(total)
    expect(new Set(total).size).toBe(20)
  })
})

describe('RH Especial', () => {
  it('Robo de aguinaldo da +4', () => {
    let e = escenario(3, { a: ['rh*', 'ingeniero'] })
    e = paso(e, { tipo: 'elegirAccion', jugador: 'a', accion: 'roboAguinaldo' })
    e = paso(e, { tipo: 'pasar', jugador: 'b' })
    e = paso(e, { tipo: 'pasar', jugador: 'c' })
    expect(j(e, 'a').creditos).toBe(6) // 2 + 4
    expect(e.jugadorActivo).toBe('b')
  })

  it('la carta especial también vale como Director normal: el desafiante pierde solo 1', () => {
    let e = escenario(3, { a: ['rh*', 'ingeniero'] })
    e = paso(e, { tipo: 'elegirAccion', jugador: 'a', accion: 'malversacion' })
    e = paso(e, { tipo: 'desafiar', jugador: 'b' })
    e = paso(e, { tipo: 'revelarCarta', jugador: 'a', cartaId: carta(e, 'a', 0) })
    e = paso(e, { tipo: 'elegirCartaAPerder', jugador: 'b', cartaId: carta(e, 'b', 0) })
    expect(vivas(e, 'b')).toBe(1)
    expect(j(e, 'a').creditos).toBe(5) // +3 normales
  })

  it('farolear Robo de aguinaldo y ser descubierto cuesta 2 cartas (eliminación)', () => {
    let e = escenario(3, { a: ['rh', 'ingeniero'] }) // sin la especial
    e = paso(e, { tipo: 'elegirAccion', jugador: 'a', accion: 'roboAguinaldo' })
    e = paso(e, { tipo: 'desafiar', jugador: 'b' })
    e = paso(e, { tipo: 'revelarCarta', jugador: 'a', cartaId: carta(e, 'a', 0) }) // normal: no basta
    expect(vivas(e, 'a')).toBe(0)
    expect(j(e, 'a').eliminado).toBe(true)
    expect(j(e, 'a').creditos).toBe(0)
    expect(e.jugadorActivo).toBe('b')
  })

  it('desafiar un reclamo especial verdadero cuesta 2 cartas al desafiante', () => {
    let e = escenario(3, { a: ['rh*', 'ingeniero'] })
    e = paso(e, { tipo: 'elegirAccion', jugador: 'a', accion: 'roboAguinaldo' })
    e = paso(e, { tipo: 'desafiar', jugador: 'b' })
    e = paso(e, { tipo: 'revelarCarta', jugador: 'a', cartaId: carta(e, 'a', 0) })
    expect(j(e, 'b').eliminado).toBe(true) // perdió sus 2 cartas, sin elegir
    expect(j(e, 'a').creditos).toBe(6) // la acción se resuelve
    expect(e.jugadorActivo).toBe('c') // b está eliminado
  })

  it('rendirse ante un reclamo especial también cuesta 2 cartas', () => {
    let e = escenario(3, { a: ['rh*', 'ingeniero'] })
    e = paso(e, { tipo: 'elegirAccion', jugador: 'a', accion: 'roboAguinaldo' })
    e = paso(e, { tipo: 'desafiar', jugador: 'b' })
    e = paso(e, { tipo: 'rendirse', jugador: 'a', cartaId: carta(e, 'a', 1) })
    expect(j(e, 'a').eliminado).toBe(true)
  })
})

describe('CEO Especial y Sindicalizado Especial', () => {
  it('La Renuncia «voluntaria» no la frena el Sindicalizado normal, solo el Especial', () => {
    let e = escenario(3, { a: ['ceo*', 'ingeniero'] }, { a: 3 })
    e = paso(e, { tipo: 'elegirAccion', jugador: 'a', accion: 'renuncia', objetivo: 'b' })
    e = paso(e, { tipo: 'pasar', jugador: 'b' })
    e = paso(e, { tipo: 'pasar', jugador: 'c' })
    expect(e.fase.tipo).toBe('ventanaBloqueo')
    const normal = aplicar(e, { tipo: 'bloquear', jugador: 'b', rol: 'sindicalizado' })
    expect(normal.ok).toBe(false)
    if (!normal.ok) expect(normal.error.codigo).toBe('bloqueoInvalido')
    expect(
      aplicar(e, { tipo: 'bloquear', jugador: 'b', rol: 'sindicalizado', especial: true }).ok,
    ).toBe(true)
  })

  it('el Sindicalizado Especial puede cubrir una Demanda laboral con su Contrademanda; el normal no', () => {
    let e = escenario(3, { b: ['sindicalizado*', 'ingeniero'] }, { a: 7 })
    e = paso(e, { tipo: 'elegirAccion', jugador: 'a', accion: 'demandaLaboral', objetivo: 'b' })
    expect(aplicar(e, { tipo: 'bloquear', jugador: 'b', rol: 'sindicalizado' }).ok).toBe(false)
    expect(
      aplicar(e, { tipo: 'bloquear', jugador: 'b', rol: 'sindicalizado', especial: true }).ok,
    ).toBe(true)
  })

  it('la Contrademanda sin desafío es de un solo uso: devuelve la mano al mazo y roba otra', () => {
    let e = escenario(3, { b: ['sindicalizado*', 'ingeniero'] }, { a: 7 })
    const total = idsTotales(e)
    const mazo = e.mazo.length
    e = paso(e, { tipo: 'elegirAccion', jugador: 'a', accion: 'demandaLaboral', objetivo: 'b' })
    e = paso(e, { tipo: 'bloquear', jugador: 'b', rol: 'sindicalizado', especial: true })
    e = paso(e, { tipo: 'pasar', jugador: 'a' })
    const r = pasoConEventos(e, { tipo: 'pasar', jugador: 'c' }, 'manoRenovada')
    e = r.estado
    expect(r.hubo).toBe(true)
    expect(vivas(e, 'b')).toBe(2)
    expect(e.mazo).toHaveLength(mazo)
    expect(idsTotales(e)).toEqual(total) // ninguna carta se pierde ni se duplica
    expect(j(e, 'a').creditos).toBe(0) // la demanda falló y el coste no se devuelve
    expect(e.jugadorActivo).toBe('b')
  })

  it('si lo desafían y lo demuestra, el desafiante pierde 2 cartas y no se renueva la mano', () => {
    let e = escenario(3, { b: ['sindicalizado*', 'ingeniero'] }, { a: 7 })
    e = paso(e, { tipo: 'elegirAccion', jugador: 'a', accion: 'demandaLaboral', objetivo: 'b' })
    e = paso(e, { tipo: 'bloquear', jugador: 'b', rol: 'sindicalizado', especial: true })
    e = paso(e, { tipo: 'desafiar', jugador: 'a' })
    const r = pasoConEventos(e, { tipo: 'revelarCarta', jugador: 'b', cartaId: carta(e, 'b', 0) }, 'manoRenovada')
    e = r.estado
    expect(r.hubo).toBe(false)
    expect(j(e, 'a').eliminado).toBe(true)
    expect(vivas(e, 'b')).toBe(2)
  })

  it('usar la Contrademanda sin tenerla y ser descubierto cuesta 2 cartas', () => {
    let e = escenario(3, { b: ['sindicalizado', 'ingeniero'] }, { a: 7, b: 0 })
    e = paso(e, { tipo: 'elegirAccion', jugador: 'a', accion: 'demandaLaboral', objetivo: 'b' })
    e = paso(e, { tipo: 'bloquear', jugador: 'b', rol: 'sindicalizado', especial: true })
    e = paso(e, { tipo: 'desafiar', jugador: 'a' })
    e = paso(e, { tipo: 'revelarCarta', jugador: 'b', cartaId: carta(e, 'b', 0) })
    expect(j(e, 'b').eliminado).toBe(true)
  })
})

describe('Ingeniero Especial: explotar el site', () => {
  /** a pone una Demanda a b: b decide a la vez si se cubre o «explota el site». */
  function golpeHastaExplosion(manos: Record<string, CartaDef[]>, creditos: Record<string, number>) {
    let e = escenario(3, manos, { a: 7, ...creditos })
    e = paso(e, { tipo: 'elegirAccion', jugador: 'a', accion: 'demandaLaboral', objetivo: 'b' })
    expect(e.fase).toMatchObject({ tipo: 'ventanaBloqueo', explosion: true })
    return e
  }

  it('paga 2; sin desafío el atacante pierde una vida primero y luego el Ingeniero la suya', () => {
    let e = golpeHastaExplosion({ b: ['ingeniero*', 'ceo'] }, { b: 5 })
    e = paso(e, { tipo: 'explotarSite', jugador: 'b' })
    expect(j(e, 'b').creditos).toBe(3)
    expect(e.fase.tipo).toBe('ventanaDesafioReaccion')
    e = paso(e, { tipo: 'pasar', jugador: 'a' })
    e = paso(e, { tipo: 'pasar', jugador: 'c' })

    // Primero pierde el atacante...
    expect(e.fase).toMatchObject({ tipo: 'perdiendoCarta', jugador: 'a' })
    e = paso(e, { tipo: 'elegirCartaAPerder', jugador: 'a', cartaId: carta(e, 'a', 0) })
    expect(vivas(e, 'a')).toBe(1)
    // ...y después la demanda cae sobre el Ingeniero, que descarta la que quiere.
    expect(e.fase).toMatchObject({ tipo: 'perdiendoCarta', jugador: 'b' })
    const total = idsTotales(e)
    const r = pasoConEventos(
      e, { tipo: 'elegirCartaAPerder', jugador: 'b', cartaId: carta(e, 'b', 1) }, 'manoRenovada',
    )
    e = r.estado
    expect(r.hubo).toBe(true) // la carta restante vuelve al mazo
    expect(vivas(e, 'b')).toBe(1)
    expect(idsTotales(e)).toEqual(total)
    expect(e.jugadorActivo).toBe('b')
  })

  it('paga solo 1 si es todo lo que tiene', () => {
    let e = golpeHastaExplosion({ b: ['ingeniero*', 'ceo'] }, { b: 1 })
    e = paso(e, { tipo: 'explotarSite', jugador: 'b' })
    expect(j(e, 'b').creditos).toBe(0)
    expect(e.registro.some((ev) => ev.tipo === 'siteExplotado' && ev.pago === 1)).toBe(true)
  })

  it('sin créditos no se ofrece explotar el site', () => {
    let e = escenario(3, {}, { a: 7, b: 0 })
    e = paso(e, { tipo: 'elegirAccion', jugador: 'a', accion: 'demandaLaboral', objetivo: 'b' })
    expect(e.fase).toMatchObject({ tipo: 'ventanaBloqueo', explosion: false })
    expect(aplicar(e, { tipo: 'explotarSite', jugador: 'b' }).ok).toBe(false)
    e = paso(e, { tipo: 'pasar', jugador: 'b' })
    expect(e.fase).toMatchObject({ tipo: 'perdiendoCarta', jugador: 'b' })
  })

  it('con 1 carta cada uno, la explosión mata primero al atacante y el Ingeniero GANA (sin empate)', () => {
    let e = escenario(
      2,
      { a: ['sindicalizado', 'ingeniero'], b: ['ingeniero*', 'ingeniero'] },
      { a: 7, b: 2 },
    )
    e.jugadores[0].cartas[1].revelada = true
    e.jugadores[1].cartas[1].revelada = true
    e = paso(e, { tipo: 'elegirAccion', jugador: 'a', accion: 'demandaLaboral', objetivo: 'b' })
    e = paso(e, { tipo: 'explotarSite', jugador: 'b' })
    e = paso(e, { tipo: 'pasar', jugador: 'a' })
    expect(e.fase).toEqual({ tipo: 'fin', ganador: 'b' })
    expect(j(e, 'a').eliminado).toBe(true)
    expect(j(e, 'b').eliminado).toBe(false)
    expect(vivas(e, 'b')).toBe(1)
  })

  it('si lo desafían y demuestra la carta, el desafiante pierde 2 y la explosión procede sin renovar la mano', () => {
    let e = golpeHastaExplosion({ b: ['ingeniero*', 'ceo'] }, { b: 5 })
    e = paso(e, { tipo: 'explotarSite', jugador: 'b' })
    e = paso(e, { tipo: 'desafiar', jugador: 'c' })
    e = paso(e, { tipo: 'revelarCarta', jugador: 'b', cartaId: carta(e, 'b', 0) })
    expect(j(e, 'c').eliminado).toBe(true) // 2 cartas perdidas
    e = paso(e, { tipo: 'elegirCartaAPerder', jugador: 'a', cartaId: carta(e, 'a', 0) }) // atacante
    const r = pasoConEventos(
      e, { tipo: 'elegirCartaAPerder', jugador: 'b', cartaId: carta(e, 'b', 1) }, 'manoRenovada',
    )
    expect(r.hubo).toBe(false)
  })

  it('explosión falsa descubierta: el farolero pierde 2 cartas y el atacante NO recupera sus créditos', () => {
    let e = golpeHastaExplosion({ b: ['ingeniero', 'ceo'] }, { b: 5 })
    e = paso(e, { tipo: 'explotarSite', jugador: 'b' })
    e = paso(e, { tipo: 'desafiar', jugador: 'c' })
    e = paso(e, { tipo: 'revelarCarta', jugador: 'b', cartaId: carta(e, 'b', 0) }) // ingeniero normal
    expect(j(e, 'b').eliminado).toBe(true)
    expect(j(e, 'a').creditos).toBe(0) // la demanda se pagó: no hay reembolso aunque el objetivo caiga
    expect(vivas(e, 'a')).toBe(2) // la explosión no llegó a ocurrir
    expect(e.jugadorActivo).toBe('c')
  })

  it('solo el objetivo puede explotar, y solo en su ventana', () => {
    let e = golpeHastaExplosion({ b: ['ingeniero*', 'ceo'] }, { b: 5 })
    expect(aplicar(e, { tipo: 'explotarSite', jugador: 'c' }).ok).toBe(false)
    expect(aplicar(e, { tipo: 'explotarSite', jugador: 'a' }).ok).toBe(false)
    expect(aplicar(escenario(3, {}), { tipo: 'explotarSite', jugador: 'a' }).ok).toBe(false)
    e = paso(e, { tipo: 'pasar', jugador: 'b' })
    expect(e.fase.tipo).toBe('perdiendoCarta')
  })

  it('tampoco se puede explotar en una ventana de bloqueo sin ataque (Nómina)', () => {
    let e = escenario(3, {}, { b: 5 })
    e = paso(e, { tipo: 'elegirAccion', jugador: 'a', accion: 'nomina' })
    expect(e.fase).toMatchObject({ tipo: 'ventanaBloqueo', explosion: false })
    expect(aplicar(e, { tipo: 'explotarSite', jugador: 'b' }).ok).toBe(false)
  })

  it('también se puede explotar ante un Despido', () => {
    let e = escenario(3, { a: ['ceo', 'ingeniero'], b: ['ingeniero*', 'ceo'] }, { a: 3, b: 4 })
    e = paso(e, { tipo: 'elegirAccion', jugador: 'a', accion: 'despido', objetivo: 'b' })
    e = paso(e, { tipo: 'pasar', jugador: 'b' })
    e = paso(e, { tipo: 'pasar', jugador: 'c' })
    // El objetivo ve a la vez «Alegar Sindicalizado» y «explotar el site».
    expect(e.fase).toMatchObject({ tipo: 'ventanaBloqueo', explosion: true })
    e = paso(e, { tipo: 'explotarSite', jugador: 'b' })
    expect(e.fase.tipo).toBe('ventanaDesafioReaccion')
  })
})


describe('Demanda laboral: los créditos se gastan aunque el objetivo caiga por su farol', () => {
  it('Contrademanda falsa y luego Excusa de mérito falsa: el atacante no recupera los 7', () => {
    let e = escenario(3, { b: ['sindicalizado', 'ingeniero'] }, { a: 7, b: 0 })
    e = paso(e, { tipo: 'elegirAccion', jugador: 'a', accion: 'demandaLaboral', objetivo: 'b' })
    e = paso(e, { tipo: 'bloquear', jugador: 'b', rol: 'sindicalizado', especial: true })
    e = paso(e, { tipo: 'desafiar', jugador: 'a' })
    e = paso(e, { tipo: 'salvarse', jugador: 'b' })
    e = paso(e, { tipo: 'desafiar', jugador: 'a' }) // no la tiene: pierde todo sin elegir
    expect(j(e, 'b').eliminado).toBe(true)
    expect(j(e, 'a').creditos).toBe(0)
    expect(e.jugadorActivo).toBe('c')
  })

  it('farol de Jefe Especial descubierto al mostrar carta: tampoco hay reembolso', () => {
    let e = escenario(3, { b: ['sindicalizado', 'ingeniero'] }, { a: 7, b: 0 })
    e = paso(e, { tipo: 'elegirAccion', jugador: 'a', accion: 'demandaLaboral', objetivo: 'b' })
    e = paso(e, { tipo: 'bloquear', jugador: 'b', rol: 'sindicalizado', especial: true })
    e = paso(e, { tipo: 'desafiar', jugador: 'a' })
    e = paso(e, { tipo: 'revelarCarta', jugador: 'b', cartaId: carta(e, 'b', 0) })
    expect(j(e, 'b').eliminado).toBe(true)
    expect(j(e, 'a').creditos).toBe(0)
  })
})

describe('Jefe de Área Especial: Excusa de mérito al ser desafiado', () => {
  /** a farolea Malversación sin RH y b lo desafía: a está ante «mostrar carta». */
  function desafiado(mano: CartaDef[]) {
    let e = escenario(3, { a: mano })
    e = paso(e, { tipo: 'elegirAccion', jugador: 'a', accion: 'malversacion' })
    e = paso(e, { tipo: 'desafiar', jugador: 'b' })
    expect(e.fase.tipo).toBe('revelacion')
    return e
  }

  it('antes de mostrar carta; sin desafío: no pierde cartas, la acción se cancela y su mano vuelve al mazo', () => {
    let e = desafiado(['ceo', 'jefeArea*'])
    const total = idsTotales(e)
    e = paso(e, { tipo: 'salvarse', jugador: 'a' })
    expect(e.fase.tipo).toBe('ventanaDesafioReaccion')
    e = paso(e, { tipo: 'pasar', jugador: 'b' })
    const r = pasoConEventos(e, { tipo: 'pasar', jugador: 'c' }, 'manoRenovada')
    e = r.estado
    expect(r.hubo).toBe(true)
    expect(vivas(e, 'a')).toBe(2)
    expect(j(e, 'a').creditos).toBe(2) // la acción se canceló: sin malversación
    expect(idsTotales(e)).toEqual(total)
    expect(e.jugadorActivo).toBe('b')
  })

  it('si lo desafían y tiene la carta, se muestra sola: el desafiante pierde 2 y no se renueva la mano', () => {
    let e = desafiado(['ceo', 'jefeArea*'])
    e = paso(e, { tipo: 'salvarse', jugador: 'a' })
    const r = pasoConEventos(e, { tipo: 'desafiar', jugador: 'c' }, 'manoRenovada')
    e = r.estado
    expect(r.hubo).toBe(false)
    expect(j(e, 'c').eliminado).toBe(true)
    expect(vivas(e, 'a')).toBe(2)
    expect(e.fase.tipo).toBe('accion') // no quedó nada por elegir
  })

  it('si lo desafían y mentía, pierde todo sin elegir ninguna carta', () => {
    let e = desafiado(['ceo', 'jefeArea']) // Jefe de Área normal
    e = paso(e, { tipo: 'salvarse', jugador: 'a' })
    e = paso(e, { tipo: 'desafiar', jugador: 'c' })
    expect(j(e, 'a').eliminado).toBe(true)
    expect(e.fase.tipo).toBe('accion')
    expect(e.jugadorActivo).toBe('b')
  })

  it('mostrar una carta equivocada ya no ofrece salvarse: simplemente pierde', () => {
    let e = desafiado(['ceo', 'jefeArea*'])
    e = paso(e, { tipo: 'revelarCarta', jugador: 'a', cartaId: carta(e, 'a', 0) })
    expect(vivas(e, 'a')).toBe(1)
    expect(e.fase.tipo).toBe('accion')
  })

  it('solo el desafiado puede salvarse, y solo ante un desafío de acción o bloqueo', () => {
    const e = desafiado(['ceo', 'jefeArea*'])
    expect(aplicar(e, { tipo: 'salvarse', jugador: 'b' }).ok).toBe(false)
    expect(aplicar(escenario(3, {}), { tipo: 'salvarse', jugador: 'a' }).ok).toBe(false)
  })

  it('salva también a un bloqueo falso: la acción procede pero conserva sus cartas', () => {
    let e = escenario(
      3,
      { a: ['ceo', 'ingeniero'], b: ['jefeArea*', 'ingeniero'] },
      { a: 3, b: 0 },
    )
    e = paso(e, { tipo: 'elegirAccion', jugador: 'a', accion: 'despido', objetivo: 'b' })
    e = paso(e, { tipo: 'pasar', jugador: 'b' })
    e = paso(e, { tipo: 'pasar', jugador: 'c' })
    e = paso(e, { tipo: 'bloquear', jugador: 'b', rol: 'sindicalizado' })
    e = paso(e, { tipo: 'desafiar', jugador: 'a' })
    e = paso(e, { tipo: 'salvarse', jugador: 'b' })
    e = paso(e, { tipo: 'pasar', jugador: 'a' })
    e = paso(e, { tipo: 'pasar', jugador: 'c' })
    // El bloqueo era falso, así que el Despido procede (b no tiene créditos para explotar).
    expect(e.fase).toMatchObject({ tipo: 'perdiendoCarta', jugador: 'b' })
  })
})

describe('Modo sin roles especiales', () => {
  /** Igual que `escenario`, pero en modo sin roles especiales. */
  const base = (n: number, manos: Record<string, CartaDef[]> = {}, creditos: Record<string, number> = {}) => {
    const e = crearPartida(ids(n), crearRng(1), { especiales: false })
    let nextId = 1000
    for (const jug of e.jugadores) {
      if (manos[jug.id]) {
        jug.cartas = manos[jug.id].map((def) => {
          if (def.endsWith('*')) throw new Error('No hay cartas especiales en este modo')
          return { id: nextId++, rol: def as Rol, revelada: false }
        })
      }
      if (creditos[jug.id] !== undefined) jug.creditos = creditos[jug.id]
    }
    return e
  }

  it('el mazo tiene 15 cartas, todas normales, y el estado lo indica', () => {
    const e = crearPartida(ids(4), crearRng(3), { especiales: false })
    expect(e.especiales).toBe(false)
    const todas = [...e.mazo, ...e.jugadores.flatMap((x) => x.cartas)]
    expect(todas).toHaveLength(15)
    expect(todas.some((c) => c.especial)).toBe(false)
    expect(new Set(todas.map((c) => c.id)).size).toBe(15)
    expect(crearPartida(ids(4), crearRng(3)).especiales).toBe(true) // por defecto, con especiales
  })

  it('admite hasta 6 jugadores (con especiales, hasta 8)', () => {
    expect(() => crearPartida(ids(6), crearRng(3), { especiales: false })).not.toThrow()
    expect(() => crearPartida(ids(7), crearRng(3), { especiales: false })).toThrow()
    expect(() => crearPartida(ids(8), crearRng(3), { especiales: true })).not.toThrow()
    expect(() => crearPartida(ids(1), crearRng(3), { especiales: false })).toThrow()
  })

  it('las acciones especiales no existen: ni siquiera para farolear', () => {
    const e = base(3)
    for (const accion of ['roboAguinaldo', 'renuncia'] as const) {
      const r = aplicar(e, { tipo: 'elegirAccion', jugador: 'a', accion, objetivo: 'b' })
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.error.codigo).toBe('noDisponible')
    }
    expect(aplicar(e, { tipo: 'elegirAccion', jugador: 'a', accion: 'malversacion' }).ok).toBe(true)
  })

  it('la Demanda laboral no se puede bloquear ni hay «explotar el site»: cae directo', () => {
    let e = base(3, {}, { a: 7, b: 5 })
    e = paso(e, { tipo: 'elegirAccion', jugador: 'a', accion: 'demandaLaboral', objetivo: 'b' })
    expect(e.fase).toMatchObject({ tipo: 'perdiendoCarta', jugador: 'b' })
  })

  it('los bloqueos normales siguen funcionando y los especiales se rechazan', () => {
    let e = base(3, { a: ['ceo', 'ingeniero'] }, { a: 3 })
    e = paso(e, { tipo: 'elegirAccion', jugador: 'a', accion: 'despido', objetivo: 'b' })
    e = paso(e, { tipo: 'pasar', jugador: 'b' })
    e = paso(e, { tipo: 'pasar', jugador: 'c' })
    expect(e.fase.tipo).toBe('ventanaBloqueo')
    const especial = aplicar(e, { tipo: 'bloquear', jugador: 'b', rol: 'sindicalizado', especial: true })
    expect(especial.ok).toBe(false)
    if (!especial.ok) expect(especial.error.codigo).toBe('bloqueoInvalido')
    expect(aplicar(e, { tipo: 'bloquear', jugador: 'b', rol: 'sindicalizado' }).ok).toBe(true)
  })

  it('no se puede declarar la Excusa de mérito al ser desafiado', () => {
    let e = base(3, { a: ['ceo', 'jefeArea'] })
    e = paso(e, { tipo: 'elegirAccion', jugador: 'a', accion: 'malversacion' })
    e = paso(e, { tipo: 'desafiar', jugador: 'b' })
    const r = aplicar(e, { tipo: 'salvarse', jugador: 'a' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.codigo).toBe('noDisponible')
  })
})

describe('Bloquear o explotar el site: el objetivo ve las dos opciones a la vez', () => {
  /** Ataques que el objetivo puede frenar con su bloqueo y/o «explotar el site». */
  const ATAQUES = [
    { accion: 'demandaLaboral', coste: 7, mano: ['ceo', 'rh'] as CartaDef[], bloqueo: { rol: 'sindicalizado', especial: true } },
    { accion: 'despido', coste: 3, mano: ['ceo', 'rh'] as CartaDef[], bloqueo: { rol: 'sindicalizado', especial: false } },
    { accion: 'renuncia', coste: 3, mano: ['ceo*', 'rh'] as CartaDef[], bloqueo: { rol: 'sindicalizado', especial: true } },
  ] as const

  /** a ataca a b y, si el ataque exige un rol, nadie lo desafía: b está ante su ventana de reacción. */
  function ataqueHastaReaccion(
    ataque: (typeof ATAQUES)[number],
    manoB: CartaDef[] = ['ingeniero*', 'ceo'],
    creditosB = 5,
  ) {
    let e = escenario(3, { a: [...ataque.mano], b: manoB }, { a: ataque.coste, b: creditosB })
    e = paso(e, { tipo: 'elegirAccion', jugador: 'a', accion: ataque.accion, objetivo: 'b' })
    if (e.fase.tipo === 'ventanaDesafioAccion') {
      e = paso(e, { tipo: 'pasar', jugador: 'b' })
      e = paso(e, { tipo: 'pasar', jugador: 'c' })
    }
    return e
  }

  it.each(ATAQUES)('$accion: el objetivo puede bloquear o explotar el site, a la vez', (ataque) => {
    const e = ataqueHastaReaccion(ataque)
    expect(e.fase).toMatchObject({ tipo: 'ventanaBloqueo', pendientes: ['b'], explosion: true })
    expect(
      aplicar(e, { tipo: 'bloquear', jugador: 'b', rol: ataque.bloqueo.rol, especial: ataque.bloqueo.especial }).ok,
    ).toBe(true)
    expect(aplicar(e, { tipo: 'explotarSite', jugador: 'b' }).ok).toBe(true)
  })

  it.each(ATAQUES)('$accion: pasar es pasar de todo: el ataque cae sin más ventanas', (ataque) => {
    let e = ataqueHastaReaccion(ataque)
    e = paso(e, { tipo: 'pasar', jugador: 'b' })
    expect(e.fase).toMatchObject({ tipo: 'perdiendoCarta', jugador: 'b' })
  })

  it('el Ingeniero NO bloquea el Despido: ni siquiera siendo su objetivo, y tampoco el Especial', () => {
    const e = ataqueHastaReaccion(ATAQUES[1], ['ingeniero*', 'ingeniero'])
    for (const especial of [false, true]) {
      const r = aplicar(e, { tipo: 'bloquear', jugador: 'b', rol: 'ingeniero', especial })
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.error.codigo).toBe('bloqueoInvalido')
    }
  })

  it('la Renuncia solo la frena el Sindicalizado Especial: ni el Sindicalizado normal ni el Ingeniero', () => {
    const e = ataqueHastaReaccion(ATAQUES[2])
    for (const r of [
      { rol: 'sindicalizado', especial: false },
      { rol: 'ingeniero', especial: false },
      { rol: 'ingeniero', especial: true },
    ] as const) {
      expect(aplicar(e, { tipo: 'bloquear', jugador: 'b', ...r }).ok).toBe(false)
    }
    expect(aplicar(e, { tipo: 'bloquear', jugador: 'b', rol: 'sindicalizado', especial: true }).ok).toBe(true)
  })

  it('un Ingeniero Especial que explota el site no puede bloquear después (eligió una vía)', () => {
    let e = ataqueHastaReaccion(ATAQUES[1])
    e = paso(e, { tipo: 'explotarSite', jugador: 'b' })
    expect(e.fase.tipo).toBe('ventanaDesafioReaccion')
    expect(aplicar(e, { tipo: 'bloquear', jugador: 'b', rol: 'sindicalizado' }).ok).toBe(false)
  })

  it('si bloquea y el bloqueo se sostiene, el ataque se cancela y no se explota nada', () => {
    let e = ataqueHastaReaccion(ATAQUES[1], ['sindicalizado', 'ingeniero*'])
    e = paso(e, { tipo: 'bloquear', jugador: 'b', rol: 'sindicalizado' })
    e = paso(e, { tipo: 'pasar', jugador: 'a' })
    e = paso(e, { tipo: 'pasar', jugador: 'c' })
    expect(vivas(e, 'b')).toBe(2)
    expect(j(e, 'b').creditos).toBe(5) // no pagó nada
    expect(e.registro.some((ev) => ev.tipo === 'siteExplotado')).toBe(false)
    expect(e.jugadorActivo).toBe('b')
  })

  it('SEGUNDA OPORTUNIDAD: si el bloqueo con Sindicalizado cae, aún puede explotar el site', () => {
    // b solo es Ingeniero Especial: el farol del Sindicalizado es creíble porque lo respalda explotar después.
    let e = ataqueHastaReaccion(ATAQUES[1], ['ceo', 'ingeniero*'])
    e = paso(e, { tipo: 'bloquear', jugador: 'b', rol: 'sindicalizado' })
    e = paso(e, { tipo: 'desafiar', jugador: 'a' })
    e = paso(e, { tipo: 'revelarCarta', jugador: 'b', cartaId: carta(e, 'b', 0) }) // un CEO: el farol cae
    expect(vivas(e, 'b')).toBe(1)
    expect(e.fase).toMatchObject({ tipo: 'ventanaIngeniero', pendientes: ['b'] })

    e = paso(e, { tipo: 'explotarSite', jugador: 'b' })
    expect(j(e, 'b').creditos).toBe(3) // 5 - 2
    e = paso(e, { tipo: 'pasar', jugador: 'a' })
    e = paso(e, { tipo: 'pasar', jugador: 'c' })
    // El atacante paga primero (explosión) y después el Despido cae sobre b.
    expect(e.fase).toMatchObject({ tipo: 'perdiendoCarta', jugador: 'a' })
    e = paso(e, { tipo: 'elegirCartaAPerder', jugador: 'a', cartaId: carta(e, 'a', 0) })
    expect(vivas(e, 'a')).toBe(1)
    expect(j(e, 'b').eliminado).toBe(true) // su última carta
  })

  it('en la segunda oportunidad también puede decidir no explotar', () => {
    let e = ataqueHastaReaccion(ATAQUES[1], ['ceo', 'ingeniero*'])
    e = paso(e, { tipo: 'bloquear', jugador: 'b', rol: 'sindicalizado' })
    e = paso(e, { tipo: 'desafiar', jugador: 'a' })
    e = paso(e, { tipo: 'revelarCarta', jugador: 'b', cartaId: carta(e, 'b', 0) })
    e = paso(e, { tipo: 'pasar', jugador: 'b' })
    // Cae sin explotar: a b solo le quedaba una carta, así que la pierde sin elegir.
    expect(j(e, 'b').eliminado).toBe(true)
    expect(e.registro.some((ev) => ev.tipo === 'siteExplotado')).toBe(false)
    expect(vivas(e, 'a')).toBe(2) // el atacante no pagó nada
  })

  it('no hay segunda oportunidad si el bloqueo era especial y el farol cuesta 2 cartas', () => {
    let e = ataqueHastaReaccion(ATAQUES[0], ['ceo', 'ingeniero*']) // Demanda: la Contrademanda es especial
    e = paso(e, { tipo: 'bloquear', jugador: 'b', rol: 'sindicalizado', especial: true })
    e = paso(e, { tipo: 'desafiar', jugador: 'a' })
    e = paso(e, { tipo: 'revelarCarta', jugador: 'b', cartaId: carta(e, 'b', 0) })
    expect(j(e, 'b').eliminado).toBe(true) // riesgo doble: queda eliminado
    expect(e.fase.tipo).toBe('accion')
  })

  it('con 0 créditos no se ofrece explotar, y en modo sin roles especiales nunca', () => {
    expect(ataqueHastaReaccion(ATAQUES[1], ['ingeniero*', 'ceo'], 0).fase).toMatchObject({ explosion: false })

    let base = crearPartida(ids(3), crearRng(1), { especiales: false })
    base.jugadores[0].creditos = 3
    base = paso(base, { tipo: 'elegirAccion', jugador: 'a', accion: 'despido', objetivo: 'b' })
    base = paso(base, { tipo: 'pasar', jugador: 'b' })
    base = paso(base, { tipo: 'pasar', jugador: 'c' })
    expect(base.fase).toMatchObject({ tipo: 'ventanaBloqueo', explosion: false })
    expect(aplicar(base, { tipo: 'explotarSite', jugador: 'b' }).ok).toBe(false)
  })

  it('solo el objetivo puede explotar desde la ventana de bloqueo', () => {
    const e = ataqueHastaReaccion(ATAQUES[1])
    for (const jugador of ['a', 'c']) {
      const r = aplicar(e, { tipo: 'explotarSite', jugador })
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.error.codigo).toBe('noPuedesResponder')
    }
  })
})
