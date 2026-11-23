/** Constantes de reglas. Todo lo "balanceable" vive aquí. */
export const MIN_JUGADORES = 2
/** Máximo de jugadores con cartas especiales (mazo de 20 cartas). */
export const MAX_JUGADORES_CON_ESPECIALES = 8
/** Máximo de jugadores sin cartas especiales (mazo de 15 cartas). */
export const MAX_JUGADORES_SIN_ESPECIALES = 6
/** Aforo de la sala según el modo de juego. */
export const maxJugadores = (especiales: boolean): number =>
  especiales ? MAX_JUGADORES_CON_ESPECIALES : MAX_JUGADORES_SIN_ESPECIALES
export const CREDITOS_INICIALES = 2
export const CARTAS_POR_JUGADOR = 2
export const COPIAS_POR_ROL = 3
/** Cartas especiales por rol (se suman a las copias normales). */
export const COPIAS_ESPECIALES_POR_ROL = 1

/**
 * Límite de créditos: un jugador con este número de créditos o más NO puede
 * realizar acciones que generen créditos (Sueldo mínimo, Nómina, Malversación,
 * Robo de aguinaldo, Robo de mérito). Debe gastar: Despido, Renuncia, Demanda laboral o Reasignación.
 */
export const LIMITE_CREDITOS = 14

export const GANANCIA_SUELDO_MINIMO = 1
export const GANANCIA_NOMINA = 2
export const GANANCIA_MALVERSACION = 3
export const GANANCIA_ROBO_AGUINALDO = 4
/** Créditos que roba, como máximo, el Robo de mérito. */
export const ROBO_MERITO = 2

export const DEMANDA_COSTE = 7
export const DESPIDO_COSTE = 3

/** Cartas que roba el Ingeniero del mazo en su Reasignación. */
export const CARTAS_REASIGNACION = 2

/** Créditos que paga el Ingeniero Especial al explotar el site (o 1 si solo tiene 1). */
export const EXPLOSION_COSTE = 2
/** Cartas que se pierden al fallar (o desafiar mal) un reclamo especial. */
export const PENALIZACION_ESPECIAL = 2
