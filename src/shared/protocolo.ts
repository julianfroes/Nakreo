/**
 * Protocolo de mensajes entre clientes y anfitrión.
 *
 * Seguridad: TODO lo que llega del otro extremo es no confiable. Los
 * validadores construyen objetos nuevos campo por campo (lista blanca), de modo
 * que propiedades extra enviadas por un cliente malicioso (p. ej. `jugador`)
 * se descartan.
 */
import { ACCIONES, ROLES } from '../game/roles'
import type { CodigoError, EventoJuego, Intencion, Rol, TipoAccion } from '../game/types'
import type { EstadoProyectado } from '../game/proyeccion'

type SinJugador<T> = T extends unknown ? Omit<T, 'jugador'> : never

/** Intención tal como la envía un cliente: sin `jugador` (lo pone el host). */
export type IntencionCliente = SinJugador<Intencion>

export const MAX_NOMBRE = 20

// ------------------------------------------------------------ Cliente → Host

export type MensajeCliente =
  | { tipo: 'unirse'; nombre: string; token: string }
  /** Solo en el lobby: «estoy listo». Es una guía visual; no condiciona el inicio. */
  | { tipo: 'listo'; listo: boolean }
  | { tipo: 'intencion'; intencion: IntencionCliente }

// ------------------------------------------------------------ Host → Cliente

export interface JugadorSala {
  id: string
  nombre: string
  conectado: boolean
  /** Ha marcado «estoy listo» (solo informativo; siempre false si está desconectado). */
  listo: boolean
}

/** Lo que el host dice de la sala: jugadores, si empezó y el modo/aforo. */
export interface SalaInfo {
  jugadores: JugadorSala[]
  iniciada: boolean
  /** false = sin roles especiales. */
  especiales: boolean
  /** Aforo de la sala en este modo. */
  max: number
}

export type CodigoErrorRed =
  | CodigoError
  | 'mensajeInvalido'
  | 'salaLlena'
  | 'partidaEnCurso'
  /** El anfitrión ya ocupa un asiento (solo puede tener uno). */
  | 'yaTienesAsiento'
  /** Abandonaste esta partida y no puedes volver a entrar en ella. */
  | 'retirado'
  | 'sinPartida'
  | 'noUnido'

export type MensajeHost =
  | { tipo: 'bienvenida'; idJugador: string }
  /** El anfitrión cerró la sala: no hay a dónde reconectar. */
  | { tipo: 'salaCerrada' }
  | ({ tipo: 'sala' } & SalaInfo)
  | { tipo: 'estado'; proyeccion: EstadoProyectado; eventos: EventoJuego[] }
  | { tipo: 'error'; codigo: CodigoErrorRed; mensaje: string }

// --------------------------------------------------------------- Validadores

const esObj = (x: unknown): x is Record<string, unknown> =>
  typeof x === 'object' && x !== null && !Array.isArray(x)

const esEntero = (x: unknown): x is number => typeof x === 'number' && Number.isInteger(x)

function parsearIntencion(x: unknown): IntencionCliente | null {
  if (!esObj(x)) return null
  switch (x.tipo) {
    case 'elegirAccion': {
      if (typeof x.accion !== 'string' || !(x.accion in ACCIONES)) return null
      const accion = x.accion as TipoAccion
      if (x.objetivo === undefined) return { tipo: 'elegirAccion', accion }
      if (typeof x.objetivo !== 'string' || x.objetivo.length > 16) return null
      return { tipo: 'elegirAccion', accion, objetivo: x.objetivo }
    }
    case 'desafiar':
      return { tipo: 'desafiar' }
    case 'salir':
      return { tipo: 'salir' }
    case 'pasar':
      return { tipo: 'pasar' }
    case 'bloquear':
      if (typeof x.rol !== 'string' || !(x.rol in ROLES)) return null
      if (x.especial !== undefined && typeof x.especial !== 'boolean') return null
      return x.especial === undefined
        ? { tipo: 'bloquear', rol: x.rol as Rol }
        : { tipo: 'bloquear', rol: x.rol as Rol, especial: x.especial }
    case 'explotarSite':
    case 'salvarse':
      return { tipo: x.tipo }
    case 'revelarCarta':
    case 'rendirse':
    case 'elegirCartaAPerder':
      if (!esEntero(x.cartaId)) return null
      return { tipo: x.tipo, cartaId: x.cartaId }
    case 'confirmarReasignacion':
      if (!Array.isArray(x.conservar) || x.conservar.length > 4) return null
      if (!x.conservar.every(esEntero)) return null
      return { tipo: 'confirmarReasignacion', conservar: [...x.conservar] }
    default:
      return null
  }
}

/** Devuelve el mensaje limpio, o null si es inválido. */
export function parsearMensajeCliente(x: unknown): MensajeCliente | null {
  if (!esObj(x)) return null
  if (x.tipo === 'unirse') {
    if (typeof x.nombre !== 'string' || typeof x.token !== 'string') return null
    const nombre = x.nombre.trim()
    if (nombre.length < 1 || nombre.length > MAX_NOMBRE) return null
    if (x.token.length < 8 || x.token.length > 64) return null
    return { tipo: 'unirse', nombre, token: x.token }
  }
  if (x.tipo === 'listo') {
    return typeof x.listo === 'boolean' ? { tipo: 'listo', listo: x.listo } : null
  }
  if (x.tipo === 'intencion') {
    const intencion = parsearIntencion(x.intencion)
    return intencion ? { tipo: 'intencion', intencion } : null
  }
  return null
}

/**
 * Validación ligera de mensajes del host (semi-confiable: solo comprobamos la
 * forma básica). La proyección no se re-valida en profundidad.
 */
export function parsearMensajeHost(x: unknown): MensajeHost | null {
  if (!esObj(x)) return null
  switch (x.tipo) {
    case 'bienvenida':
      return typeof x.idJugador === 'string' ? (x as MensajeHost) : null
    case 'salaCerrada':
      return { tipo: 'salaCerrada' }
    case 'sala':
      return Array.isArray(x.jugadores) &&
        typeof x.iniciada === 'boolean' &&
        typeof x.especiales === 'boolean' &&
        esEntero(x.max)
        ? (x as MensajeHost)
        : null
    case 'estado':
      return esObj(x.proyeccion) && Array.isArray(x.eventos) ? (x as MensajeHost) : null
    case 'error':
      return typeof x.codigo === 'string' && typeof x.mensaje === 'string' ? (x as MensajeHost) : null
    default:
      return null
  }
}
