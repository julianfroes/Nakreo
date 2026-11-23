import type { CartaPerdida, EstadoProyectado, EstadoPublico } from '../game/proyeccion'

export type EstadoJugadorDescarte = 'vivo' | 'eliminado' | 'retirado'

export interface GrupoDescarte {
  jugador: { id: string; nombre: string; estado: EstadoJugadorDescarte }
  cartas: CartaPerdida[]
}

export interface Descarte {
  /** Solo los jugadores que han perdido alguna carta, en orden de asiento. */
  grupos: GrupoDescarte[]
  /** Total de cartas perdidas en la partida. */
  total: number
}

/**
 * El descarte: las cartas perdidas de todos, agrupadas por jugador. Es
 * información PÚBLICA (las cartas perdidas están boca arriba), así que solo se
 * lee `cartasReveladas`: nunca una carta viva ni el mazo. El resultado es el
 * mismo para cualquier observador.
 */
export function calcularDescarte(p: Pick<EstadoProyectado | EstadoPublico, 'jugadores'>): Descarte {
  const grupos = p.jugadores
    .filter((j) => j.cartasReveladas.length > 0)
    .map((j) => ({
      jugador: {
        id: j.id,
        nombre: j.nombre,
        estado: (j.retirado ? 'retirado' : j.eliminado ? 'eliminado' : 'vivo') as EstadoJugadorDescarte,
      },
      cartas: j.cartasReveladas.map((c) => ({ rol: c.rol, especial: c.especial })),
    }))
  return { grupos, total: grupos.reduce((n, g) => n + g.cartas.length, 0) }
}
