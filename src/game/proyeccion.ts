/**
 * PROYECCIÓN DE ESTADO — frontera de seguridad del juego.
 *
 * El anfitrión mantiene el `EstadoJuego` completo (manos, mazo, cartas robadas).
 * Cada cliente solo debe recibir lo que le corresponde ver, y eso lo decide
 * ESTA función. Toda comunicación hacia un cliente debe pasar por aquí.
 *
 * Regla de diseño: LISTA BLANCA. Cada objeto de salida se construye campo por
 * campo. Nunca se hace `...jugador` ni se copia una estructura del estado
 * completo sin revisarla: si mañana se añade un campo oculto al estado, no
 * debe filtrarse por accidente. Además todo se copia (sin referencias
 * compartidas con el estado del host).
 */
import type { Carta, CartaEnMano, EstadoJuego, EventoJuego, Fase, Rol } from './types'

/** Lo que cualquiera puede saber de un jugador (incluido uno mismo). */
export interface JugadorPublico {
  id: string
  nombre: string
  creditos: number
  eliminado: boolean
  /** Solo el NÚMERO de cartas ocultas; nunca cuáles son. */
  cartasVivas: number
  /** Cartas perdidas: están boca arriba para todos. */
  cartasReveladas: Rol[]
}

export interface YoProyectado {
  id: string
  nombre: string
  creditos: number
  /** Mi mano completa: vivas y reveladas. */
  mano: CartaEnMano[]
}

/**
 * Igual que `Fase`, pero `reasignando` solo incluye `robadas` para su dueño
 * (son las cartas que el Ingeniero robó del mazo y aún no ha decidido).
 * El resto de fases solo contienen ids de jugador, acciones y roles
 * reclamados, que son públicos.
 */
export type FaseProyectada =
  | Exclude<Fase, { tipo: 'reasignando' }>
  | { tipo: 'reasignando'; jugador: string; robadas?: Carta[] }

export interface EstadoProyectado {
  yo: YoProyectado
  jugadores: JugadorPublico[]
  /** Cantidad de cartas en el mazo (dato deliberadamente público, sin contenido). */
  mazoRestante: number
  turno: number
  jugadorActivo: string
  fase: FaseProyectada
  registro: EventoJuego[]
}

function proyectarFase(fase: Fase, idJugador: string | null): FaseProyectada {
  if (fase.tipo === 'reasignando') {
    return fase.jugador === idJugador
      ? {
          tipo: 'reasignando',
          jugador: fase.jugador,
          robadas: fase.robadas.map((c) => ({ id: c.id, rol: c.rol })),
        }
      : { tipo: 'reasignando', jugador: fase.jugador } // sin `robadas`
  }
  // Resto de fases: solo datos públicos. Se clona para no compartir referencias.
  return structuredClone(fase)
}

function proyectarJugadoresPublicos(estado: EstadoJuego): JugadorPublico[] {
  return estado.jugadores.map((j) => ({
    id: j.id,
    nombre: j.nombre,
    creditos: j.creditos,
    eliminado: j.eliminado,
    cartasVivas: j.cartas.filter((c) => !c.revelada).length,
    // Solo las cartas ya perdidas (públicas). El `rol` de una carta viva ajena
    // jamás se lee aquí fuera de este filtro.
    cartasReveladas: j.cartas.filter((c) => c.revelada).map((c) => c.rol),
  }))
}

export function proyectarEstado(estado: EstadoJuego, idJugador: string): EstadoProyectado {
  const yo = estado.jugadores.find((j) => j.id === idJugador)
  if (!yo) throw new Error(`Jugador desconocido: ${idJugador}`)

  return {
    yo: {
      id: yo.id,
      nombre: yo.nombre,
      creditos: yo.creditos,
      mano: yo.cartas.map((c) => ({ id: c.id, rol: c.rol, revelada: c.revelada })),
    },
    jugadores: proyectarJugadoresPublicos(estado),
    mazoRestante: estado.mazo.length,
    turno: estado.turno,
    jugadorActivo: estado.jugadorActivo,
    fase: proyectarFase(estado.fase, idJugador),
    registro: structuredClone(estado.registro),
  }
}

/**
 * Vista PÚBLICA de la mesa (pantalla del anfitrión, p. ej. una TV): lo que ve
 * cualquier espectador. No incluye mano propia, ni mazo (solo su tamaño), ni
 * las cartas robadas por el Ingeniero. No contiene ningún id de carta.
 */
export interface EstadoPublico {
  jugadores: JugadorPublico[]
  mazoRestante: number
  turno: number
  jugadorActivo: string
  fase: Exclude<FaseProyectada, { tipo: 'reasignando' }> | { tipo: 'reasignando'; jugador: string }
  registro: EventoJuego[]
}

export function proyectarPublico(estado: EstadoJuego): EstadoPublico {
  return {
    jugadores: proyectarJugadoresPublicos(estado),
    mazoRestante: estado.mazo.length,
    turno: estado.turno,
    jugadorActivo: estado.jugadorActivo,
    // idJugador = null: nadie es dueño de las cartas robadas, así que se omiten.
    fase: proyectarFase(estado.fase, null) as EstadoPublico['fase'],
    registro: structuredClone(estado.registro),
  }
}
