import { describe, expect, it } from 'vitest'
import { aplicar } from './engine'
import { crearRng } from './rng'
import { crearPartida } from './setup'
import type { EstadoJuego, Intencion, Jugador, Rol } from './types'

const rng = crearRng(42)

const ids = (n: number) =>
  Array.from({ length: n }, (_, k) => ({ id: 'abcdef'[k], nombre: `J${k}` }))

/** Crea una partida y fuerza manos/créditos concretos (las cartas se toman del mazo real). */
function escenario(
  n: number,
  manos: Record<string, Rol[]>,
  creditos: Record<string, number> = {},
): EstadoJuego {
  const e = crearPartida(ids(n), crearRng(1))
  let nextId = 1000
  for (const j of e.jugadores) {
    if (manos[j.id]) {
      j.cartas = manos[j.id].map((rol) => ({ id: nextId++, rol, revelada: false }))
    }
    if (creditos[j.id] !== undefined) j.creditos = creditos[j.id]
  }
  return e
}

/** Aplica una intención que debe ser legal. */
function paso(e: EstadoJuego, i: Intencion): EstadoJuego {
  const r = aplicar(e, i, rng)
  if (!r.ok) throw new Error(`Intención ilegal: ${r.error.codigo} - ${r.error.mensaje}`)
  return r.estado
}

const j = (e: EstadoJuego, id: string): Jugador => e.jugadores.find((x) => x.id === id)!
const carta = (e: EstadoJuego, id: string, k: number) => j(e, id).cartas[k].id
const vivas = (e: EstadoJuego, id: string) => j(e, id).cartas.filter((c) => !c.revelada).length

describe('crearPartida', () => {
  it('reparte 2 cartas y 2 créditos, y el mazo completo suma 15 cartas únicas', () => {
    const e = crearPartida(ids(4), crearRng(7))
    for (const p of e.jugadores) {
      expect(p.cartas).toHaveLength(2)
      expect(p.creditos).toBe(2)
    }
    const todas = [...e.mazo, ...e.jugadores.flatMap((p) => p.cartas)]
    expect(todas).toHaveLength(15)
    expect(new Set(todas.map((c) => c.id)).size).toBe(15)
    expect(e.fase.tipo).toBe('accion')
  })

  it('rechaza menos de 2 o más de 6 jugadores', () => {
    expect(() => crearPartida(ids(1))).toThrow()
    expect(() => crearPartida(ids(7))).toThrow()
  })
})

describe('acciones generales', () => {
  it('ingreso da +1 y pasa el turno', () => {
    let e = escenario(3, {})
    e = paso(e, { tipo: 'elegirAccion', jugador: 'a', accion: 'ingreso' })
    expect(j(e, 'a').creditos).toBe(3)
    expect(e.jugadorActivo).toBe('b')
  })

  it('subsidio da +2 tras pasar todos la ventana de bloqueo', () => {
    let e = escenario(3, {})
    e = paso(e, { tipo: 'elegirAccion', jugador: 'a', accion: 'subsidio' })
    expect(e.fase.tipo).toBe('ventanaBloqueo')
    e = paso(e, { tipo: 'pasar', jugador: 'b' })
    e = paso(e, { tipo: 'pasar', jugador: 'c' })
    expect(j(e, 'a').creditos).toBe(4)
    expect(e.jugadorActivo).toBe('b')
  })

  it('golpe cuesta 7 y elimina una carta del objetivo', () => {
    let e = escenario(3, {}, { a: 7 })
    e = paso(e, { tipo: 'elegirAccion', jugador: 'a', accion: 'golpe', objetivo: 'b' })
    expect(j(e, 'a').creditos).toBe(0)
    expect(e.fase.tipo).toBe('perdiendoCarta')
    e = paso(e, { tipo: 'elegirCartaAPerder', jugador: 'b', cartaId: carta(e, 'b', 0) })
    expect(vivas(e, 'b')).toBe(1)
    expect(e.jugadorActivo).toBe('b')
  })

  it('golpe sin créditos suficientes es ilegal', () => {
    const e = escenario(3, {}, { a: 6 })
    const r = aplicar(e, { tipo: 'elegirAccion', jugador: 'a', accion: 'golpe', objetivo: 'b' })
    expect(r.ok).toBe(false)
  })
})

describe('límite de créditos', () => {
  it('con 14+ créditos no se permiten acciones que generen créditos', () => {
    const e = escenario(3, { a: ['directorFinanciero', 'saboteador'] }, { a: 14 })
    for (const accion of ['ingreso', 'subsidio', 'dividendos'] as const) {
      const r = aplicar(e, { tipo: 'elegirAccion', jugador: 'a', accion })
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.error.codigo).toBe('limiteCreditos')
    }
    const r = aplicar(e, { tipo: 'elegirAccion', jugador: 'a', accion: 'desvio', objetivo: 'b' })
    expect(r.ok).toBe(false)
  })

  it('con 14+ créditos sí se permite sabotaje y reasignación', () => {
    const e = escenario(3, { a: ['saboteador', 'ingeniero'] }, { a: 14 })
    expect(
      aplicar(e, { tipo: 'elegirAccion', jugador: 'a', accion: 'sabotaje', objetivo: 'b' }).ok,
    ).toBe(true)
    expect(aplicar(e, { tipo: 'elegirAccion', jugador: 'a', accion: 'reasignacion' }).ok).toBe(true)
  })

  it('con 13 créditos aún se puede generar créditos', () => {
    const e = escenario(3, {}, { a: 13 })
    expect(aplicar(e, { tipo: 'elegirAccion', jugador: 'a', accion: 'ingreso' }).ok).toBe(true)
  })
})

describe('desafío fallido (el acusado SÍ tenía la carta)', () => {
  it('el desafiante pierde carta, el acusado cambia la suya y la acción se resuelve', () => {
    let e = escenario(3, {
      a: ['directorFinanciero', 'jefeSeguridad'],
      b: ['ingeniero', 'ingeniero'],
    })
    const mazoAntes = e.mazo.length
    const idMostrada = carta(e, 'a', 0)

    e = paso(e, { tipo: 'elegirAccion', jugador: 'a', accion: 'dividendos' })
    e = paso(e, { tipo: 'desafiar', jugador: 'b' })
    expect(e.fase.tipo).toBe('revelacion')
    e = paso(e, { tipo: 'revelarCarta', jugador: 'a', cartaId: idMostrada })

    // La carta mostrada fue sustituida por otra del mazo; el mazo conserva su tamaño.
    expect(j(e, 'a').cartas.some((c) => c.id === idMostrada)).toBe(false)
    expect(e.mazo.length).toBe(mazoAntes)
    expect(e.fase.tipo).toBe('perdiendoCarta')

    e = paso(e, { tipo: 'elegirCartaAPerder', jugador: 'b', cartaId: carta(e, 'b', 0) })
    expect(vivas(e, 'b')).toBe(1)
    expect(j(e, 'a').creditos).toBe(5) // 2 + 3 dividendos
    expect(e.jugadorActivo).toBe('b')
  })
})

describe('desafío exitoso (el acusado mentía)', () => {
  it('el acusado pierde la carta mostrada y la acción se cancela', () => {
    let e = escenario(3, { a: ['ingeniero', 'jefeSeguridad'] })
    e = paso(e, { tipo: 'elegirAccion', jugador: 'a', accion: 'dividendos' })
    e = paso(e, { tipo: 'desafiar', jugador: 'c' })
    e = paso(e, { tipo: 'revelarCarta', jugador: 'a', cartaId: carta(e, 'a', 0) })

    expect(j(e, 'a').cartas[0].revelada).toBe(true)
    expect(vivas(e, 'a')).toBe(1)
    expect(j(e, 'a').creditos).toBe(2) // sin dividendos
    expect(e.jugadorActivo).toBe('b')
  })
})

describe('sabotaje y bloqueo', () => {
  it('sabotaje desafiado con éxito devuelve el coste', () => {
    let e = escenario(3, { a: ['ingeniero', 'jefeSeguridad'] }, { a: 3 })
    e = paso(e, { tipo: 'elegirAccion', jugador: 'a', accion: 'sabotaje', objetivo: 'b' })
    expect(j(e, 'a').creditos).toBe(0)
    e = paso(e, { tipo: 'desafiar', jugador: 'c' })
    e = paso(e, { tipo: 'revelarCarta', jugador: 'a', cartaId: carta(e, 'a', 0) })
    expect(j(e, 'a').creditos).toBe(3)
    expect(vivas(e, 'b')).toBe(2)
  })

  it('bloqueo sin desafío: el sabotaje falla y el coste se pierde', () => {
    let e = escenario(3, { a: ['saboteador', 'ingeniero'] }, { a: 3 })
    e = paso(e, { tipo: 'elegirAccion', jugador: 'a', accion: 'sabotaje', objetivo: 'b' })
    e = paso(e, { tipo: 'pasar', jugador: 'b' }) // b no desafía
    e = paso(e, { tipo: 'pasar', jugador: 'c' })
    expect(e.fase.tipo).toBe('ventanaBloqueo')
    e = paso(e, { tipo: 'bloquear', jugador: 'b', rol: 'jefeSeguridad' })
    e = paso(e, { tipo: 'pasar', jugador: 'a' })
    e = paso(e, { tipo: 'pasar', jugador: 'c' })
    expect(vivas(e, 'b')).toBe(2)
    expect(j(e, 'a').creditos).toBe(0)
    expect(e.jugadorActivo).toBe('b')
  })

  it('solo el objetivo puede bloquear un sabotaje', () => {
    let e = escenario(3, { a: ['saboteador', 'ingeniero'] }, { a: 3 })
    e = paso(e, { tipo: 'elegirAccion', jugador: 'a', accion: 'sabotaje', objetivo: 'b' })
    e = paso(e, { tipo: 'pasar', jugador: 'b' })
    e = paso(e, { tipo: 'pasar', jugador: 'c' })
    const r = aplicar(e, { tipo: 'bloquear', jugador: 'c', rol: 'jefeSeguridad' })
    expect(r.ok).toBe(false)
  })

  it('bloqueo falso descubierto: el bloqueador pierde carta y el sabotaje procede', () => {
    let e = escenario(
      3,
      { a: ['saboteador', 'ingeniero'], b: ['contrabandista', 'ingeniero'] },
      { a: 3 },
    )
    e = paso(e, { tipo: 'elegirAccion', jugador: 'a', accion: 'sabotaje', objetivo: 'b' })
    e = paso(e, { tipo: 'pasar', jugador: 'b' })
    e = paso(e, { tipo: 'pasar', jugador: 'c' })
    e = paso(e, { tipo: 'bloquear', jugador: 'b', rol: 'jefeSeguridad' })
    e = paso(e, { tipo: 'desafiar', jugador: 'a' })
    e = paso(e, { tipo: 'revelarCarta', jugador: 'b', cartaId: carta(e, 'b', 0) })
    // b perdió una carta por el farol y ahora el sabotaje le quita la última -> eliminado.
    expect(j(e, 'b').eliminado).toBe(true)
    expect(e.jugadorActivo).toBe('c') // el turno salta al siguiente jugador vivo
  })
})

describe('eliminación de jugador', () => {
  it('pierde la última carta: queda eliminado, sin créditos, y se salta su turno', () => {
    let e = escenario(3, { a: ['ingeniero', 'jefeSeguridad'] })
    // a ya tiene una carta perdida
    e.jugadores[0].cartas[1].revelada = true
    e = paso(e, { tipo: 'elegirAccion', jugador: 'a', accion: 'dividendos' })
    e = paso(e, { tipo: 'desafiar', jugador: 'b' })
    e = paso(e, { tipo: 'revelarCarta', jugador: 'a', cartaId: carta(e, 'a', 0) })

    expect(j(e, 'a').eliminado).toBe(true)
    expect(j(e, 'a').creditos).toBe(0)
    expect(e.fase.tipo).toBe('accion')
    expect(e.jugadorActivo).toBe('b')

    // Tras b y c, el turno vuelve a b saltando a 'a'.
    e = paso(e, { tipo: 'elegirAccion', jugador: 'b', accion: 'ingreso' })
    e = paso(e, { tipo: 'elegirAccion', jugador: 'c', accion: 'ingreso' })
    expect(e.jugadorActivo).toBe('b')
  })

  it('un jugador eliminado no puede actuar', () => {
    const e = escenario(3, {})
    e.jugadores[1].eliminado = true
    const r = aplicar(e, { tipo: 'pasar', jugador: 'b' })
    expect(r.ok).toBe(false)
  })
})

describe('fin de partida', () => {
  it('queda un solo jugador vivo: gana y la partida se bloquea', () => {
    let e = escenario(2, { b: ['ingeniero', 'ingeniero'] }, { a: 7 })
    e.jugadores[1].cartas[1].revelada = true
    e = paso(e, { tipo: 'elegirAccion', jugador: 'a', accion: 'golpe', objetivo: 'b' })
    // b solo tenía una carta viva: pérdida automática.
    expect(j(e, 'b').eliminado).toBe(true)
    expect(e.fase).toEqual({ tipo: 'fin', ganador: 'a' })

    const r = aplicar(e, { tipo: 'elegirAccion', jugador: 'a', accion: 'ingreso' })
    expect(r.ok).toBe(false)
  })

  it('un desafío exitoso que elimina al último rival también termina la partida', () => {
    let e = escenario(2, { a: ['ingeniero', 'ingeniero'], b: ['jefeSeguridad', 'jefeSeguridad'] })
    e.jugadores[0].cartas[1].revelada = true // a tiene 1 carta y va a farolear
    e = paso(e, { tipo: 'elegirAccion', jugador: 'a', accion: 'dividendos' })
    e = paso(e, { tipo: 'desafiar', jugador: 'b' })
    e = paso(e, { tipo: 'revelarCarta', jugador: 'a', cartaId: carta(e, 'a', 0) })
    expect(e.fase).toEqual({ tipo: 'fin', ganador: 'b' })
  })

  it('emite el evento partidaTerminada', () => {
    const e = escenario(2, { b: ['ingeniero', 'ingeniero'] }, { a: 7 })
    e.jugadores[1].cartas[1].revelada = true
    const r = aplicar(e, { tipo: 'elegirAccion', jugador: 'a', accion: 'golpe', objetivo: 'b' })
    expect(r.ok && r.eventos.some((ev) => ev.tipo === 'partidaTerminada')).toBe(true)
  })
})

describe('otras acciones de rol', () => {
  it('desvío roba hasta 2 créditos', () => {
    let e = escenario(2, { a: ['contrabandista', 'ingeniero'] }, { b: 1 })
    e = paso(e, { tipo: 'elegirAccion', jugador: 'a', accion: 'desvio', objetivo: 'b' })
    e = paso(e, { tipo: 'pasar', jugador: 'b' }) // desafío
    e = paso(e, { tipo: 'pasar', jugador: 'b' }) // bloqueo
    expect(j(e, 'a').creditos).toBe(3)
    expect(j(e, 'b').creditos).toBe(0)
  })

  it('reasignación: roba 2, conserva las elegidas y devuelve el resto al mazo', () => {
    let e = escenario(3, { a: ['ingeniero', 'jefeSeguridad'] })
    const mazoAntes = e.mazo.length
    e = paso(e, { tipo: 'elegirAccion', jugador: 'a', accion: 'reasignacion' })
    e = paso(e, { tipo: 'pasar', jugador: 'b' })
    e = paso(e, { tipo: 'pasar', jugador: 'c' })
    expect(e.fase.tipo).toBe('reasignando')
    if (e.fase.tipo !== 'reasignando') return
    expect(e.mazo.length).toBe(mazoAntes - 2)

    const conservar = [carta(e, 'a', 0), e.fase.robadas[0].id]
    e = paso(e, { tipo: 'confirmarReasignacion', jugador: 'a', conservar })
    expect(vivas(e, 'a')).toBe(2)
    expect(j(e, 'a').cartas.map((c) => c.id).sort()).toEqual([...conservar].sort())
    expect(e.mazo.length).toBe(mazoAntes)
    expect(e.jugadorActivo).toBe('b')
  })

  it('reasignación con cantidad o cartas inválidas es ilegal', () => {
    let e = escenario(3, { a: ['ingeniero', 'jefeSeguridad'] })
    e = paso(e, { tipo: 'elegirAccion', jugador: 'a', accion: 'reasignacion' })
    e = paso(e, { tipo: 'pasar', jugador: 'b' })
    e = paso(e, { tipo: 'pasar', jugador: 'c' })
    const r1 = aplicar(e, { tipo: 'confirmarReasignacion', jugador: 'a', conservar: [carta(e, 'a', 0)] })
    const r2 = aplicar(e, { tipo: 'confirmarReasignacion', jugador: 'a', conservar: [1, 2] })
    expect(r1.ok).toBe(false)
    expect(r2.ok).toBe(false)
  })
})

describe('validación e inmutabilidad', () => {
  it('actuar fuera de turno es ilegal', () => {
    const e = escenario(3, {})
    const r = aplicar(e, { tipo: 'elegirAccion', jugador: 'b', accion: 'ingreso' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.codigo).toBe('noEsTuTurno')
  })

  it('no se puede apuntar a uno mismo ni a un eliminado', () => {
    const e = escenario(3, {}, { a: 7 })
    expect(aplicar(e, { tipo: 'elegirAccion', jugador: 'a', accion: 'golpe', objetivo: 'a' }).ok).toBe(false)
    e.jugadores[1].eliminado = true
    expect(aplicar(e, { tipo: 'elegirAccion', jugador: 'a', accion: 'golpe', objetivo: 'b' }).ok).toBe(false)
  })

  it('solo el acusado puede revelar, y solo una carta suya', () => {
    let e = escenario(3, { a: ['directorFinanciero', 'ingeniero'] })
    e = paso(e, { tipo: 'elegirAccion', jugador: 'a', accion: 'dividendos' })
    e = paso(e, { tipo: 'desafiar', jugador: 'b' })
    expect(aplicar(e, { tipo: 'revelarCarta', jugador: 'b', cartaId: carta(e, 'b', 0) }).ok).toBe(false)
    expect(aplicar(e, { tipo: 'revelarCarta', jugador: 'a', cartaId: carta(e, 'b', 0) }).ok).toBe(false)
  })

  it('el estado original nunca se muta, ni en éxito ni en error', () => {
    const e = escenario(3, {})
    const copia = structuredClone(e)
    aplicar(e, { tipo: 'elegirAccion', jugador: 'a', accion: 'ingreso' })
    aplicar(e, { tipo: 'elegirAccion', jugador: 'b', accion: 'ingreso' })
    expect(e).toEqual(copia)
  })

  it('los eventos no filtran roles de cartas ocultas al iniciar un turno', () => {
    const e = escenario(3, {})
    const r = aplicar(e, { tipo: 'elegirAccion', jugador: 'a', accion: 'ingreso' })
    expect(r.ok && JSON.stringify(r.eventos)).not.toMatch(/directorFinanciero|saboteador|contrabandista|ingeniero|jefeSeguridad/)
  })
})

describe('rendirse', () => {
  it('perder la carta elegida cancela la acción, aunque fuera la carta del rol', () => {
    let e = escenario(3, { a: ['directorFinanciero', 'jefeSeguridad'] })
    e = paso(e, { tipo: 'elegirAccion', jugador: 'a', accion: 'dividendos' })
    e = paso(e, { tipo: 'desafiar', jugador: 'b' })
    e = paso(e, { tipo: 'rendirse', jugador: 'a', cartaId: carta(e, 'a', 0) }) // la del rol
    expect(j(e, 'a').cartas[0].revelada).toBe(true)
    expect(j(e, 'a').creditos).toBe(2) // sin dividendos
    expect(vivas(e, 'b')).toBe(2) // el desafiante no pierde nada
    expect(e.jugadorActivo).toBe('b')
  })

  it('rendirse ante un desafío a un bloqueo deja que la acción proceda', () => {
    let e = escenario(3, { a: ['saboteador', 'ingeniero'], b: ['jefeSeguridad', 'ingeniero'] }, { a: 3 })
    e = paso(e, { tipo: 'elegirAccion', jugador: 'a', accion: 'sabotaje', objetivo: 'b' })
    e = paso(e, { tipo: 'pasar', jugador: 'b' })
    e = paso(e, { tipo: 'pasar', jugador: 'c' })
    e = paso(e, { tipo: 'bloquear', jugador: 'b', rol: 'jefeSeguridad' })
    e = paso(e, { tipo: 'desafiar', jugador: 'a' })
    e = paso(e, { tipo: 'rendirse', jugador: 'b', cartaId: carta(e, 'b', 0) })
    // b pierde una carta por rendirse y el sabotaje le quita la otra.
    expect(j(e, 'b').eliminado).toBe(true)
  })

  it('solo el desafiado puede rendirse, y solo con una carta suya', () => {
    let e = escenario(3, { a: ['directorFinanciero', 'ingeniero'] })
    e = paso(e, { tipo: 'elegirAccion', jugador: 'a', accion: 'dividendos' })
    e = paso(e, { tipo: 'desafiar', jugador: 'b' })
    expect(aplicar(e, { tipo: 'rendirse', jugador: 'b', cartaId: carta(e, 'b', 0) }).ok).toBe(false)
    expect(aplicar(e, { tipo: 'rendirse', jugador: 'a', cartaId: carta(e, 'b', 0) }).ok).toBe(false)
    expect(aplicar(e, { tipo: 'rendirse', jugador: 'a', cartaId: carta(e, 'a', 1) }).ok).toBe(true)
  })
})
