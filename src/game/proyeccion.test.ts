import { describe, expect, it } from 'vitest'
import { aplicar } from './engine'
import { proyectarEstado, proyectarPublico } from './proyeccion'
import { crearRng, type Rng } from './rng'
import { ACCIONES } from './roles'
import { crearPartida } from './setup'
import type { EstadoJuego, Intencion, TipoAccion } from './types'

const ids = (n: number) =>
  Array.from({ length: n }, (_, k) => ({ id: 'abcdefgh'[k], nombre: `J${k}` }))

/** Ids de cartas físicas que `observador` NO debe poder ver en ningún punto. */
function idsOcultos(e: EstadoJuego, observador: string): Set<number> {
  const ocultos = new Set<number>()
  for (const c of e.mazo) ocultos.add(c.id)
  for (const j of e.jugadores) {
    if (j.id === observador) continue
    for (const c of j.cartas) if (!c.revelada) ocultos.add(c.id)
  }
  if (e.fase.tipo === 'reasignando' && e.fase.jugador !== observador) {
    for (const c of e.fase.robadas) ocultos.add(c.id)
  }
  return ocultos
}

/** Recorre cualquier estructura y devuelve el id de todo objeto que parezca una carta. */
function idsDeCartasEn(valor: unknown, salida = new Set<number>()): Set<number> {
  if (Array.isArray(valor)) valor.forEach((v) => idsDeCartasEn(v, salida))
  else if (valor && typeof valor === 'object') {
    const o = valor as Record<string, unknown>
    if (typeof o.id === 'number') salida.add(o.id) // los ids de jugador son string
    Object.values(o).forEach((v) => idsDeCartasEn(v, salida))
  }
  return salida
}

/** Comprobaciones de seguridad para TODOS los observadores de un estado. */
function verificarSeguridad(e: EstadoJuego) {
  verificarPublico(e)
  for (const obs of e.jugadores) {
    const p = proyectarEstado(e, obs.id)
    const visibles = idsDeCartasEn(p)
    const ocultos = idsOcultos(e, obs.id)

    // 1. Ninguna carta oculta (ajena o del mazo) aparece en ningún rincón.
    for (const id of visibles) expect(ocultos.has(id)).toBe(false)

    // 2. Estructura exacta: no hay campos extra (p. ej. `mazo` o `cartas`).
    expect(Object.keys(p).sort()).toEqual(
      ['especiales', 'fase', 'jugadorActivo', 'jugadores', 'mazoRestante', 'registro', 'turno', 'yo'],
    )
    for (const jp of p.jugadores) {
      expect(Object.keys(jp).sort()).toEqual(
        ['cartasReveladas', 'cartasVivas', 'creditos', 'eliminado', 'id', 'nombre', 'retirado'],
      )
      const real = e.jugadores.find((j) => j.id === jp.id)!
      // Solo el rol de las cartas ya perdidas; de las vivas, solo la cantidad.
      expect(jp.cartasReveladas).toEqual(
      real.cartas.filter((c) => c.revelada).map((c) => ({ rol: c.rol, especial: !!c.especial })),
    )
      expect(jp.cartasVivas).toBe(real.cartas.filter((c) => !c.revelada).length)
    }

    // 3. Mi mano es exactamente la mía.
    expect(p.yo.mano.map((c) => c.id)).toEqual(obs.cartas.map((c) => c.id))

    // 4. `robadas` solo para su dueño.
    if (p.fase.tipo === 'reasignando') {
      expect('robadas' in p.fase).toBe(p.fase.jugador === obs.id)
    }

    // 4b. (se comprueba la vista pública una vez, tras el bucle)
    // 5. Sin referencias compartidas con el estado del host.
    const antes = JSON.stringify(e)
    p.yo.mano.forEach((c) => (c.rol = 'ceo'))
    p.jugadores.forEach((j) => j.cartasReveladas.push({ rol: 'ceo', especial: false }))
    p.registro.push({ tipo: 'partidaTerminada', ganador: 'x' })
    expect(JSON.stringify(e)).toBe(antes)
  }
}

/** La vista pública (pantalla del host) no debe contener NINGUNA carta con id ni mano. */
function verificarPublico(e: EstadoJuego) {
  const p = proyectarPublico(e)
  expect(Object.keys(p).sort()).toEqual(['especiales', 'fase', 'jugadorActivo', 'jugadores', 'mazoRestante', 'registro', 'turno'])
  expect(idsDeCartasEn(p).size).toBe(0) // ni manos, ni mazo, ni cartas robadas
  for (const jp of p.jugadores) {
    const real = e.jugadores.find((j) => j.id === jp.id)!
    expect(jp.cartasReveladas).toEqual(
      real.cartas.filter((c) => c.revelada).map((c) => ({ rol: c.rol, especial: !!c.especial })),
    )
    expect(jp.cartasVivas).toBe(real.cartas.filter((c) => !c.revelada).length)
  }
  if (p.fase.tipo === 'reasignando') expect('robadas' in p.fase).toBe(false)
  const antes = JSON.stringify(e)
  p.registro.push({ tipo: 'partidaTerminada', ganador: 'x' })
  p.jugadores.forEach((j) => j.cartasReveladas.push({ rol: 'ceo', especial: false }))
  expect(JSON.stringify(e)).toBe(antes)
}

describe('proyectarEstado', () => {
  it.each([2, 3, 4, 5, 6, 7, 8])('partida inicial de %i jugadores: sin fugas', (n) => {
    verificarSeguridad(crearPartida(ids(n), crearRng(n)))
  })

  it('un jugador ve su mano completa y de los demás solo el conteo', () => {
    const e = crearPartida(ids(3), crearRng(3))
    const p = proyectarEstado(e, 'b')
    expect(p.yo.mano).toEqual(e.jugadores[1].cartas)
    expect(p.jugadores.find((j) => j.id === 'a')).toEqual({
      id: 'a', nombre: 'J0', creditos: 2, eliminado: false, retirado: false, cartasVivas: 2, cartasReveladas: [],
    })
    expect(p.mazoRestante).toBe(e.mazo.length)
  })

  it('las cartas perdidas de otros sí son visibles; las vivas no', () => {
    const e = crearPartida(ids(3), crearRng(3))
    e.jugadores[0].cartas[0].revelada = true
    const p = proyectarEstado(e, 'c')
    const a = p.jugadores.find((j) => j.id === 'a')!
    expect(a.cartasReveladas).toEqual([{ rol: e.jugadores[0].cartas[0].rol, especial: false }])
    expect(a.cartasVivas).toBe(1)
    verificarSeguridad(e)
  })

  it('el registro público incluye eventos pero ningún id de carta oculta', () => {
    let e = crearPartida(ids(3), crearRng(5))
    const r = aplicar(e, { tipo: 'elegirAccion', jugador: 'a', accion: 'sueldoMinimo' })
    if (!r.ok) throw new Error('ilegal')
    e = r.estado
    expect(proyectarEstado(e, 'b').registro).toEqual(e.registro)
    expect(e.registro.length).toBeGreaterThan(1)
  })

  it('las cartas robadas por el Ingeniero solo las ve su dueño', () => {
    let e = crearPartida(ids(3), crearRng(9))
    e.jugadores[0].cartas[0] = { id: 900, rol: 'ingeniero', revelada: false }
    for (const intencion of [
      { tipo: 'elegirAccion', jugador: 'a', accion: 'reasignacion' },
      { tipo: 'pasar', jugador: 'b' },
      { tipo: 'pasar', jugador: 'c' },
    ] as Intencion[]) {
      const r = aplicar(e, intencion)
      if (!r.ok) throw new Error(r.error.mensaje)
      e = r.estado
    }
    if (e.fase.tipo !== 'reasignando') throw new Error('fase inesperada')
    const robadas = e.fase.robadas.map((c) => c.id)

    const pa = proyectarEstado(e, 'a')
    expect(pa.fase.tipo === 'reasignando' && pa.fase.robadas?.map((c) => c.id)).toEqual(robadas)
    for (const otro of ['b', 'c']) {
      const po = proyectarEstado(e, otro)
      expect(po.fase).toEqual({ tipo: 'reasignando', jugador: 'a' })
      const vistos = idsDeCartasEn(po)
      for (const id of robadas) expect(vistos.has(id)).toBe(false)
    }
    verificarSeguridad(e)
  })

  it('rechaza un jugador desconocido', () => {
    expect(() => proyectarEstado(crearPartida(ids(2)), 'zzz')).toThrow()
  })
})

// ---------------------------------------------------------------------------
// Fuzz: partidas simuladas con intenciones legales aleatorias. En CADA paso se
// verifica la seguridad de la proyección para todos los observadores.
// ---------------------------------------------------------------------------

function intencionesCandidatas(e: EstadoJuego, rng: Rng): Intencion[] {
  const f = e.fase
  const out: Intencion[] = []
  const vivos = e.jugadores.filter((j) => !j.eliminado)
  switch (f.tipo) {
    case 'accion':
      for (const accion of Object.keys(ACCIONES) as TipoAccion[]) {
        if (ACCIONES[accion].necesitaObjetivo) {
          for (const o of vivos) out.push({ tipo: 'elegirAccion', jugador: e.jugadorActivo, accion, objetivo: o.id })
        } else out.push({ tipo: 'elegirAccion', jugador: e.jugadorActivo, accion })
      }
      break
    case 'ventanaDesafioAccion':
    case 'ventanaBloqueo':
    case 'ventanaDesafioBloqueo':
    case 'ventanaIngeniero':
    case 'ventanaDesafioReaccion':
      for (const jugador of f.pendientes) {
        out.push({ tipo: 'pasar', jugador })
        if (f.tipo !== 'ventanaIngeniero') out.push({ tipo: 'desafiar', jugador })
        else out.push({ tipo: 'explotarSite', jugador })
        // El objetivo de un ataque también puede explotar el site desde la ventana de bloqueo.
        if (f.tipo === 'ventanaBloqueo' && f.explosion) out.push({ tipo: 'explotarSite', jugador })
        const reclamos = f.tipo === 'ventanaBloqueo' ? ACCIONES[f.accion.tipo].bloqueablePor : []
        for (const r of reclamos) out.push({ tipo: 'bloquear', jugador, rol: r.rol, especial: r.especial })
      }
      break
    case 'revelacion': {
      const a = e.jugadores.find((j) => j.id === f.acusado)!
      if (f.origen !== 'reaccion') out.push({ tipo: 'salvarse', jugador: a.id })
      for (const c of a.cartas) {
        if (c.revelada) continue
        out.push({ tipo: 'revelarCarta', jugador: a.id, cartaId: c.id })
        out.push({ tipo: 'rendirse', jugador: a.id, cartaId: c.id })
      }
      break
    }
    case 'perdiendoCarta': {
      const j = e.jugadores.find((x) => x.id === f.jugador)!
      for (const c of j.cartas) if (!c.revelada) out.push({ tipo: 'elegirCartaAPerder', jugador: j.id, cartaId: c.id })
      break
    }
    case 'reasignando': {
      const j = e.jugadores.find((x) => x.id === f.jugador)!
      const pool = [...j.cartas.filter((c) => !c.revelada), ...f.robadas].map((c) => c.id)
      const n = j.cartas.filter((c) => !c.revelada).length
      for (let k = 0; k < 6; k++) {
        out.push({ tipo: 'confirmarReasignacion', jugador: j.id, conservar: pool.slice().sort(() => rng() - 0.5).slice(0, n) })
      }
      break
    }
    case 'fin':
      break
  }
  return out
}

/** Fases que solo existen con roles especiales. */
const FASES_ESPECIALES = ['ventanaIngeniero', 'ventanaDesafioReaccion']

/** Total de abandonos simulados (para comprobar que el fuzz los ejercita). */
let salidas = 0

function simular(n: number, semilla: number, pasosMax: number, especiales = true) {
  const rng: Rng = crearRng(semilla)
  let e = crearPartida(ids(n), rng, { especiales })
  let terminada = false
  for (let paso = 0; paso < pasosMax && e.fase.tipo !== 'fin'; paso++) {
    verificarSeguridad(e)
    if (!especiales) {
      // Sin roles especiales: ninguna carta especial, ninguna fase especial y el modo es público.
      const cartas = [...e.mazo, ...e.jugadores.flatMap((x) => x.cartas)]
      expect(cartas.some((c) => c.especial)).toBe(false)
      expect(FASES_ESPECIALES).not.toContain(e.fase.tipo)
      if (e.fase.tipo === 'ventanaBloqueo') expect(e.fase.explosion).toBe(false)
      expect(proyectarEstado(e, e.jugadorActivo).especiales).toBe(false)
      expect(proyectarPublico(e).especiales).toBe(false)
    }
    const legales: { estado: EstadoJuego }[] = []
    for (const i of intencionesCandidatas(e, rng)) {
      const r = aplicar(e, i, rng)
      if (r.ok) legales.push({ estado: r.estado })
    }
    // Sin contar «salir» (siempre es legal), debe haber alguna jugada: si no, la partida quedó atascada.
    if (legales.length === 0) throw new Error(`Sin movimientos legales en fase ${e.fase.tipo}`)
    e = legales[Math.floor(rng() * legales.length)].estado
    // De vez en cuando alguien abandona, en cualquier fase.
    if (e.fase.tipo !== 'fin' && rng() < 0.04) {
      const vivos = e.jugadores.filter((x) => !x.eliminado)
      const quien = vivos[Math.floor(rng() * vivos.length)]
      const r = aplicar(e, { tipo: 'salir', jugador: quien.id }, rng)
      if (!r.ok) throw new Error(`«salir» debería ser legal: ${r.error.mensaje}`)
      e = r.estado
      salidas++
      expect(e.jugadores.find((x) => x.id === quien.id)).toMatchObject({ retirado: true, eliminado: true })
    }
  }
  verificarSeguridad(e)
  terminada = e.fase.tipo === 'fin'
  return terminada
}

describe('fuzz: partidas aleatorias sin fugas en ningún paso', () => {
  it.each([2, 3, 4, 5, 6, 7, 8])('%i jugadores', (n) => {
    let terminadas = 0
    for (let s = 1; s <= 6; s++) if (simular(n, s * 100 + n, 400)) terminadas++
    // Al menos algunas partidas deben llegar al final para que el fuzz explore bien.
    expect(terminadas).toBeGreaterThan(0)
  })
})

describe('fuzz: modo sin roles especiales', () => {
  it.each([2, 3, 4, 5, 6])('%i jugadores', (n) => {
    let terminadas = 0
    for (let s = 1; s <= 6; s++) if (simular(n, s * 100 + n, 400, false)) terminadas++
    expect(terminadas).toBeGreaterThan(0)
  })
})

describe('fuzz: abandonos', () => {
  it('las partidas simuladas incluyeron jugadores que se retiraron en distintas fases', () => {
    expect(salidas).toBeGreaterThan(20)
  })
})
