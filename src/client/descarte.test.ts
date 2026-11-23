import { describe, expect, it } from 'vitest'
import { aplicar } from '../game/engine'
import { proyectarEstado, proyectarPublico } from '../game/proyeccion'
import { crearRng } from '../game/rng'
import { crearPartida } from '../game/setup'
import type { EstadoJuego, Intencion, Rol } from '../game/types'
import { calcularDescarte } from './descarte'

const rng = crearRng(9)
const ids = (n: number) => Array.from({ length: n }, (_, k) => ({ id: 'abcdefgh'[k], nombre: `J${k}` }))

type CartaDef = Rol | `${Rol}*`

function escenario(n: number, manos: Record<string, CartaDef[]> = {}, creditos: Record<string, number> = {}) {
  const e = crearPartida(ids(n), crearRng(1))
  let id = 1000
  for (const j of e.jugadores) {
    if (manos[j.id]) {
      j.cartas = manos[j.id].map((def) => {
        const especial = def.endsWith('*')
        const rol = (especial ? def.slice(0, -1) : def) as Rol
        return especial
          ? { id: id++, rol, especial: true, revelada: false }
          : { id: id++, rol, revelada: false }
      })
    }
    if (creditos[j.id] !== undefined) j.creditos = creditos[j.id]
  }
  return e
}

function paso(e: EstadoJuego, i: Intencion): EstadoJuego {
  const r = aplicar(e, i, rng)
  if (!r.ok) throw new Error(`Intención ilegal: ${r.error.mensaje}`)
  return r.estado
}

describe('calcularDescarte', () => {
  it('sin cartas perdidas está vacío', () => {
    const d = calcularDescarte(proyectarEstado(escenario(3), 'a'))
    expect(d).toEqual({ grupos: [], total: 0 })
  })

  it('agrupa por jugador, en orden de asiento, y cuenta el total', () => {
    const e = escenario(4, { a: ['rh', 'ceo'], b: ['jefeArea', 'ingeniero'], c: ['rh', 'rh'] })
    e.jugadores[2].cartas[0].revelada = true // c pierde un RH
    e.jugadores[0].cartas[1].revelada = true // a pierde un CEO
    e.jugadores[0].cartas[0].revelada = true // y un RH: a queda eliminado
    e.jugadores[0].eliminado = true
    const d = calcularDescarte(proyectarEstado(e, 'b'))
    expect(d.total).toBe(3)
    expect(d.grupos.map((g) => g.jugador.id)).toEqual(['a', 'c']) // b y d no han perdido nada
    expect(d.grupos[0].cartas.map((c) => c.rol)).toEqual(['rh', 'ceo'])
    expect(d.grupos[1].cartas).toEqual([{ rol: 'rh', especial: false }])
  })

  it('marca a los eliminados y a los retirados', () => {
    let e = escenario(4, { a: ['rh', 'ceo'] })
    e.jugadores[1].cartas.forEach((c) => (c.revelada = true))
    e.jugadores[1].eliminado = true
    e = paso(e, { tipo: 'salir', jugador: 'c' }) // c abandona: sus dos cartas van al descarte
    const d = calcularDescarte(proyectarEstado(e, 'a'))
    expect(d.grupos.map((g) => [g.jugador.nombre, g.jugador.estado, g.cartas.length])).toEqual([
      ['J1', 'eliminado', 2],
      ['J2', 'retirado', 2],
    ])
  })

  it('se actualiza con cada estado nuevo (tiempo real)', () => {
    let e = escenario(3, {}, { a: 7 })
    expect(calcularDescarte(proyectarEstado(e, 'c')).total).toBe(0)
    e = paso(e, { tipo: 'elegirAccion', jugador: 'a', accion: 'demandaLaboral', objetivo: 'b' })
    e = paso(e, { tipo: 'pasar', jugador: 'b' })
    e = paso(e, { tipo: 'elegirCartaAPerder', jugador: 'b', cartaId: e.jugadores[1].cartas[0].id })
    const d = calcularDescarte(proyectarEstado(e, 'c'))
    expect(d.total).toBe(1)
    expect(d.grupos[0].jugador.id).toBe('b')
  })

  it('es información pública: idéntica para cualquier jugador y para la mesa', () => {
    const e = escenario(3, { a: ['rh', 'ceo*'], b: ['jefeArea', 'ingeniero'] })
    e.jugadores[0].cartas[1].revelada = true
    e.jugadores[1].cartas[0].revelada = true
    const publico = calcularDescarte(proyectarPublico(e))
    for (const obs of ['a', 'b', 'c']) expect(calcularDescarte(proyectarEstado(e, obs))).toEqual(publico)
  })

  it('no contiene ningún dato oculto: ni ids de carta, ni cartas vivas', () => {
    const e = escenario(3, { a: ['rh', 'ceo'], b: ['jefeArea', 'ingeniero'] })
    e.jugadores[0].cartas[0].revelada = true
    const texto = JSON.stringify(calcularDescarte(proyectarEstado(e, 'b')))
    expect(texto).not.toMatch(/"id":\s*\d/) // ningún id numérico de carta
    expect(texto).not.toContain('ceo') // la carta viva de a no aparece
    expect(texto).not.toContain('ingeniero') // ni la del propio observador
  })

  it('conserva el distintivo de carta especial', () => {
    const e = escenario(3, { a: ['ceo*', 'rh'] })
    e.jugadores[0].cartas[0].revelada = true
    expect(calcularDescarte(proyectarEstado(e, 'b')).grupos[0].cartas).toEqual([{ rol: 'ceo', especial: true }])
  })

  it('no comparte referencias con el estado proyectado', () => {
    const e = escenario(3, { a: ['rh', 'ceo'] })
    e.jugadores[0].cartas[0].revelada = true
    const p = proyectarEstado(e, 'b')
    const d = calcularDescarte(p)
    d.grupos[0].cartas.push({ rol: 'ceo', especial: false })
    expect(p.jugadores[0].cartasReveladas).toHaveLength(1)
  })
})
