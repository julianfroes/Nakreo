import { describe, expect, it } from 'vitest'
import readme from '../../README.md?raw'
import { DEMANDA_COSTE, DESPIDO_COSTE, MIN_JUGADORES, maxJugadores } from '../game/config'
import { ACCIONES, TODOS_LOS_ROLES } from '../game/roles'
import type { TipoAccion } from '../game/types'
import {
  FICHAS_ROLES,
  cartasEnMazo,
  describirModo,
  filaMarkdown,
  nombreModo,
  rolesVisibles,
  seccionesReglas,
  tablaAcciones,
} from './reglasContenido'

const fila = (tipo: TipoAccion) => tablaAcciones().find((f) => f.tipo === tipo)!

describe('contenido de reglas: acciones', () => {
  it('cubre todas las acciones del motor, una vez cada una', () => {
    const tipos = tablaAcciones().map((f) => f.tipo)
    expect(new Set(tipos).size).toBe(tipos.length)
    expect([...tipos].sort()).toEqual((Object.keys(ACCIONES) as TipoAccion[]).sort())
  })

  it('los costes salen del motor', () => {
    expect(fila('demandaLaboral').coste).toBe(DEMANDA_COSTE)
    expect(fila('despido').coste).toBe(DESPIDO_COSTE)
    expect(fila('sueldoMinimo').coste).toBe(0)
  })

  it('tabla de bloqueos vigente', () => {
    // Demanda laboral: solo la frena la Contrademanda del Sindicalizado Especial.
    expect(fila('demandaLaboral').bloqueablePor).toBe(
      'Quien la recibe, con Sindicalizado Especial (Contrademanda, un solo uso)',
    )
    // La Renuncia «voluntaria» solo la frena el Sindicalizado Especial (ni el normal ni el Ingeniero).
    expect(fila('renuncia').bloqueablePor).toBe(
      'Quien la recibe, con Sindicalizado Especial (Contrademanda, un solo uso)',
    )
    expect(fila('despido').bloqueablePor).toBe('Quien la recibe, con Sindicalizado')
    expect(fila('nomina').bloqueablePor).toBe('Cualquier otro jugador, con RH')
    expect(fila('roboMerito').bloqueablePor).toBe('Quien la recibe, con Jefe de Área o Ingeniero')
    for (const t of ['sueldoMinimo', 'malversacion', 'roboAguinaldo', 'reasignacion'] as const) {
      expect(fila(t).bloqueablePor).toBeNull()
    }
  })

  it('las acciones de rol indican la carta requerida', () => {
    expect(fila('despido').requiere).toBe('CEO')
    expect(fila('renuncia').requiere).toBe('CEO Especial')
    expect(fila('malversacion').requiere).toBe('RH')
    expect(fila('roboAguinaldo').requiere).toBe('RH Especial')
    expect(fila('roboMerito').requiere).toBe('Jefe de Área')
    expect(fila('reasignacion').requiere).toBe('Ingeniero')
    expect(fila('demandaLaboral').requiere).toBeNull()
  })

  it('la tabla del README coincide con el motor (fila por fila)', () => {
    for (const f of tablaAcciones()) expect(readme).toContain(filaMarkdown(f))
  })
})

describe('contenido de reglas: roles y reglas generales', () => {
  it('hay una ficha completa por rol', () => {
    for (const rol of TODOS_LOS_ROLES) {
      const ficha = FICHAS_ROLES[rol]
      expect(ficha.resumen.length).toBeGreaterThan(10)
      expect(ficha.especial.descripcion).toContain(ficha.especial.nombre)
    }
    // Solo tres habilidades son de un solo uso.
    const unicas = TODOS_LOS_ROLES.filter((r) => FICHAS_ROLES[r].especial.unSoloUso)
    expect(unicas.sort()).toEqual(['ingeniero', 'jefeArea', 'sindicalizado'])
  })

  it('las reglas generales tienen secciones únicas y con contenido', () => {
    for (const especiales of [true, false]) {
      const secciones = seccionesReglas(especiales)
      const ids = secciones.map((s) => s.id)
      expect(new Set(ids).size).toBe(ids.length)
      for (const s of secciones) expect(s.puntos.length).toBeGreaterThan(0)
    }
  })

  it('el Ingeniero Especial puede explotar el site ante Demanda, Despido y Renuncia', () => {
    const t = FICHAS_ROLES.ingeniero.especial.descripcion
    expect(t).toMatch(/Demanda laboral/)
    expect(t).toMatch(/Despido/)
    expect(t).toMatch(/Renuncia/)
  })
})

describe('contenido de reglas: modo sin roles especiales', () => {
  it('quita las acciones especiales y hace la Demanda laboral no bloqueable', () => {
    const tabla = tablaAcciones(false)
    expect(tabla).toHaveLength(7)
    const tipos = tabla.map((f) => f.tipo)
    expect(tipos).not.toContain('roboAguinaldo')
    expect(tipos).not.toContain('renuncia')
    expect(tabla.find((f) => f.tipo === 'demandaLaboral')!.bloqueablePor).toBeNull()
    // El resto de bloqueos no cambia.
    expect(tabla.find((f) => f.tipo === 'despido')!.bloqueablePor).toBe('Quien la recibe, con Sindicalizado')
  })

  it('las reglas del modo base no mencionan cartas especiales y dan su mazo y aforo', () => {
    const base = seccionesReglas(false)
    const ids = base.map((s) => s.id)
    for (const id of ['especiales', 'riesgo', 'unSoloUso']) expect(ids).not.toContain(id)
    const inicio = base.find((s) => s.id === 'inicio')!.puntos.join(' ')
    expect(inicio).toContain('15 cartas')
    expect(inicio).toContain('2 a 6 jugadores')

    const completo = seccionesReglas(true)
    expect(completo.map((s) => s.id)).toEqual(expect.arrayContaining(['especiales', 'riesgo', 'unSoloUso']))
    const inicioCompleto = completo.find((s) => s.id === 'inicio')!.puntos.join(' ')
    expect(inicioCompleto).toContain('20 cartas')
    expect(inicioCompleto).toContain('2 a 8 jugadores')
  })

  it('describe cada modo con su aforo y su mazo', () => {
    expect(describirModo(true)).toBe('Hasta 8 jugadores · mazo de 20 cartas · con cartas y habilidades especiales')
    expect(describirModo(false)).toBe('Hasta 6 jugadores · mazo de 15 cartas · sin cartas ni habilidades especiales')
  })

  it('el README documenta el aforo y el mazo de cada modo', () => {
    for (const especiales of [true, false]) {
      const fila = `| ${nombreModo(especiales)} | ${cartasEnMazo(especiales)} cartas | ${MIN_JUGADORES} a ${maxJugadores(especiales)} |`
      expect(readme).toContain(fila)
    }
  })
})

describe('contenido de reglas: bloquear o explotar el site', () => {
  const puntos = (especiales: boolean) =>
    seccionesReglas(especiales).find((s) => s.id === 'bloqueos')!.puntos.join(' ')

  it('explica que alegar no exige la carta y que el Ingeniero normal no bloquea el Despido', () => {
    for (const especiales of [true, false]) {
      expect(puntos(especiales)).toContain('Alegar')
      expect(puntos(especiales)).toContain('El Ingeniero normal no puede bloquear el Despido')
    }
  })

  it('con roles especiales explica las opciones a la vez y la segunda oportunidad; sin ellos no', () => {
    expect(puntos(true)).toContain('explotar el site')
    expect(puntos(true)).toContain('aún puedes explotar el site')
    expect(puntos(false)).not.toContain('explotar el site')
  })

  it('el Ingeniero Especial puede explotar en lugar de bloquear o después si su bloqueo cae', () => {
    expect(FICHAS_ROLES.ingeniero.especial.descripcion).toContain('en lugar de bloquear')
  })

  it('el Despido solo lo bloquea el Sindicalizado (el Ingeniero no figura)', () => {
    expect(fila('despido').bloqueablePor).toBe('Quien la recibe, con Sindicalizado')
    expect(fila('despido').bloqueablePor).not.toMatch(/Ingeniero/)
  })
})

describe('contenido de reglas: guía rápida y reglas completas', () => {
  it('rolesVisibles: sin roles especiales no hay habilidad especial', () => {
    expect(rolesVisibles(true).every((r) => r.especial !== null)).toBe(true)
    expect(rolesVisibles(false).every((r) => r.especial === null)).toBe(true)
    expect(rolesVisibles(false).map((r) => r.rol).sort()).toEqual([...TODOS_LOS_ROLES].sort())
  })

  it('«Se bloquea» se lee sin ambigüedad: quién la recibe, con qué rol', () => {
    expect(fila('despido').bloqueablePor).toBe('Quien la recibe, con Sindicalizado')
    expect(fila('nomina').bloqueablePor).toBe('Cualquier otro jugador, con RH')
    expect(fila('roboMerito').bloqueablePor).toBe('Quien la recibe, con Jefe de Área o Ingeniero')
    expect(fila('demandaLaboral').bloqueablePor).toBe(
      'Quien la recibe, con Sindicalizado Especial (Contrademanda, un solo uso)',
    )
    // Nada de la jerga confusa de antes.
    for (const f of tablaAcciones()) expect(f.bloqueablePor ?? '').not.toMatch(/\(el objetivo|\(cualquiera/)
  })

  it('las reglas completas cubren el descarte y salir de la partida, en ambos modos', () => {
    for (const especiales of [true, false]) {
      const secciones = seccionesReglas(especiales)
      expect(secciones.find((s) => s.id === 'eliminacion')!.puntos.join(' ')).toContain('descarte')
      expect(secciones.find((s) => s.id === 'salir')!.puntos.join(' ')).toContain('no podrás reingresar')
    }
  })
})
