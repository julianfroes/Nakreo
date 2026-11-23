/**
 * Tipos del dominio. El motor trabaja SIEMPRE con el estado completo
 * (`EstadoJuego`), que contiene información oculta (manos y mazo).
 * Nunca debe enviarse tal cual a un cliente: la proyección por jugador
 * se implementa en una fase posterior.
 */

export type Rol =
  | 'rh'
  | 'ceo'
  | 'jefeArea'
  | 'ingeniero'
  | 'sindicalizado'

export type TipoAccion =
  | 'sueldoMinimo'
  | 'nomina'
  | 'demandaLaboral'
  | 'malversacion'
  | 'despido'
  | 'roboMerito'
  | 'reasignacion'
  /** Robo de aguinaldo del RH Especial (+4). */
  | 'roboAguinaldo'
  /** Renuncia «voluntaria» del CEO Especial: solo la frena el Sindicalizado Especial. */
  | 'renuncia'

export interface Carta {
  /** Identificador único de la carta física (no revela el rol por sí solo). */
  id: number
  rol: Rol
  /**
   * Carta especial: cuenta como su rol normal y además tiene una habilidad
   * extra. Ausente/false = carta normal.
   */
  especial?: boolean
}

/**
 * Lo que un jugador afirma tener al actuar, bloquear o reaccionar. Una carta
 * especial satisface tanto el reclamo normal como el especial de su rol; una
 * carta normal solo el normal. Fallar un reclamo especial cuesta el doble.
 */
export interface Reclamo {
  rol: Rol
  especial: boolean
}

export interface CartaEnMano extends Carta {
  /** true = la carta fue perdida y es pública (boca arriba). */
  revelada: boolean
}

export interface Jugador {
  id: string
  nombre: string
  creditos: number
  cartas: CartaEnMano[]
  eliminado: boolean
  /** Abandonó la partida (también está `eliminado`). No puede volver a entrar en ella. */
  retirado: boolean
}

export interface Accion {
  tipo: TipoAccion
  actor: string
  objetivo: string | null
}

/**
 * Reacciones de habilidad especial que se pueden desafiar.
 * - explosion: Ingeniero Especial «explota el site» al recibir una Demanda, un Despido o una Renuncia.
 * - salvacion: Jefe de Área Especial (Excusa de mérito) salva de un farol, antes de mostrar carta.
 */
export type Reaccion =
  | { tipo: 'explosion'; jugador: string }
  | { tipo: 'salvacion'; jugador: string; origen: 'accion' | 'bloqueo' }

/** Qué ocurre cuando termina de resolverse una pérdida de carta. */
export type Continuacion =
  | { tipo: 'finTurno' }
  /** El desafío a la acción falló: la acción sigue (ventana de bloqueo o efecto). */
  | { tipo: 'seguirAccion'; accion: Accion }
  /** El bloqueo era un farol: la acción se resuelve. */
  | { tipo: 'resolverAccion'; accion: Accion }
  | { tipo: 'cancelarAccion'; accion: Accion; reembolso: boolean }
  /**
   * La Demanda, el Despido o la Renuncia cae sobre el objetivo (sin más reacciones). Si
   * `reciclarIngeniero`, tras perder su carta el Ingeniero devuelve el resto
   * de su mano al mazo (uso único de la explosión, sin desafío).
   */
  | { tipo: 'efectoDirecto'; accion: Accion; reciclarIngeniero: boolean }
  /** Explosión validada: el atacante pierde una carta y luego cae el efecto. */
  | { tipo: 'explosion'; accion: Accion; usoUnico: boolean }
  /** Tras perder su carta, el Ingeniero devuelve el resto de su mano al mazo. */
  | { tipo: 'cierreIngeniero'; jugador: string }

export type Fase =
  | { tipo: 'accion' }
  | { tipo: 'ventanaDesafioAccion'; accion: Accion; pendientes: string[] }
  /**
   * El objetivo (o cualquiera, según la acción) puede bloquear. Si `explosion`, el
   * objetivo de un ataque también puede «explotar el site» desde aquí (a la vez que
   * decide si alega un bloqueo); si pasa, el ataque cae sin más ventanas.
   */
  | { tipo: 'ventanaBloqueo'; accion: Accion; pendientes: string[]; explosion: boolean }
  | {
      tipo: 'ventanaDesafioBloqueo'
      accion: Accion
      bloqueo: { jugador: string; rol: Rol; especial: boolean }
      pendientes: string[]
    }
  /** El objetivo de una Demanda, un Despido o una Renuncia puede «explotar el site» (Ingeniero Especial). */
  | { tipo: 'ventanaIngeniero'; accion: Accion; pendientes: string[] }
  | {
      tipo: 'ventanaDesafioReaccion'
      accion: Accion
      reaccion: Reaccion
      pendientes: string[]
    }
  | {
      tipo: 'revelacion'
      accion: Accion
      acusado: string
      desafiante: string
      rol: Rol
      especial: boolean
      origen: 'accion' | 'bloqueo' | 'reaccion'
      /** Solo cuando `origen` es 'reaccion' (la explosión; la salvación se resuelve sola). */
      reaccion?: Reaccion
    }
  | { tipo: 'perdiendoCarta'; jugador: string; continuacion: Continuacion }
  /** `robadas` es información oculta: solo la ve `jugador`. */
  | { tipo: 'reasignando'; jugador: string; robadas: Carta[] }
  | { tipo: 'fin'; ganador: string }

export interface EstadoJuego {
  /**
   * Modo de juego (información pública). false = «sin roles especiales»: el mazo
   * solo tiene cartas normales y no existe ninguna habilidad especial.
   */
  especiales: boolean
  /** Orden de turno = orden de este arreglo. */
  jugadores: Jugador[]
  /** Información oculta. */
  mazo: Carta[]
  turno: number
  jugadorActivo: string
  fase: Fase
  /** Registro de eventos de toda la partida. Público por construcción. */
  registro: EventoJuego[]
}

// ---------------------------------------------------------------- Intenciones

/** Lo único que un jugador puede enviar al árbitro. */
export type Intencion =
  | { tipo: 'elegirAccion'; jugador: string; accion: TipoAccion; objetivo?: string }
  | { tipo: 'desafiar'; jugador: string }
  | { tipo: 'bloquear'; jugador: string; rol: Rol; especial?: boolean }
  /** Ingeniero Especial: «explotar el site» al recibir una Demanda, un Despido o una Renuncia. */
  | { tipo: 'explotarSite'; jugador: string }
  /** Jefe de Área Especial (Excusa de mérito): salvarse de un desafío, antes de mostrar carta. */
  | { tipo: 'salvarse'; jugador: string }
  | { tipo: 'pasar'; jugador: string }
  | { tipo: 'revelarCarta'; jugador: string; cartaId: number }
  /** El desafiado admite el farol: pierde la carta elegida (aunque sea la del rol). */
  | { tipo: 'rendirse'; jugador: string; cartaId: number }
  | { tipo: 'elegirCartaAPerder'; jugador: string; cartaId: number }
  | { tipo: 'confirmarReasignacion'; jugador: string; conservar: number[] }
  /** Abandonar la partida (la procesa el host; en el lobby solo libera el asiento). */
  | { tipo: 'salir'; jugador: string }

export type CodigoError =
  | 'faseIncorrecta'
  | 'noEsTuTurno'
  | 'noPuedesResponder'
  | 'jugadorInvalido'
  /** La acción o habilidad no existe en este modo de juego (sin roles especiales). */
  | 'noDisponible'
  | 'objetivoInvalido'
  | 'creditosInsuficientes'
  | 'limiteCreditos'
  | 'bloqueoInvalido'
  | 'cartaInvalida'

export interface ErrorJuego {
  codigo: CodigoError
  mensaje: string
}

// --------------------------------------------------------------------- Eventos

/**
 * Eventos del registro. Contienen SOLO información pública (nunca el rol de
 * una carta oculta), así que pueden difundirse a todos sin proyección.
 */
export type EventoJuego =
  | { tipo: 'partidaIniciada'; jugadores: string[] }
  | { tipo: 'turnoIniciado'; jugador: string; turno: number }
  | { tipo: 'accionDeclarada'; accion: Accion }
  | { tipo: 'creditosCambiados'; jugador: string; delta: number }
  | { tipo: 'desafioLanzado'; desafiante: string; acusado: string; rol: Rol; especial: boolean }
  | { tipo: 'cartaMostrada'; jugador: string; rol: Rol; especial: boolean }
  | { tipo: 'desafioResuelto'; acusado: string; desafiante: string; acusadoTeniaRol: boolean }
  | { tipo: 'cartaIntercambiada'; jugador: string }
  | { tipo: 'bloqueoDeclarado'; bloqueador: string; rol: Rol; especial: boolean }
  | { tipo: 'cartaPerdida'; jugador: string; rol: Rol; especial: boolean }
  | { tipo: 'siteExplotado'; jugador: string; pago: number }
  | { tipo: 'salvacionDeclarada'; jugador: string }
  | { tipo: 'manoRenovada'; jugador: string }
  | { tipo: 'jugadorEliminado'; jugador: string }
  | { tipo: 'jugadorRetirado'; jugador: string }
  | { tipo: 'reasignacionRealizada'; jugador: string }
  | { tipo: 'accionCancelada'; accion: Accion }
  | { tipo: 'partidaTerminada'; ganador: string }
