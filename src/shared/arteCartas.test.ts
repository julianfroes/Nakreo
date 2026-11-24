import { describe, expect, it } from 'vitest'
import { crearRng } from '../game/rng'
import { crearPartida } from '../game/setup'
import { claveArte } from './arteCartas'

describe('claveArte', () => {
  const ids = [{ id: 'a', nombre: 'A' }, { id: 'b', nombre: 'B' }]

  it('cada carta física del mazo (20) tiene una clave de arte distinta', () => {
    const e = crearPartida(ids, crearRng(3))
    const claves = [...e.mazo, ...e.jugadores.flatMap((j) => j.cartas)].map(claveArte)
    expect(new Set(claves).size).toBe(20)
    expect(claves).toContain('ceo-1')
    expect(claves).toContain('sindicalizado-especial')
  })

  it('sin especiales las 15 cartas normales conservan sus mismas claves', () => {
    const e = crearPartida(ids, crearRng(3), { especiales: false })
    const claves = [...e.mazo, ...e.jugadores.flatMap((j) => j.cartas)].map(claveArte)
    expect(new Set(claves).size).toBe(15)
    expect(claves.every((c) => /-[123]$/.test(c))).toBe(true)
  })
})
