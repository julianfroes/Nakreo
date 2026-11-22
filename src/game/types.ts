/**
 * Tipos del dominio. El motor trabaja SIEMPRE con el estado completo
 * (`EstadoJuego`), que contiene información oculta (manos y mazo).
 * Nunca debe enviarse tal cual a un cliente: la proyección por jugador
 * se implementa en una fase posterior.
 */

export type Rol =
  | 'directorFinanciero'
  | 'saboteador'
  | 'contrabandista'
  | 'ingeniero'
  | 'jefeSeguridad'

export type TipoAccion =
  | 'ingreso'
  | 'subsidio'
  | 'golpe'
  | 'dividendos'
  | 'sabotaje'
  | 'desvio'
  | 'reasignacion'

export interface Carta {
  /** Identificador único de la carta física (no revela el rol por sí solo). */
  id: number
  rol: Rol
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
}

export interface Accion {
  tipo: TipoAccion
  actor: string
  objetivo: string | null
}

/** Qué ocurre cuando termina de resolverse una pérdida de carta. */
export type Continuacion =
  | { tipo: 'finTurno' }
  /** El desafío a la acción falló: la acción sigue (ventana de bloqueo o efecto). */
  | { tipo: 'seguirAccion'; accion: Accion }
  /** El bloqueo era un farol: la acción se resuelve. */
  | { tipo: 'resolverAccion'; accion: Accion }
  | { tipo: 'cancelarAccion'; accion: Accion; reembolso: boolean }

export type Fase =
  | { tipo: 'accion' }
  | { tipo: 'ventanaDesafioAccion'; accion: Accion; pendientes: string[] }
  | { tipo: 'ventanaBloqueo'; accion: Accion; pendientes: string[] }
  | {
      tipo: 'ventanaDesafioBloqueo'
      accion: Accion
      bloqueo: { jugador: string; rol: Rol }
      pendientes: string[]
    }
  | {
      tipo: 'revelacion'
      accion: Accion
      acusado: string
      desafiante: string
      rol: Rol
      origen: 'accion' | 'bloqueo'
    }
  | { tipo: 'perdiendoCarta'; jugador: string; continuacion: Continuacion }
  /** `robadas` es información oculta: solo la ve `jugador`. */
  | { tipo: 'reasignando'; jugador: string; robadas: Carta[] }
  | { tipo: 'fin'; ganador: string }

export interface EstadoJuego {
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
  | { tipo: 'bloquear'; jugador: string; rol: Rol }
  | { tipo: 'pasar'; jugador: string }
  | { tipo: 'revelarCarta'; jugador: string; cartaId: number }
  /** El desafiado admite el farol: pierde la carta elegida (aunque sea la del rol). */
  | { tipo: 'rendirse'; jugador: string; cartaId: number }
  | { tipo: 'elegirCartaAPerder'; jugador: string; cartaId: number }
  | { tipo: 'confirmarReasignacion'; jugador: string; conservar: number[] }

export type CodigoError =
  | 'faseIncorrecta'
  | 'noEsTuTurno'
  | 'noPuedesResponder'
  | 'jugadorInvalido'
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
  | { tipo: 'desafioLanzado'; desafiante: string; acusado: string; rol: Rol }
  | { tipo: 'cartaMostrada'; jugador: string; rol: Rol }
  | { tipo: 'desafioResuelto'; acusado: string; desafiante: string; acusadoTeniaRol: boolean }
  | { tipo: 'cartaIntercambiada'; jugador: string }
  | { tipo: 'bloqueoDeclarado'; bloqueador: string; rol: Rol }
  | { tipo: 'cartaPerdida'; jugador: string; rol: Rol }
  | { tipo: 'jugadorEliminado'; jugador: string }
  | { tipo: 'reasignacionRealizada'; jugador: string }
  | { tipo: 'accionCancelada'; accion: Accion }
  | { tipo: 'partidaTerminada'; ganador: string }
