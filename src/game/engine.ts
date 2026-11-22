/**
 * Motor de reglas: funciones puras, sin red ni UI.
 *
 *   aplicar(estado, intencion, rng) -> { ok, estado, eventos } | { ok:false, error }
 *
 * - No muta el estado recibido (trabaja sobre un clon).
 * - Una intención ilegal devuelve error y el estado original queda intacto.
 * - Los eventos devueltos son públicos (ver `EventoJuego`).
 */
import {
  CARTAS_REASIGNACION,
  GANANCIA_DIVIDENDOS,
  GANANCIA_INGRESO,
  GANANCIA_SUBSIDIO,
  LIMITE_CREDITOS,
  ROBO_DESVIO,
} from './config'
import { barajar, type Rng } from './rng'
import { ACCIONES } from './roles'
import type {
  Accion,
  CartaEnMano,
  CodigoError,
  Continuacion,
  ErrorJuego,
  EstadoJuego,
  EventoJuego,
  Intencion,
  Jugador,
} from './types'

export type Resultado =
  | { ok: true; estado: EstadoJuego; eventos: EventoJuego[] }
  | { ok: false; error: ErrorJuego }

interface Ctx {
  estado: EstadoJuego
  eventos: EventoJuego[]
  rng: Rng
}

class ErrorIntencion extends Error {
  codigo: CodigoError
  constructor(codigo: CodigoError, mensaje: string) {
    super(mensaje)
    this.codigo = codigo
  }
}

const fallar = (codigo: CodigoError, mensaje: string): never => {
  throw new ErrorIntencion(codigo, mensaje)
}

// ------------------------------------------------------------------ Utilidades

function jugadorPorId(estado: EstadoJuego, id: string): Jugador {
  const j = estado.jugadores.find((x) => x.id === id)
  if (!j) return fallar('jugadorInvalido', `Jugador desconocido: ${id}`)
  return j
}

/** Ids de los demás jugadores vivos, en orden de turno. */
function otrosVivos(estado: EstadoJuego, id: string): string[] {
  return estado.jugadores.filter((j) => !j.eliminado && j.id !== id).map((j) => j.id)
}

const cartasVivas = (j: Jugador): CartaEnMano[] => j.cartas.filter((c) => !c.revelada)

function cambiarCreditos(ctx: Ctx, j: Jugador, delta: number) {
  if (delta === 0) return
  j.creditos += delta
  ctx.eventos.push({ tipo: 'creditosCambiados', jugador: j.id, delta })
}

function exigirPendiente(pendientes: string[], jugador: string) {
  if (!pendientes.includes(jugador)) {
    fallar('noPuedesResponder', 'No puedes responder en este momento')
  }
}

// ------------------------------------------------------- Pérdida de cartas/fin

/** Marca una carta como perdida (pública). Elimina al jugador y detecta el fin. */
function perderCartaEspecifica(ctx: Ctx, jugadorId: string, cartaId: number) {
  const { estado, eventos } = ctx
  const j = jugadorPorId(estado, jugadorId)
  const carta = j.cartas.find((c) => c.id === cartaId && !c.revelada)
  if (!carta) return fallar('cartaInvalida', 'Esa carta no está disponible')

  carta.revelada = true
  eventos.push({ tipo: 'cartaPerdida', jugador: j.id, rol: carta.rol })

  if (j.cartas.every((c) => c.revelada)) {
    j.eliminado = true
    j.creditos = 0
    eventos.push({ tipo: 'jugadorEliminado', jugador: j.id })

    // Detección de fin de partida: queda un solo jugador vivo.
    const vivos = estado.jugadores.filter((x) => !x.eliminado)
    if (vivos.length === 1) {
      estado.fase = { tipo: 'fin', ganador: vivos[0].id }
      eventos.push({ tipo: 'partidaTerminada', ganador: vivos[0].id })
    }
  }
}

/** El jugador pierde una carta: automática si solo le queda una; si no, elige. */
function perderCarta(ctx: Ctx, jugadorId: string, continuacion: Continuacion) {
  const vivas = cartasVivas(jugadorPorId(ctx.estado, jugadorId))
  if (vivas.length === 1) {
    perderCartaEspecifica(ctx, jugadorId, vivas[0].id)
    continuar(ctx, continuacion)
  } else {
    ctx.estado.fase = { tipo: 'perdiendoCarta', jugador: jugadorId, continuacion }
  }
}

// ------------------------------------------------------------ Flujo del turno

function continuar(ctx: Ctx, c: Continuacion) {
  if (ctx.estado.fase.tipo === 'fin') return
  switch (c.tipo) {
    case 'finTurno':
      return finTurno(ctx)
    case 'seguirAccion':
      return etapaBloqueo(ctx, c.accion)
    case 'resolverAccion':
      return resolver(ctx, c.accion)
    case 'cancelarAccion':
      return cancelar(ctx, c.accion, c.reembolso)
  }
}

function finTurno(ctx: Ctx) {
  const { estado, eventos } = ctx
  if (estado.fase.tipo === 'fin') return
  const js = estado.jugadores
  let idx = js.findIndex((j) => j.id === estado.jugadorActivo)
  do {
    idx = (idx + 1) % js.length
  } while (js[idx].eliminado)
  estado.jugadorActivo = js[idx].id
  estado.turno += 1
  estado.fase = { tipo: 'accion' }
  eventos.push({ tipo: 'turnoIniciado', jugador: js[idx].id, turno: estado.turno })
}

function cancelar(ctx: Ctx, accion: Accion, reembolso: boolean) {
  const actor = jugadorPorId(ctx.estado, accion.actor)
  ctx.eventos.push({ tipo: 'accionCancelada', accion })
  if (reembolso && !actor.eliminado) cambiarCreditos(ctx, actor, ACCIONES[accion.tipo].coste)
  finTurno(ctx)
}

/** Tras superar (o no tener) la ventana de desafío: abre la de bloqueo si aplica. */
function etapaBloqueo(ctx: Ctx, accion: Accion) {
  const { estado } = ctx
  const def = ACCIONES[accion.tipo]
  if (def.bloqueablePor.length === 0) return resolver(ctx, accion)

  let pendientes: string[]
  if (def.soloObjetivoBloquea) {
    const obj = accion.objetivo ? jugadorPorId(estado, accion.objetivo) : null
    pendientes = obj && !obj.eliminado ? [obj.id] : []
  } else {
    pendientes = otrosVivos(estado, accion.actor)
  }
  if (pendientes.length === 0) return resolver(ctx, accion)
  estado.fase = { tipo: 'ventanaBloqueo', accion, pendientes }
}

/** Aplica el efecto de la acción. */
function resolver(ctx: Ctx, accion: Accion) {
  const { estado } = ctx
  const actor = jugadorPorId(estado, accion.actor)
  const objetivo = accion.objetivo ? jugadorPorId(estado, accion.objetivo) : null

  // El objetivo pudo ser eliminado durante la cadena de desafíos: la acción se
  // desvanece y se devuelve el coste.
  if (objetivo?.eliminado) return cancelar(ctx, accion, true)

  switch (accion.tipo) {
    case 'ingreso':
      cambiarCreditos(ctx, actor, GANANCIA_INGRESO)
      return finTurno(ctx)
    case 'subsidio':
      cambiarCreditos(ctx, actor, GANANCIA_SUBSIDIO)
      return finTurno(ctx)
    case 'dividendos':
      cambiarCreditos(ctx, actor, GANANCIA_DIVIDENDOS)
      return finTurno(ctx)
    case 'desvio': {
      const robo = Math.min(ROBO_DESVIO, objetivo!.creditos)
      cambiarCreditos(ctx, objetivo!, -robo)
      cambiarCreditos(ctx, actor, robo)
      return finTurno(ctx)
    }
    case 'golpe':
    case 'sabotaje':
      return perderCarta(ctx, objetivo!.id, { tipo: 'finTurno' })
    case 'reasignacion': {
      const robadas = estado.mazo.splice(0, CARTAS_REASIGNACION)
      if (robadas.length === 0) return finTurno(ctx)
      estado.fase = { tipo: 'reasignando', jugador: actor.id, robadas }
      return
    }
  }
}

// ------------------------------------------------------------------ Handlers

function elegirAccion(ctx: Ctx, i: Extract<Intencion, { tipo: 'elegirAccion' }>) {
  const { estado, eventos } = ctx
  if (estado.fase.tipo !== 'accion') return fallar('faseIncorrecta', 'No es momento de elegir acción')
  if (i.jugador !== estado.jugadorActivo) return fallar('noEsTuTurno', 'No es tu turno')

  const actor = jugadorPorId(estado, i.jugador)
  const def = ACCIONES[i.accion]
  if (!def) return fallar('faseIncorrecta', 'Acción desconocida')

  if (def.generaCreditos && actor.creditos >= LIMITE_CREDITOS) {
    return fallar(
      'limiteCreditos',
      `Con ${LIMITE_CREDITOS} o más créditos debes gastar (sabotaje, golpe o reasignación)`,
    )
  }
  if (actor.creditos < def.coste) return fallar('creditosInsuficientes', 'Créditos insuficientes')

  let objetivo: string | null = null
  if (def.necesitaObjetivo) {
    const obj = i.objetivo ? estado.jugadores.find((j) => j.id === i.objetivo) : undefined
    if (!obj || obj.eliminado || obj.id === actor.id) {
      return fallar('objetivoInvalido', 'Objetivo inválido')
    }
    objetivo = obj.id
  }

  const accion: Accion = { tipo: i.accion, actor: actor.id, objetivo }
  eventos.push({ tipo: 'accionDeclarada', accion })
  cambiarCreditos(ctx, actor, -def.coste) // el coste se paga al declarar

  if (def.rolRequerido) {
    estado.fase = {
      tipo: 'ventanaDesafioAccion',
      accion,
      pendientes: otrosVivos(estado, actor.id),
    }
  } else {
    etapaBloqueo(ctx, accion)
  }
}

function desafiar(ctx: Ctx, i: Extract<Intencion, { tipo: 'desafiar' }>) {
  const { estado, eventos } = ctx
  const f = estado.fase
  if (f.tipo === 'ventanaDesafioAccion') {
    exigirPendiente(f.pendientes, i.jugador)
    const rol = ACCIONES[f.accion.tipo].rolRequerido!
    estado.fase = {
      tipo: 'revelacion', accion: f.accion, acusado: f.accion.actor,
      desafiante: i.jugador, rol, origen: 'accion',
    }
    eventos.push({ tipo: 'desafioLanzado', desafiante: i.jugador, acusado: f.accion.actor, rol })
  } else if (f.tipo === 'ventanaDesafioBloqueo') {
    exigirPendiente(f.pendientes, i.jugador)
    estado.fase = {
      tipo: 'revelacion', accion: f.accion, acusado: f.bloqueo.jugador,
      desafiante: i.jugador, rol: f.bloqueo.rol, origen: 'bloqueo',
    }
    eventos.push({
      tipo: 'desafioLanzado', desafiante: i.jugador, acusado: f.bloqueo.jugador, rol: f.bloqueo.rol,
    })
  } else {
    fallar('faseIncorrecta', 'No hay nada que desafiar')
  }
}

function bloquear(ctx: Ctx, i: Extract<Intencion, { tipo: 'bloquear' }>) {
  const { estado, eventos } = ctx
  const f = estado.fase
  if (f.tipo !== 'ventanaBloqueo') return fallar('faseIncorrecta', 'No es momento de bloquear')
  exigirPendiente(f.pendientes, i.jugador)
  if (!ACCIONES[f.accion.tipo].bloqueablePor.includes(i.rol)) {
    return fallar('bloqueoInvalido', 'Ese rol no puede bloquear esta acción')
  }
  eventos.push({ tipo: 'bloqueoDeclarado', bloqueador: i.jugador, rol: i.rol })
  estado.fase = {
    tipo: 'ventanaDesafioBloqueo',
    accion: f.accion,
    bloqueo: { jugador: i.jugador, rol: i.rol },
    // Cualquiera salvo el bloqueador (incluido el actor) puede desafiar el bloqueo.
    pendientes: otrosVivos(estado, i.jugador),
  }
}

function pasar(ctx: Ctx, i: Extract<Intencion, { tipo: 'pasar' }>) {
  const f = ctx.estado.fase
  if (
    f.tipo !== 'ventanaDesafioAccion' &&
    f.tipo !== 'ventanaBloqueo' &&
    f.tipo !== 'ventanaDesafioBloqueo'
  ) {
    return fallar('faseIncorrecta', 'No hay nada a lo que pasar')
  }
  exigirPendiente(f.pendientes, i.jugador)
  f.pendientes = f.pendientes.filter((id) => id !== i.jugador)
  if (f.pendientes.length > 0) return

  // Todos pasaron: la ventana se cierra.
  if (f.tipo === 'ventanaDesafioAccion') etapaBloqueo(ctx, f.accion)
  else if (f.tipo === 'ventanaBloqueo') resolver(ctx, f.accion)
  else cancelar(ctx, f.accion, false) // el bloqueo se sostiene; el coste NO se devuelve
}

/**
 * El acusado muestra una carta. Si es el rol reclamado, gana el desafío:
 * baraja esa carta en el mazo, roba otra y el desafiante pierde una carta.
 * Si no, la carta mostrada se pierde y el farol queda al descubierto.
 */
function revelarCarta(ctx: Ctx, i: Extract<Intencion, { tipo: 'revelarCarta' }>) {
  const { estado, eventos, rng } = ctx
  const f = estado.fase
  if (f.tipo !== 'revelacion') return fallar('faseIncorrecta', 'No hay desafío pendiente')
  if (i.jugador !== f.acusado) return fallar('noPuedesResponder', 'No eres el desafiado')

  const acusado = jugadorPorId(estado, f.acusado)
  const idx = acusado.cartas.findIndex((c) => c.id === i.cartaId && !c.revelada)
  if (idx < 0) return fallar('cartaInvalida', 'Esa carta no está disponible')
  const carta = acusado.cartas[idx]

  eventos.push({ tipo: 'cartaMostrada', jugador: acusado.id, rol: carta.rol })
  const teniaRol = carta.rol === f.rol
  eventos.push({
    tipo: 'desafioResuelto', acusado: acusado.id, desafiante: f.desafiante, acusadoTeniaRol: teniaRol,
  })

  if (teniaRol) {
    // Se devuelve la carta mostrada al mazo, se baraja y se roba una nueva:
    // así el desafiante no gana información sobre la mano futura.
    estado.mazo.push({ id: carta.id, rol: carta.rol })
    estado.mazo = barajar(estado.mazo, rng)
    const nueva = estado.mazo.pop()!
    acusado.cartas[idx] = { ...nueva, revelada: false }
    eventos.push({ tipo: 'cartaIntercambiada', jugador: acusado.id })

    const cont: Continuacion =
      f.origen === 'accion'
        ? { tipo: 'seguirAccion', accion: f.accion }
        : { tipo: 'cancelarAccion', accion: f.accion, reembolso: false } // el bloqueo se sostiene
    perderCarta(ctx, f.desafiante, cont)
  } else {
    const accion = f.accion
    const origen = f.origen
    perderCartaEspecifica(ctx, acusado.id, carta.id)
    continuar(
      ctx,
      origen === 'accion'
        ? { tipo: 'cancelarAccion', accion, reembolso: true } // farol: acción cancelada
        : { tipo: 'resolverAccion', accion }, // bloqueo falso: la acción procede
    )
  }
}

/** Rendirse ante un desafío: cuenta como desafío perdido, sin importar qué carta se pierda. */
function rendirse(ctx: Ctx, i: Extract<Intencion, { tipo: 'rendirse' }>) {
  const { estado, eventos } = ctx
  const f = estado.fase
  if (f.tipo !== 'revelacion') return fallar('faseIncorrecta', 'No hay desafío pendiente')
  if (i.jugador !== f.acusado) return fallar('noPuedesResponder', 'No eres el desafiado')

  const acusado = jugadorPorId(estado, f.acusado)
  if (!acusado.cartas.some((c) => c.id === i.cartaId && !c.revelada)) {
    return fallar('cartaInvalida', 'Esa carta no está disponible')
  }
  eventos.push({
    tipo: 'desafioResuelto', acusado: acusado.id, desafiante: f.desafiante, acusadoTeniaRol: false,
  })
  const { accion, origen } = f
  perderCartaEspecifica(ctx, acusado.id, i.cartaId)
  continuar(
    ctx,
    origen === 'accion'
      ? { tipo: 'cancelarAccion', accion, reembolso: true }
      : { tipo: 'resolverAccion', accion },
  )
}

function elegirCartaAPerder(ctx: Ctx, i: Extract<Intencion, { tipo: 'elegirCartaAPerder' }>) {
  const f = ctx.estado.fase
  if (f.tipo !== 'perdiendoCarta') return fallar('faseIncorrecta', 'Nadie debe perder carta ahora')
  if (i.jugador !== f.jugador) return fallar('noPuedesResponder', 'No te toca elegir')
  const continuacion = f.continuacion
  perderCartaEspecifica(ctx, i.jugador, i.cartaId)
  continuar(ctx, continuacion)
}

function confirmarReasignacion(
  ctx: Ctx,
  i: Extract<Intencion, { tipo: 'confirmarReasignacion' }>,
) {
  const { estado, eventos, rng } = ctx
  const f = estado.fase
  if (f.tipo !== 'reasignando') return fallar('faseIncorrecta', 'No hay reasignación pendiente')
  if (i.jugador !== f.jugador) return fallar('noPuedesResponder', 'No te toca elegir')

  const jugador = jugadorPorId(estado, f.jugador)
  const reveladas = jugador.cartas.filter((c) => c.revelada)
  const pool = [
    ...cartasVivas(jugador).map((c) => ({ id: c.id, rol: c.rol })),
    ...f.robadas,
  ]
  const conservar = new Set(i.conservar)
  const vivasCount = jugador.cartas.length - reveladas.length
  if (
    conservar.size !== i.conservar.length ||
    conservar.size !== vivasCount ||
    ![...conservar].every((id) => pool.some((c) => c.id === id))
  ) {
    return fallar('cartaInvalida', `Debes conservar exactamente ${vivasCount} carta(s) válidas`)
  }

  const quedan = pool.filter((c) => conservar.has(c.id))
  const devueltas = pool.filter((c) => !conservar.has(c.id))
  jugador.cartas = [...reveladas, ...quedan.map((c) => ({ ...c, revelada: false }))]
  estado.mazo = barajar([...estado.mazo, ...devueltas], rng)
  eventos.push({ tipo: 'reasignacionRealizada', jugador: jugador.id })
  finTurno(ctx)
}

// ------------------------------------------------------------------ API pública

export function aplicar(
  estadoOriginal: EstadoJuego,
  intencion: Intencion,
  rng: Rng = Math.random,
): Resultado {
  const ctx: Ctx = { estado: structuredClone(estadoOriginal), eventos: [], rng }
  try {
    const j = jugadorPorId(ctx.estado, intencion.jugador)
    if (j.eliminado) return fallar('jugadorInvalido', 'Jugador eliminado')

    switch (intencion.tipo) {
      case 'elegirAccion': elegirAccion(ctx, intencion); break
      case 'desafiar': desafiar(ctx, intencion); break
      case 'bloquear': bloquear(ctx, intencion); break
      case 'pasar': pasar(ctx, intencion); break
      case 'revelarCarta': revelarCarta(ctx, intencion); break
      case 'rendirse': rendirse(ctx, intencion); break
      case 'elegirCartaAPerder': elegirCartaAPerder(ctx, intencion); break
      case 'confirmarReasignacion': confirmarReasignacion(ctx, intencion); break
    }
  } catch (e) {
    if (e instanceof ErrorIntencion) {
      return { ok: false, error: { codigo: e.codigo, mensaje: e.message } }
    }
    throw e
  }
  ctx.estado.registro.push(...ctx.eventos)
  return { ok: true, estado: ctx.estado, eventos: ctx.eventos }
}
