import { describe, expect, it } from 'vitest'
import { aplicar } from '../game/engine'
import { proyectarEstado } from '../game/proyeccion'
import { crearRng } from '../game/rng'
import { crearPartida } from '../game/setup'
import type { EstadoJuego, Intencion, Rol } from '../game/types'
import { detectarSenal } from './feedback'
import { calcularVista, type Vista } from './vista'

const rng = crearRng(5)
const ids = (n: number) => Array.from({ length: n }, (_, k) => ({ id: 'abcdefgh'[k], nombre: `J${k}` }))

function escenario(n: number, manos: Record<string, Rol[]>, creditos: Record<string, number> = {}) {
  const e = crearPartida(ids(n), crearRng(1))
  let id = 1000
  for (const j of e.jugadores) {
    if (manos[j.id]) j.cartas = manos[j.id].map((rol) => ({ id: id++, rol, revelada: false }))
    if (creditos[j.id] !== undefined) j.creditos = creditos[j.id]
  }
  return e
}

function paso(e: EstadoJuego, i: Intencion): EstadoJuego {
  const r = aplicar(e, i, rng)
  if (!r.ok) throw new Error(r.error.mensaje)
  return r.estado
}

const vista = (e: EstadoJuego, id: string): Vista => calcularVista(proyectarEstado(e, id))

describe('calcularVista', () => {
  it('mi turno: 9 acciones, con deshabilitadas y su motivo', () => {
    const v = vista(escenario(3, {}), 'a')
    if (v.tipo !== 'elegirAccion') throw new Error(v.tipo)
    expect(v.acciones).toHaveLength(9)
    const por = Object.fromEntries(v.acciones.map((a) => [a.tipo, a]))
    expect(por.sueldoMinimo.habilitada).toBe(true)
    expect(por.demandaLaboral.habilitada).toBe(false)
    expect(por.demandaLaboral.motivo).toMatch(/7/)
    expect(por.despido.habilitada).toBe(false) // cuesta 3 y tengo 2
    expect(v.objetivos.map((o) => o.id)).toEqual(['b', 'c'])
  })

  it('con 14+ créditos no se puede generar créditos', () => {
    const v = vista(escenario(3, {}, { a: 14 }), 'a')
    if (v.tipo !== 'elegirAccion') throw new Error(v.tipo)
    const por = Object.fromEntries(v.acciones.map((a) => [a.tipo, a]))
    expect(por.sueldoMinimo.habilitada).toBe(false)
    expect(por.demandaLaboral.habilitada).toBe(true)
  })

  it('fuera de mi turno solo espero', () => {
    const v = vista(escenario(3, {}), 'b')
    expect(v).toEqual({ tipo: 'esperando', mensaje: 'Turno de J0' })
  })

  it('ventana de desafío: responden los demás; el actor espera', () => {
    let e = escenario(3, { a: ['rh', 'ingeniero'] })
    e = paso(e, { tipo: 'elegirAccion', jugador: 'a', accion: 'malversacion' })
    expect(vista(e, 'b').tipo).toBe('responderDesafio')
    expect(vista(e, 'a').tipo).toBe('esperando')
    e = paso(e, { tipo: 'pasar', jugador: 'b' })
    expect(vista(e, 'b').tipo).toBe('esperando') // ya respondió
    expect(vista(e, 'c').tipo).toBe('responderDesafio')
  })

  it('bloqueo: solo el objetivo ve los roles que bloquean el despido', () => {
    let e = escenario(3, { a: ['ceo', 'ingeniero'] }, { a: 3 })
    e = paso(e, { tipo: 'elegirAccion', jugador: 'a', accion: 'despido', objetivo: 'b' })
    e = paso(e, { tipo: 'pasar', jugador: 'b' })
    e = paso(e, { tipo: 'pasar', jugador: 'c' })
    const v = vista(e, 'b')
    expect(v.tipo === 'responderBloqueo' && v.roles).toEqual([{ rol: 'sindicalizado', especial: false }])
    expect(vista(e, 'c').tipo).toBe('esperando')
  })

  it('me desafían: modal de defensa con el rol reclamado; el desafiante espera', () => {
    let e = escenario(3, { a: ['rh', 'ingeniero'] })
    e = paso(e, { tipo: 'elegirAccion', jugador: 'a', accion: 'malversacion' })
    e = paso(e, { tipo: 'desafiar', jugador: 'b' })
    const v = vista(e, 'a')
    expect(v).toMatchObject({ tipo: 'defenderse', reclamo: { rol: 'rh', especial: false }, desafiante: 'b' })
    expect(vista(e, 'b').tipo).toBe('esperando')
  })

  it('perder carta y reasignación solo aparecen para su dueño', () => {
    let e = escenario(3, { a: ['ingeniero', 'sindicalizado'] })
    e = paso(e, { tipo: 'elegirAccion', jugador: 'a', accion: 'reasignacion' })
    e = paso(e, { tipo: 'pasar', jugador: 'b' })
    e = paso(e, { tipo: 'pasar', jugador: 'c' })
    const v = vista(e, 'a')
    expect(v.tipo === 'reasignar' && v.opciones).toHaveLength(4)
    expect(v.tipo === 'reasignar' && v.cuantas).toBe(2)
    expect(vista(e, 'b').tipo).toBe('esperando')
  })

  it('eliminado y fin de partida', () => {
    let e = escenario(2, { b: ['ingeniero', 'ingeniero'] }, { a: 7 })
    e.jugadores[1].cartas[1].revelada = true
    e = paso(e, { tipo: 'elegirAccion', jugador: 'a', accion: 'demandaLaboral', objetivo: 'b' })
    e = paso(e, { tipo: 'pasar', jugador: 'b' }) // no se cubre ni explota el site
    expect(vista(e, 'a')).toEqual({ tipo: 'fin', ganador: 'a', gane: true })
    expect(vista(e, 'b')).toEqual({ tipo: 'fin', ganador: 'a', gane: false })

    const e3 = escenario(3, {})
    e3.jugadores[2].cartas.forEach((c) => (c.revelada = true))
    expect(vista(e3, 'c').tipo).toBe('eliminado')
  })
})

describe('detectarSenal', () => {
  const turno: Vista = { tipo: 'elegirAccion', acciones: [], objetivos: [] }
  const espera: Vista = { tipo: 'esperando', mensaje: '' }
  const defensa: Vista = {
    tipo: 'defenderse', reclamo: { rol: 'ingeniero', especial: false }, desafiante: 'b', puedeSalvarse: true,
    accion: { tipo: 'malversacion', actor: 'a', objetivo: null },
  }

  it('vibra al empezar mi turno y al ser desafiado, solo en transiciones', () => {
    expect(detectarSenal(espera, turno)).toBe('miTurno')
    expect(detectarSenal(null, turno)).toBe('miTurno')
    expect(detectarSenal(turno, turno)).toBeNull()
    expect(detectarSenal(espera, defensa)).toBe('meDesafian')
    expect(detectarSenal(defensa, defensa)).toBeNull()
    expect(detectarSenal(turno, espera)).toBeNull()
  })
})

describe('calcularVista: modo sin roles especiales', () => {
  const sinEspeciales = (manos: Record<string, Rol[]> = {}, creditos: Record<string, number> = {}) => {
    const e = crearPartida(ids(3), crearRng(1), { especiales: false })
    let id = 1000
    for (const j of e.jugadores) {
      if (manos[j.id]) j.cartas = manos[j.id].map((rol) => ({ id: id++, rol, revelada: false }))
      if (creditos[j.id] !== undefined) j.creditos = creditos[j.id]
    }
    return e
  }

  it('mi turno: solo las 7 acciones normales (sin Robo de aguinaldo ni Renuncia)', () => {
    const v = vista(sinEspeciales(), 'a')
    expect(v.tipo).toBe('elegirAccion')
    const tipos = v.tipo === 'elegirAccion' ? v.acciones.map((a) => a.tipo) : []
    expect(tipos).toHaveLength(7)
    expect(tipos).not.toContain('roboAguinaldo')
    expect(tipos).not.toContain('renuncia')
  })

  it('una Demanda laboral no abre ventana de bloqueo ni de explosión', () => {
    let e = sinEspeciales({}, { a: 7, b: 5 })
    e = paso(e, { tipo: 'elegirAccion', jugador: 'a', accion: 'demandaLaboral', objetivo: 'b' })
    expect(vista(e, 'b').tipo).toBe('perderCarta')
  })

  it('al bloquear un Despido solo se ofrece el Sindicalizado normal', () => {
    let e = sinEspeciales({ a: ['ceo', 'ingeniero'] }, { a: 3 })
    e = paso(e, { tipo: 'elegirAccion', jugador: 'a', accion: 'despido', objetivo: 'b' })
    e = paso(e, { tipo: 'pasar', jugador: 'b' })
    e = paso(e, { tipo: 'pasar', jugador: 'c' })
    const v = vista(e, 'b')
    expect(v.tipo === 'responderBloqueo' && v.roles).toEqual([{ rol: 'sindicalizado', especial: false }])
  })

  it('al ser desafiado no se ofrece salvarse', () => {
    let e = sinEspeciales({ a: ['ceo', 'jefeArea'] })
    e = paso(e, { tipo: 'elegirAccion', jugador: 'a', accion: 'malversacion' })
    e = paso(e, { tipo: 'desafiar', jugador: 'b' })
    expect(vista(e, 'a')).toMatchObject({ tipo: 'defenderse', puedeSalvarse: false })
  })
})

describe('calcularVista: habilidades especiales', () => {
  it('el objetivo de una Demanda laboral ve a la vez la Contrademanda y «explotar el site»; los demás esperan', () => {
    let e = escenario(3, {}, { a: 7, b: 5 })
    e = paso(e, { tipo: 'elegirAccion', jugador: 'a', accion: 'demandaLaboral', objetivo: 'b' })
    expect(vista(e, 'b')).toMatchObject({
      tipo: 'responderBloqueo',
      roles: [{ rol: 'sindicalizado', especial: true }],
      explosion: { pago: 2 },
    })
    expect(vista(e, 'c').tipo).toBe('esperando')
    e = paso(e, { tipo: 'pasar', jugador: 'b' })
    expect(vista(e, 'b').tipo).toBe('perderCarta') // pasar es pasar de todo
  })

  it('«explotar el site» paga solo lo que tienes y no se ofrece sin créditos ni en acciones sin ataque', () => {
    let e = escenario(3, {}, { a: 7, b: 1 })
    e = paso(e, { tipo: 'elegirAccion', jugador: 'a', accion: 'demandaLaboral', objetivo: 'b' })
    expect(vista(e, 'b')).toMatchObject({ explosion: { pago: 1 } })

    let sin = escenario(3, {}, { a: 7, b: 0 })
    sin = paso(sin, { tipo: 'elegirAccion', jugador: 'a', accion: 'demandaLaboral', objetivo: 'b' })
    expect(vista(sin, 'b')).toMatchObject({ explosion: null })

    let nomina = escenario(3, {})
    nomina = paso(nomina, { tipo: 'elegirAccion', jugador: 'a', accion: 'nomina' })
    expect(vista(nomina, 'b')).toMatchObject({ tipo: 'responderBloqueo', explosion: null })
  })

  it('el Ingeniero normal no ve «Alegar Ingeniero» ante un Despido: solo el Sindicalizado', () => {
    let e = escenario(3, { a: ['ceo', 'rh'] }, { a: 3 })
    e = paso(e, { tipo: 'elegirAccion', jugador: 'a', accion: 'despido', objetivo: 'b' })
    e = paso(e, { tipo: 'pasar', jugador: 'b' })
    e = paso(e, { tipo: 'pasar', jugador: 'c' })
    const v = vista(e, 'b')
    expect(v.tipo === 'responderBloqueo' && v.roles).toEqual([{ rol: 'sindicalizado', especial: false }])
    expect(v).toMatchObject({ explosion: { pago: 2 } })
  })

  it('el desafiado puede salvarse antes de mostrar carta; en una explosión no', () => {
    let e = escenario(3, { a: ['ceo', 'jefeArea'] })
    e = paso(e, { tipo: 'elegirAccion', jugador: 'a', accion: 'malversacion' })
    e = paso(e, { tipo: 'desafiar', jugador: 'b' })
    expect(vista(e, 'a')).toMatchObject({ tipo: 'defenderse', puedeSalvarse: true })
    expect(vista(e, 'b').tipo).toBe('esperando')

    let g = escenario(3, { b: ['ingeniero', 'ingeniero'] }, { a: 7, b: 5 })
    g = paso(g, { tipo: 'elegirAccion', jugador: 'a', accion: 'demandaLaboral', objetivo: 'b' })
    g = paso(g, { tipo: 'explotarSite', jugador: 'b' })
    g = paso(g, { tipo: 'desafiar', jugador: 'c' })
    expect(vista(g, 'b')).toMatchObject({ tipo: 'defenderse', puedeSalvarse: false })
  })

  it('una reacción especial se puede desafiar; el que reacciona no', () => {
    let e = escenario(3, { b: ['ingeniero', 'ingeniero'] }, { a: 7, b: 5 })
    e = paso(e, { tipo: 'elegirAccion', jugador: 'a', accion: 'demandaLaboral', objetivo: 'b' })
    e = paso(e, { tipo: 'explotarSite', jugador: 'b' })
    expect(vista(e, 'a').tipo).toBe('responderDesafioReaccion')
    expect(vista(e, 'c').tipo).toBe('responderDesafioReaccion')
    expect(vista(e, 'b').tipo).toBe('esperando')
  })
})

describe('calcularVista: abandonar', () => {
  it('quien se retiró ve la despedida (aunque su salida haya terminado la partida)', () => {
    let e = escenario(2, {})
    e = paso(e, { tipo: 'salir', jugador: 'a' })
    expect(e.fase.tipo).toBe('fin')
    expect(vista(e, 'a')).toEqual({ tipo: 'retirado' })
    expect(vista(e, 'b')).toMatchObject({ tipo: 'fin', gane: true })
  })

  it('los demás siguen jugando sin él, y el eliminado de verdad no es un retirado', () => {
    let e = escenario(3, {})
    e = paso(e, { tipo: 'salir', jugador: 'c' })
    expect(vista(e, 'a').tipo).toBe('elegirAccion')
    expect(vista(e, 'c').tipo).toBe('retirado')
    const e3 = escenario(3, {})
    e3.jugadores[2].cartas.forEach((c) => (c.revelada = true))
    expect(vista(e3, 'c').tipo).toBe('eliminado')
  })
})
