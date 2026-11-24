import {
  CARTAS_POR_JUGADOR,
  COPIAS_ESPECIALES_POR_ROL,
  COPIAS_POR_ROL,
  CREDITOS_INICIALES,
  MIN_JUGADORES,
  maxJugadores,
} from './config'
import { barajar, type Rng } from './rng'
import { TODOS_LOS_ROLES } from './roles'
import type { Carta, EstadoJuego } from './types'

export interface DatosJugador {
  id: string
  nombre: string
}

export interface OpcionesPartida {
  /** false = sin cartas ni habilidades especiales (mazo de 15, hasta 6 jugadores). Por defecto true. */
  especiales?: boolean
}

/**
 * Crea una partida nueva. El primer jugador de la lista empieza; si se quiere
 * un inicio aleatorio, barajar la lista antes de llamar.
 */
export function crearPartida(
  jugadores: readonly DatosJugador[],
  rng: Rng = Math.random,
  { especiales = true }: OpcionesPartida = {},
): EstadoJuego {
  const max = maxJugadores(especiales)
  if (jugadores.length < MIN_JUGADORES || jugadores.length > max) {
    throw new Error(`La partida requiere entre ${MIN_JUGADORES} y ${max} jugadores`)
  }
  if (new Set(jugadores.map((j) => j.id)).size !== jugadores.length) {
    throw new Error('Los ids de jugador deben ser únicos')
  }

  // Cada rol ocupa un tramo fijo de ids (normales y luego la especial), también sin especiales:
  // así el id identifica a la carta física y fija su arte (ver `shared/arteCartas`).
  const porRol = COPIAS_POR_ROL + COPIAS_ESPECIALES_POR_ROL
  const todas: Carta[] = TODOS_LOS_ROLES.flatMap((rol, r) => [
    ...Array.from({ length: COPIAS_POR_ROL }, (_, k) => ({ id: r * porRol + k, rol })),
    ...(especiales
      ? Array.from({ length: COPIAS_ESPECIALES_POR_ROL }, (_, k) => ({
          id: r * porRol + COPIAS_POR_ROL + k, rol, especial: true,
        }))
      : []),
  ])
  const mazo = barajar(todas, rng)

  const jugadoresEstado = jugadores.map((j) => ({
    id: j.id,
    nombre: j.nombre,
    creditos: CREDITOS_INICIALES,
    eliminado: false,
    retirado: false,
    cartas: mazo.splice(0, CARTAS_POR_JUGADOR).map((c) => ({ ...c, revelada: false })),
  }))

  return {
    especiales,
    jugadores: jugadoresEstado,
    mazo,
    turno: 1,
    jugadorActivo: jugadoresEstado[0].id,
    fase: { tipo: 'accion' },
    registro: [{ tipo: 'partidaIniciada', jugadores: jugadoresEstado.map((j) => j.id) }],
  }
}
