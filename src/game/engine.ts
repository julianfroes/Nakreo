/**
 * Motor de reglas: funciones puras, sin red ni UI.
 *
 *   aplicar(estado, intencion, rng) -> { ok, estado, eventos } | { ok:false, error }
 *
 * - No muta el estado recibido (trabaja sobre un clon).
 * - Una intención ilegal devuelve error y el estado original queda intacto.
 * - Los eventos devueltos son públicos (ver `EventoJuego`).
 *
 * Cartas especiales (una por rol):
 * - Cuentan también como su rol normal; su reclamo especial se declara aparte
 *   y fallarlo (o desafiar mal uno verdadero) cuesta el doble de cartas.
 * - Las habilidades de un solo uso (Sindicalizado, Jefe de Área e
 *   Ingeniero Especiales), si nadie las desafía, devuelven al mazo la mano
 *   viva del jugador, que se baraja y roba la misma cantidad.
 */
import {
  CARTAS_REASIGNACION,
  EXPLOSION_COSTE,
  GANANCIA_MALVERSACION,
  GANANCIA_ROBO_AGUINALDO,
  GANANCIA_SUELDO_MINIMO,
  GANANCIA_NOMINA,
  LIMITE_CREDITOS,
  PENALIZACION_ESPECIAL,
  ROBO_MERITO,
} from './config'
import { barajar, type Rng } from './rng'
import { ACCIONES, accionDisponible, bloqueosVigentes, cumpleReclamo, reclamoDeAccion } from './roles'
import type {
  Accion,
  Carta,
  CartaEnMano,
  CodigoError,
  Continuacion,
  ErrorJuego,
  EstadoJuego,
  EventoJuego,
  Fase,
  Intencion,
  Jugador,
  Reaccion,
  Reclamo,
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

/** Copia de una carta sin el estado de mano (conserva si es especial). */
const aCarta = (c: Pick<Carta, 'id' | 'rol' | 'especial'>): Carta =>
  c.especial ? { id: c.id, rol: c.rol, especial: true } : { id: c.id, rol: c.rol }

/** Cuántas cartas se pierden al fallar un reclamo (el doble si es especial). */
const penalizacion = (r: Reclamo): number => (r.especial ? PENALIZACION_ESPECIAL : 1)

function cambiarCreditos(ctx: Ctx, j: Jugador, delta: number) {
  if (delta === 0) return
  j.creditos += delta
  ctx.eventos.push({ tipo: 'creditosCambiados', jugador: j.id, delta })
}

/**
 * Uso único: el jugador devuelve al mazo todas sus cartas vivas, se baraja
 * (pueden volver a tocarle las mismas) y roba la misma cantidad.
 */
function renovarMano(ctx: Ctx, jugadorId: string) {
  const { estado, eventos, rng } = ctx
  const j = jugadorPorId(estado, jugadorId)
  const vivas = cartasVivas(j)
  if (vivas.length === 0) return
  estado.mazo = barajar([...estado.mazo, ...vivas.map(aCarta)], rng)
  const nuevas = estado.mazo.splice(0, vivas.length)
  j.cartas = [
    ...j.cartas.filter((c) => c.revelada),
    ...nuevas.map((c) => ({ ...c, revelada: false })),
  ]
  eventos.push({ tipo: 'manoRenovada', jugador: j.id })
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
  eventos.push({
    tipo: 'cartaPerdida', jugador: j.id, rol: carta.rol, especial: !!carta.especial,
  })

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

/**
 * El jugador pierde `cantidad` cartas. Si le quedan `cantidad` o menos las
 * pierde todas sin elegir (con 2 cartas, una pérdida doble es la eliminación).
 * Si no, elige cuál perder.
 */
function perderCarta(ctx: Ctx, jugadorId: string, continuacion: Continuacion, cantidad = 1) {
  const vivas = cartasVivas(jugadorPorId(ctx.estado, jugadorId))
  if (cantidad >= vivas.length) {
    for (const c of vivas) perderCartaEspecifica(ctx, jugadorId, c.id)
    continuar(ctx, continuacion)
  } else {
    ctx.estado.fase = { tipo: 'perdiendoCarta', jugador: jugadorId, continuacion }
  }
}

/** Pierde la carta indicada y, si el reclamo era especial, el resto de la penalización. */
function perderPorFarol(
  ctx: Ctx, jugadorId: string, cartaId: number, pen: number, continuacion: Continuacion,
) {
  perderCartaEspecifica(ctx, jugadorId, cartaId)
  if (ctx.estado.fase.tipo === 'fin') return
  if (pen > 1 && !jugadorPorId(ctx.estado, jugadorId).eliminado) {
    return perderCarta(ctx, jugadorId, continuacion, pen - 1)
  }
  continuar(ctx, continuacion)
}

/** Qué ocurre cuando un farol de acción o de bloqueo queda al descubierto. */
const continuacionFallo = (origen: 'accion' | 'bloqueo', accion: Accion): Continuacion =>
  origen === 'accion'
    ? { tipo: 'cancelarAccion', accion, reembolso: true } // farol: acción cancelada
    : { tipo: 'resolverAccion', accion } // bloqueo falso: la acción procede

/** Qué ocurre si el acusado pierde el desafío, según qué se desafió. */
function continuacionDerrota(f: Extract<Fase, { tipo: 'revelacion' }>): Continuacion {
  return f.origen === 'reaccion'
    ? { tipo: 'efectoDirecto', accion: f.accion, reciclarIngeniero: false } // explosión falsa
    : continuacionFallo(f.origen, f.accion)
}

// ------------------------------------------------------------ Flujo del turno

function continuar(ctx: Ctx, c: Continuacion): void {
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
    case 'efectoDirecto':
      return efectoDirecto(ctx, c.accion, c.reciclarIngeniero)
    case 'explosion':
      return explosion(ctx, c.accion, c.usoUnico)
    case 'cierreIngeniero': {
      // Primero se descartó la vida perdida; ahora el resto de la mano vuelve al mazo.
      if (!jugadorPorId(ctx.estado, c.jugador).eliminado) renovarMano(ctx, c.jugador)
      return finTurno(ctx)
    }
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

/**
 * ¿Puede el objetivo de este ataque «explotar el site»? Solo con roles especiales,
 * si el objetivo sigue vivo y tiene con qué pagar (dato público). Se le ofrece tenga
 * o no la carta (puede ser un farol), para no delatar su mano.
 */
function puedeExplotar(estado: EstadoJuego, accion: Accion): boolean {
  if (!estado.especiales || !ACCIONES[accion.tipo].ataque || !accion.objetivo) return false
  const objetivo = jugadorPorId(estado, accion.objetivo)
  return !objetivo.eliminado && objetivo.creditos >= 1
}

/** Tras superar (o no tener) la ventana de desafío: abre la de bloqueo si aplica. */
function etapaBloqueo(ctx: Ctx, accion: Accion) {
  const { estado } = ctx
  const def = ACCIONES[accion.tipo]
  // Sin roles especiales no existen los bloqueos especiales (p. ej. la Demanda laboral no se bloquea).
  if (bloqueosVigentes(accion.tipo, estado.especiales).length === 0) return resolver(ctx, accion)

  let pendientes: string[]
  if (def.soloObjetivoBloquea) {
    const obj = accion.objetivo ? jugadorPorId(estado, accion.objetivo) : null
    pendientes = obj && !obj.eliminado ? [obj.id] : []
  } else {
    pendientes = otrosVivos(estado, accion.actor)
  }
  if (pendientes.length === 0) return resolver(ctx, accion)
  // El objetivo de un ataque ve a la vez sus bloqueos y «explotar el site».
  estado.fase = { tipo: 'ventanaBloqueo', accion, pendientes, explosion: puedeExplotar(estado, accion) }
}

/** Aplica el efecto de la acción. */
function resolver(ctx: Ctx, accion: Accion) {
  const { estado } = ctx
  const actor = jugadorPorId(estado, accion.actor)
  const objetivo = accion.objetivo ? jugadorPorId(estado, accion.objetivo) : null

  // El objetivo pudo ser eliminado durante la cadena de desafíos (p. ej. por su
  // propio farol): la acción se desvanece, pero el coste ya está gastado.
  if (objetivo?.eliminado) return cancelar(ctx, accion, false)

  switch (accion.tipo) {
    case 'sueldoMinimo':
      cambiarCreditos(ctx, actor, GANANCIA_SUELDO_MINIMO)
      return finTurno(ctx)
    case 'nomina':
      cambiarCreditos(ctx, actor, GANANCIA_NOMINA)
      return finTurno(ctx)
    case 'malversacion':
      cambiarCreditos(ctx, actor, GANANCIA_MALVERSACION)
      return finTurno(ctx)
    case 'roboAguinaldo':
      cambiarCreditos(ctx, actor, GANANCIA_ROBO_AGUINALDO)
      return finTurno(ctx)
    case 'roboMerito': {
      const robo = Math.min(ROBO_MERITO, objetivo!.creditos)
      cambiarCreditos(ctx, objetivo!, -robo)
      cambiarCreditos(ctx, actor, robo)
      return finTurno(ctx)
    }
    case 'demandaLaboral':
    case 'despido':
    case 'renuncia':
      return etapaIngeniero(ctx, accion)
    case 'reasignacion': {
      const robadas = estado.mazo.splice(0, CARTAS_REASIGNACION)
      if (robadas.length === 0) return finTurno(ctx)
      estado.fase = { tipo: 'reasignando', jugador: actor.id, robadas }
      return
    }
  }
}

// ------------------------------------------------- Reacciones de habilidad especial

/**
 * Antes de que caiga una Demanda, un Despido o una Renuncia, el objetivo puede «explotar el site»
 * (Ingeniero Especial). Se le ofrece siempre que tenga con qué pagar, tenga o
 * no la carta (puede ser un farol), para no delatar su mano.
 */
function etapaIngeniero(ctx: Ctx, accion: Accion) {
  if (!puedeExplotar(ctx.estado, accion)) return efectoDirecto(ctx, accion, false)
  ctx.estado.fase = { tipo: 'ventanaIngeniero', accion, pendientes: [accion.objetivo!] }
}

/** La Demanda, el Despido o la Renuncia caen: el objetivo pierde una carta. */
function efectoDirecto(ctx: Ctx, accion: Accion, reciclarIngeniero: boolean) {
  const objetivo = jugadorPorId(ctx.estado, accion.objetivo!)
  if (objetivo.eliminado) return cancelar(ctx, accion, false) // el coste no se devuelve
  perderCarta(
    ctx,
    objetivo.id,
    reciclarIngeniero ? { tipo: 'cierreIngeniero', jugador: objetivo.id } : { tipo: 'finTurno' },
  )
}

/**
 * Explosión validada: el atacante pierde una carta ANTES de que caiga el
 * efecto. Si eso lo deja como único jugador vivo al Ingeniero, la partida
 * termina ahí y gana (nunca hay empate).
 */
function explosion(ctx: Ctx, accion: Accion, usoUnico: boolean): void {
  const siguiente: Continuacion = { tipo: 'efectoDirecto', accion, reciclarIngeniero: usoUnico }
  if (jugadorPorId(ctx.estado, accion.actor).eliminado) return continuar(ctx, siguiente)
  perderCarta(ctx, accion.actor, siguiente)
}

function reclamoDeReaccion(r: Reaccion): Reclamo {
  return r.tipo === 'explosion'
    ? { rol: 'ingeniero', especial: true }
    : { rol: 'jefeArea', especial: true }
}

/** Abre la ventana en la que cualquiera puede desafiar una reacción especial. */
function abrirDesafioReaccion(ctx: Ctx, accion: Accion, reaccion: Reaccion) {
  const pendientes = otrosVivos(ctx.estado, reaccion.jugador)
  if (pendientes.length === 0) return reaccionValida(ctx, accion, reaccion, true)
  ctx.estado.fase = { tipo: 'ventanaDesafioReaccion', accion, reaccion, pendientes }
}

/** La reacción se sostiene. `usoUnico`: nadie la desafió, así que se gasta la carta. */
function reaccionValida(ctx: Ctx, accion: Accion, reaccion: Reaccion, usoUnico: boolean) {
  if (reaccion.tipo === 'explosion') return explosion(ctx, accion, usoUnico)
  if (usoUnico) renovarMano(ctx, reaccion.jugador)
  continuar(ctx, continuacionFallo(reaccion.origen, accion))
}

// ------------------------------------------------------------------ Handlers

function elegirAccion(ctx: Ctx, i: Extract<Intencion, { tipo: 'elegirAccion' }>) {
  const { estado, eventos } = ctx
  if (estado.fase.tipo !== 'accion') return fallar('faseIncorrecta', 'No es momento de elegir acción')
  if (i.jugador !== estado.jugadorActivo) return fallar('noEsTuTurno', 'No es tu turno')

  const actor = jugadorPorId(estado, i.jugador)
  const def = ACCIONES[i.accion]
  if (!def) return fallar('faseIncorrecta', 'Acción desconocida')
  if (!accionDisponible(i.accion, estado.especiales)) {
    return fallar('noDisponible', 'Esa acción no existe en el modo sin roles especiales')
  }

  if (def.generaCreditos && actor.creditos >= LIMITE_CREDITOS) {
    return fallar(
      'limiteCreditos',
      `Con ${LIMITE_CREDITOS} o más créditos debes gastar (Despido, Renuncia, Demanda laboral o Reasignación)`,
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
    const { rol, especial } = reclamoDeAccion(f.accion.tipo)!
    estado.fase = {
      tipo: 'revelacion', accion: f.accion, acusado: f.accion.actor,
      desafiante: i.jugador, rol, especial, origen: 'accion',
    }
    eventos.push({
      tipo: 'desafioLanzado', desafiante: i.jugador, acusado: f.accion.actor, rol, especial,
    })
  } else if (f.tipo === 'ventanaDesafioBloqueo') {
    exigirPendiente(f.pendientes, i.jugador)
    const { rol, especial } = f.bloqueo
    estado.fase = {
      tipo: 'revelacion', accion: f.accion, acusado: f.bloqueo.jugador,
      desafiante: i.jugador, rol, especial, origen: 'bloqueo',
    }
    eventos.push({
      tipo: 'desafioLanzado', desafiante: i.jugador, acusado: f.bloqueo.jugador, rol, especial,
    })
  } else if (f.tipo === 'ventanaDesafioReaccion') {
    exigirPendiente(f.pendientes, i.jugador)
    const { rol, especial } = reclamoDeReaccion(f.reaccion)
    if (f.reaccion.tipo === 'salvacion') {
      eventos.push({
        tipo: 'desafioLanzado', desafiante: i.jugador, acusado: f.reaccion.jugador, rol, especial,
      })
      return resolverSalvacionDesafiada(ctx, f.accion, f.reaccion, i.jugador)
    }
    estado.fase = {
      tipo: 'revelacion', accion: f.accion, acusado: f.reaccion.jugador,
      desafiante: i.jugador, rol, especial, origen: 'reaccion', reaccion: f.reaccion,
    }
    eventos.push({
      tipo: 'desafioLanzado', desafiante: i.jugador, acusado: f.reaccion.jugador, rol, especial,
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
  const especial = !!i.especial
  const permitido = bloqueosVigentes(f.accion.tipo, estado.especiales).some(
    (r) => r.rol === i.rol && r.especial === especial,
  )
  if (!permitido) return fallar('bloqueoInvalido', 'Ese rol no puede bloquear esta acción')
  eventos.push({ tipo: 'bloqueoDeclarado', bloqueador: i.jugador, rol: i.rol, especial })
  estado.fase = {
    tipo: 'ventanaDesafioBloqueo',
    accion: f.accion,
    bloqueo: { jugador: i.jugador, rol: i.rol, especial },
    // Cualquiera salvo el bloqueador (incluido el actor) puede desafiar el bloqueo.
    pendientes: otrosVivos(estado, i.jugador),
  }
}

type VentanaConPendientes = Extract<
  Fase,
  {
    tipo:
      | 'ventanaDesafioAccion'
      | 'ventanaBloqueo'
      | 'ventanaDesafioBloqueo'
      | 'ventanaIngeniero'
      | 'ventanaDesafioReaccion'
  }
>

/** Nadie más debe responder (todos pasaron o se fueron): la ventana se cierra y el flujo sigue. */
function cerrarVentana(ctx: Ctx, f: VentanaConPendientes): void {
  switch (f.tipo) {
    case 'ventanaDesafioAccion':
      return etapaBloqueo(ctx, f.accion)
    case 'ventanaBloqueo':
      // Si la ventana ya ofrecía «explotar el site», pasar es pasar de todo: el ataque cae sin más ventanas.
      return f.explosion ? efectoDirecto(ctx, f.accion, false) : resolver(ctx, f.accion)
    case 'ventanaIngeniero':
      return efectoDirecto(ctx, f.accion, false)
    case 'ventanaDesafioReaccion':
      return reaccionValida(ctx, f.accion, f.reaccion, true)
    case 'ventanaDesafioBloqueo':
      // El bloqueo se sostiene sin desafío. Si usó la carta de un solo uso
      // (Sindicalizado Especial), la devuelve al mazo con el resto de su mano.
      if (f.bloqueo.especial) renovarMano(ctx, f.bloqueo.jugador)
      return cancelar(ctx, f.accion, false) // el coste NO se devuelve
  }
}

function pasar(ctx: Ctx, i: Extract<Intencion, { tipo: 'pasar' }>) {
  const f = ctx.estado.fase
  if (
    f.tipo !== 'ventanaDesafioAccion' &&
    f.tipo !== 'ventanaBloqueo' &&
    f.tipo !== 'ventanaDesafioBloqueo' &&
    f.tipo !== 'ventanaIngeniero' &&
    f.tipo !== 'ventanaDesafioReaccion'
  ) {
    return fallar('faseIncorrecta', 'No hay nada a lo que pasar')
  }
  exigirPendiente(f.pendientes, i.jugador)
  f.pendientes = f.pendientes.filter((id) => id !== i.jugador)
  if (f.pendientes.length > 0) return
  cerrarVentana(ctx, f) // todos pasaron
}

/** Ingeniero Especial: el objetivo de una Demanda, un Despido o una Renuncia «explota el site». */
function explotarSite(ctx: Ctx, i: Extract<Intencion, { tipo: 'explotarSite' }>) {
  const f = ctx.estado.fase
  // Se puede explotar al decidir sobre el bloqueo, o después si el bloqueo cayó.
  if (!(f.tipo === 'ventanaIngeniero' || (f.tipo === 'ventanaBloqueo' && f.explosion))) {
    return fallar('faseIncorrecta', 'No hay nada que explotar')
  }
  exigirPendiente(f.pendientes, i.jugador)
  const j = jugadorPorId(ctx.estado, i.jugador)
  if (j.creditos < 1) return fallar('creditosInsuficientes', 'Necesitas al menos 1 crédito')
  const pago = Math.min(EXPLOSION_COSTE, j.creditos)
  cambiarCreditos(ctx, j, -pago)
  ctx.eventos.push({ tipo: 'siteExplotado', jugador: j.id, pago })
  abrirDesafioReaccion(ctx, f.accion, { tipo: 'explosion', jugador: j.id })
}

/**
 * Jefe de Área Especial (Excusa de mérito): el desafiado, ANTES de mostrar carta, declara que se
 * salva del farol. Si nadie lo desafía no pierde nada (aunque la acción se
 * cancele); si lo desafían, se resuelve solo (ver `resolverSalvacionDesafiada`).
 */
function salvarse(ctx: Ctx, i: Extract<Intencion, { tipo: 'salvarse' }>) {
  const f = ctx.estado.fase
  if (!ctx.estado.especiales) {
    return fallar('noDisponible', 'La Excusa de mérito no existe en el modo sin roles especiales')
  }
  if (f.tipo !== 'revelacion' || f.origen === 'reaccion') {
    return fallar('faseIncorrecta', 'No hay ningún farol del que salvarse')
  }
  if (i.jugador !== f.acusado) return fallar('noPuedesResponder', 'No eres el desafiado')
  ctx.eventos.push({ tipo: 'salvacionDeclarada', jugador: i.jugador })
  abrirDesafioReaccion(ctx, f.accion, { tipo: 'salvacion', jugador: i.jugador, origen: f.origen })
}

/**
 * Desafían la salvación: no hay nada que elegir. Si tenía el Jefe de Área
 * Especial se muestra solo (el desafiante pierde 2 cartas y él cambia la
 * suya); si no, pierde todas sus cartas sin más.
 */
function resolverSalvacionDesafiada(
  ctx: Ctx,
  accion: Accion,
  reaccion: Extract<Reaccion, { tipo: 'salvacion' }>,
  desafiante: string,
) {
  const { eventos } = ctx
  const acusado = jugadorPorId(ctx.estado, reaccion.jugador)
  const idx = acusado.cartas.findIndex(
    (c) => !c.revelada && c.rol === 'jefeArea' && !!c.especial,
  )
  const siguiente = continuacionFallo(reaccion.origen, accion)
  const tenia = idx >= 0
  if (tenia) {
    eventos.push({ tipo: 'cartaMostrada', jugador: acusado.id, rol: 'jefeArea', especial: true })
  }
  eventos.push({
    tipo: 'desafioResuelto', acusado: acusado.id, desafiante, acusadoTeniaRol: tenia,
  })
  if (tenia) {
    intercambiarCarta(ctx, acusado, idx)
    perderCarta(ctx, desafiante, siguiente, PENALIZACION_ESPECIAL)
  } else {
    perderCarta(ctx, acusado.id, siguiente, PENALIZACION_ESPECIAL)
  }
}

/** La carta mostrada vuelve al mazo, se baraja y se roba otra (el desafiante no gana información). */
function intercambiarCarta(ctx: Ctx, jugador: Jugador, idx: number) {
  const { estado, eventos, rng } = ctx
  estado.mazo.push(aCarta(jugador.cartas[idx]))
  estado.mazo = barajar(estado.mazo, rng)
  const nueva = estado.mazo.pop()!
  jugador.cartas[idx] = { ...nueva, revelada: false }
  eventos.push({ tipo: 'cartaIntercambiada', jugador: jugador.id })
}

/**
 * El acusado muestra una carta. Si cumple el reclamo, gana el desafío:
 * baraja esa carta en el mazo, roba otra y el desafiante pierde una carta (dos
 * si el reclamo era especial). Si no, queda al descubierto: pierde la carta
 * mostrada (y otra más si el reclamo era especial). Salvarse con el
 * Jefe de Área Especial debe hacerse ANTES de mostrar carta.
 */
function revelarCarta(ctx: Ctx, i: Extract<Intencion, { tipo: 'revelarCarta' }>) {
  const { estado, eventos } = ctx
  const f = estado.fase
  if (f.tipo !== 'revelacion') return fallar('faseIncorrecta', 'No hay desafío pendiente')
  if (i.jugador !== f.acusado) return fallar('noPuedesResponder', 'No eres el desafiado')

  const acusado = jugadorPorId(estado, f.acusado)
  const idx = acusado.cartas.findIndex((c) => c.id === i.cartaId && !c.revelada)
  if (idx < 0) return fallar('cartaInvalida', 'Esa carta no está disponible')
  const carta = acusado.cartas[idx]
  const reclamo: Reclamo = { rol: f.rol, especial: f.especial }

  eventos.push({
    tipo: 'cartaMostrada', jugador: acusado.id, rol: carta.rol, especial: !!carta.especial,
  })
  const teniaRol = cumpleReclamo(carta, reclamo)
  eventos.push({
    tipo: 'desafioResuelto', acusado: acusado.id, desafiante: f.desafiante, acusadoTeniaRol: teniaRol,
  })

  if (teniaRol) {
    // Esto sustituye al "uso único": no se devuelve el resto de la mano.
    intercambiarCarta(ctx, acusado, idx)

    let cont: Continuacion
    if (f.origen === 'accion') cont = { tipo: 'seguirAccion', accion: f.accion }
    else if (f.origen === 'bloqueo') cont = { tipo: 'cancelarAccion', accion: f.accion, reembolso: false } // el bloqueo se sostiene
    else cont = { tipo: 'explosion', accion: f.accion, usoUnico: false }
    perderCarta(ctx, f.desafiante, cont, penalizacion(reclamo))
    return
  }

  perderPorFarol(ctx, acusado.id, carta.id, penalizacion(reclamo), continuacionDerrota(f))
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
  perderPorFarol(
    ctx, acusado.id, i.cartaId, penalizacion({ rol: f.rol, especial: f.especial }),
    continuacionDerrota(f),
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
  const pool = [...cartasVivas(jugador).map(aCarta), ...f.robadas]
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

// ----------------------------------------------------------------- Salir

/** ¿Participa este jugador en la acción, como actor o como objetivo? */
const participa = (a: Accion, id: string): boolean => a.actor === id || a.objetivo === id

/** Quita al jugador de los pendientes de una ventana; true si ya no queda nadie por responder. */
function quitarPendiente(f: { pendientes: string[] }, id: string): boolean {
  f.pendientes = f.pendientes.filter((x) => x !== id)
  return f.pendientes.length === 0
}

/** Si la continuación depende de una acción en la que participaba quien se fue, pasa a ser cancelarla. */
function sinJugador(c: Continuacion, id: string): Continuacion {
  switch (c.tipo) {
    case 'seguirAccion':
    case 'resolverAccion':
    case 'efectoDirecto':
    case 'explosion':
      return participa(c.accion, id)
        ? { tipo: 'cancelarAccion', accion: c.accion, reembolso: false }
        : c
    default:
      return c
  }
}

/**
 * Abandonar la partida. El jugador se retira para siempre: sus cartas vivas
 * pasan al descarte público, sus créditos desaparecen y sale de la rotación de
 * turnos (cuenta como eliminado). Lo que estuviera pendiente de él se resuelve
 * o se cancela, y el turno continúa con el siguiente jugador vivo:
 *  - su acción, o una dirigida contra él, se cancela (sus créditos ya estaban gastados);
 *  - si debía responder a una ventana, deja de contar; si era el último, se cierra;
 *  - si era el desafiado, pierde el desafío; si era quien desafiaba, el desafío se cae
 *    y el reclamo se sostiene sin penalización para nadie;
 *  - si reasignaba, sus cartas robadas vuelven al mazo.
 */
function salir(ctx: Ctx, i: Extract<Intencion, { tipo: 'salir' }>) {
  const { estado, eventos, rng } = ctx
  const fase = estado.fase
  if (fase.tipo === 'fin') return fallar('faseIncorrecta', 'La partida ya terminó')

  const j = jugadorPorId(estado, i.jugador)
  const id = j.id
  for (const c of cartasVivas(j)) {
    c.revelada = true
    eventos.push({ tipo: 'cartaPerdida', jugador: id, rol: c.rol, especial: !!c.especial })
  }
  j.eliminado = true
  j.retirado = true
  j.creditos = 0
  eventos.push({ tipo: 'jugadorRetirado', jugador: id })

  const vivos = estado.jugadores.filter((x) => !x.eliminado)
  if (vivos.length === 1) {
    estado.fase = { tipo: 'fin', ganador: vivos[0].id }
    eventos.push({ tipo: 'partidaTerminada', ganador: vivos[0].id })
    return
  }

  switch (fase.tipo) {
    case 'accion':
      if (estado.jugadorActivo === id) finTurno(ctx)
      return
    case 'ventanaDesafioAccion':
      if (participa(fase.accion, id)) return cancelar(ctx, fase.accion, false)
      if (quitarPendiente(fase, id)) etapaBloqueo(ctx, fase.accion)
      return
    case 'ventanaBloqueo':
      if (participa(fase.accion, id)) return cancelar(ctx, fase.accion, false)
      if (quitarPendiente(fase, id)) cerrarVentana(ctx, fase)
      return
    case 'ventanaDesafioBloqueo':
      // Se fue quien bloqueaba: no hay bloqueo y la acción procede (si él era el objetivo, se desvanece).
      if (fase.bloqueo.jugador === id) return resolver(ctx, fase.accion)
      if (participa(fase.accion, id)) return cancelar(ctx, fase.accion, false)
      if (quitarPendiente(fase, id)) cerrarVentana(ctx, fase)
      return
    case 'ventanaIngeniero':
      if (participa(fase.accion, id)) cancelar(ctx, fase.accion, false)
      return
    case 'ventanaDesafioReaccion':
      if (fase.reaccion.jugador === id) {
        // Se fue quien se salvaba: su farol cae. Se fue quien explotaba el site (el objetivo): la acción se desvanece.
        return fase.reaccion.tipo === 'salvacion'
          ? continuar(ctx, continuacionFallo(fase.reaccion.origen, fase.accion))
          : cancelar(ctx, fase.accion, false)
      }
      if (participa(fase.accion, id)) return cancelar(ctx, fase.accion, false)
      if (quitarPendiente(fase, id)) reaccionValida(ctx, fase.accion, fase.reaccion, true)
      return
    case 'revelacion':
      if (fase.acusado === id) return continuar(ctx, continuacionDerrota(fase))
      if (participa(fase.accion, id)) return cancelar(ctx, fase.accion, false)
      if (fase.desafiante === id) {
        // El desafío se cae: el reclamo se sostiene, sin intercambio ni penalización.
        return continuar(
          ctx,
          fase.origen === 'accion'
            ? { tipo: 'seguirAccion', accion: fase.accion }
            : fase.origen === 'bloqueo'
              ? { tipo: 'cancelarAccion', accion: fase.accion, reembolso: false }
              : { tipo: 'explosion', accion: fase.accion, usoUnico: false },
        )
      }
      return
    case 'perdiendoCarta':
      if (fase.jugador === id) return continuar(ctx, sinJugador(fase.continuacion, id))
      fase.continuacion = sinJugador(fase.continuacion, id)
      return
    case 'reasignando':
      if (fase.jugador === id) {
        estado.mazo = barajar([...estado.mazo, ...fase.robadas], rng)
        return finTurno(ctx)
      }
      return
  }
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
      case 'explotarSite': explotarSite(ctx, intencion); break
      case 'salvarse': salvarse(ctx, intencion); break
      case 'revelarCarta': revelarCarta(ctx, intencion); break
      case 'rendirse': rendirse(ctx, intencion); break
      case 'elegirCartaAPerder': elegirCartaAPerder(ctx, intencion); break
      case 'confirmarReasignacion': confirmarReasignacion(ctx, intencion); break
      case 'salir': salir(ctx, intencion); break
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
