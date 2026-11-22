/** Constantes de reglas. Todo lo "balanceable" vive aquí. */
export const MIN_JUGADORES = 2
export const MAX_JUGADORES = 6
export const CREDITOS_INICIALES = 2
export const CARTAS_POR_JUGADOR = 2
export const COPIAS_POR_ROL = 3

/**
 * Límite de créditos: un jugador con este número de créditos o más NO puede
 * realizar acciones que generen créditos (Ingreso, Subsidio, Dividendos,
 * Desvío). Debe gastar: Sabotaje, Golpe de Mando o Reasignación.
 */
export const LIMITE_CREDITOS = 14

export const GANANCIA_INGRESO = 1
export const GANANCIA_SUBSIDIO = 2
export const GANANCIA_DIVIDENDOS = 3
/** Créditos que roba el Desvío (como máximo). */
export const ROBO_DESVIO = 2

export const GOLPE_COSTE = 7
export const SABOTAJE_COSTE = 3

/** Cartas que roba el Ingeniero del mazo en su Reasignación. */
export const CARTAS_REASIGNACION = 2
