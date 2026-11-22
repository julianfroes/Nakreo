import { describe, expect, it } from 'vitest'
import { aplicar } from '../game/engine'
import { proyectarEstado } from '../game/proyeccion'
import { crearRng } from '../game/rng'
import { crearPartida } from '../game/setup'
import type { EstadoJuego, Intencion, Rol } from '../game/types'
import { detectarSenal } from './feedback'
import { calcularVista, type Vista } from './vista'

const rng = crearRng(5)
const ids = (n: number) => Array.from({ length: n }, (_, k) => ({ id: 'abcdef'[k], nombre: `J${k}` }))

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
  it('mi turno: 7 acciones, con deshabilitadas y su motivo', () => {
    const v = vista(escenario(3, {}), 'a')
    if (v.tipo !== 'elegirAccion') throw new Error(v.tipo)
    expect(v.acciones).toHaveLength(7)
    const por = Object.fromEntries(v.acciones.map((a) => [a.tipo, a]))
    expect(por.ingreso.habilitada).toBe(true)
    expect(por.golpe.habilitada).toBe(false)
    expect(por.golpe.motivo).toMatch(/7/)
    expect(por.sabotaje.habilitada).toBe(false) // cuesta 3 y tengo 2
    expect(v.objetivos.map((o) => o.id)).toEqual(['b', 'c'])
  })

  it('con 14+ créditos no se puede generar créditos', () => {
    const v = vista(escenario(3, {}, { a: 14 }), 'a')
    if (v.tipo !== 'elegirAccion') throw new Error(v.tipo)
    const por = Object.fromEntries(v.acciones.map((a) => [a.tipo, a]))
    expect(por.ingreso.habilitada).toBe(false)
    expect(por.golpe.habilitada).toBe(true)
  })

  it('fuera de mi turno solo espero', () => {
    const v = vista(escenario(3, {}), 'b')
    expect(v).toEqual({ tipo: 'esperando', mensaje: 'Turno de J0' })
  })

  it('ventana de desafío: responden los demás; el actor espera', () => {
    let e = escenario(3, { a: ['directorFinanciero', 'ingeniero'] })
    e = paso(e, { tipo: 'elegirAccion', jugador: 'a', accion: 'dividendos' })
    expect(vista(e, 'b').tipo).toBe('responderDesafio')
    expect(vista(e, 'a').tipo).toBe('esperando')
    e = paso(e, { tipo: 'pasar', jugador: 'b' })
    expect(vista(e, 'b').tipo).toBe('esperando') // ya respondió
    expect(vista(e, 'c').tipo).toBe('responderDesafio')
  })

  it('bloqueo: solo el objetivo ve los roles que bloquean el sabotaje', () => {
    let e = escenario(3, { a: ['saboteador', 'ingeniero'] }, { a: 3 })
    e = paso(e, { tipo: 'elegirAccion', jugador: 'a', accion: 'sabotaje', objetivo: 'b' })
    e = paso(e, { tipo: 'pasar', jugador: 'b' })
    e = paso(e, { tipo: 'pasar', jugador: 'c' })
    const v = vista(e, 'b')
    expect(v.tipo === 'responderBloqueo' && v.roles).toEqual(['jefeSeguridad'])
    expect(vista(e, 'c').tipo).toBe('esperando')
  })

  it('me desafían: modal de defensa con el rol reclamado; el desafiante espera', () => {
    let e = escenario(3, { a: ['directorFinanciero', 'ingeniero'] })
    e = paso(e, { tipo: 'elegirAccion', jugador: 'a', accion: 'dividendos' })
    e = paso(e, { tipo: 'desafiar', jugador: 'b' })
    const v = vista(e, 'a')
    expect(v).toMatchObject({ tipo: 'defenderse', rol: 'directorFinanciero', desafiante: 'b' })
    expect(vista(e, 'b').tipo).toBe('esperando')
  })

  it('perder carta y reasignación solo aparecen para su dueño', () => {
    let e = escenario(3, { a: ['ingeniero', 'jefeSeguridad'] })
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
    e = paso(e, { tipo: 'elegirAccion', jugador: 'a', accion: 'golpe', objetivo: 'b' })
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
    tipo: 'defenderse', rol: 'ingeniero', desafiante: 'b',
    accion: { tipo: 'dividendos', actor: 'a', objetivo: null },
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
