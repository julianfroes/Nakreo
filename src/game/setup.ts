import {
  CARTAS_POR_JUGADOR,
  COPIAS_POR_ROL,
  CREDITOS_INICIALES,
  MAX_JUGADORES,
  MIN_JUGADORES,
} from './config'
import { barajar, type Rng } from './rng'
import { TODOS_LOS_ROLES } from './roles'
import type { Carta, EstadoJuego } from './types'

export interface DatosJugador {
  id: string
  nombre: string
}

/**
 * Crea una partida nueva. El primer jugador de la lista empieza; si se quiere
 * un inicio aleatorio, barajar la lista antes de llamar.
 */
export function crearPartida(
  jugadores: readonly DatosJugador[],
  rng: Rng = Math.random,
): EstadoJuego {
  if (jugadores.length < MIN_JUGADORES || jugadores.length > MAX_JUGADORES) {
    throw new Error(`La partida requiere entre ${MIN_JUGADORES} y ${MAX_JUGADORES} jugadores`)
  }
  if (new Set(jugadores.map((j) => j.id)).size !== jugadores.length) {
    throw new Error('Los ids de jugador deben ser únicos')
  }

  let siguienteId = 0
  const todas: Carta[] = TODOS_LOS_ROLES.flatMap((rol) =>
    Array.from({ length: COPIAS_POR_ROL }, () => ({ id: siguienteId++, rol })),
  )
  const mazo = barajar(todas, rng)

  const jugadoresEstado = jugadores.map((j) => ({
    id: j.id,
    nombre: j.nombre,
    creditos: CREDITOS_INICIALES,
    eliminado: false,
    cartas: mazo.splice(0, CARTAS_POR_JUGADOR).map((c) => ({ ...c, revelada: false })),
  }))

  return {
    jugadores: jugadoresEstado,
    mazo,
    turno: 1,
    jugadorActivo: jugadoresEstado[0].id,
    fase: { tipo: 'accion' },
    registro: [{ tipo: 'partidaIniciada', jugadores: jugadoresEstado.map((j) => j.id) }],
  }
}
