import {
  DEMANDA_COSTE,
  DESPIDO_COSTE,
  GANANCIA_MALVERSACION,
  GANANCIA_NOMINA,
  GANANCIA_ROBO_AGUINALDO,
  GANANCIA_SUELDO_MINIMO,
  ROBO_MERITO,
} from './config'
import type { Carta, Reclamo, Rol, TipoAccion } from './types'

export const ROLES: Record<Rol, { nombre: string }> = {
  rh: { nombre: 'RH' },
  ceo: { nombre: 'CEO' },
  jefeArea: { nombre: 'Jefe de Área' },
  ingeniero: { nombre: 'Ingeniero' },
  sindicalizado: { nombre: 'Sindicalizado' },
}

export const TODOS_LOS_ROLES = Object.keys(ROLES) as Rol[]

/**
 * Habilidad extra de la carta especial de cada rol. `unSoloUso`: si nadie la
 * desafía, el jugador devuelve su mano viva al mazo y roba otra.
 */
export const HABILIDADES_ESPECIALES: Record<Rol, { nombre: string; unSoloUso: boolean }> = {
  rh: { nombre: 'Robo de aguinaldo', unSoloUso: false },
  ceo: { nombre: 'Renuncia «voluntaria»', unSoloUso: false },
  jefeArea: { nombre: 'Excusa de mérito', unSoloUso: true },
  ingeniero: { nombre: 'Explotar el site', unSoloUso: true },
  sindicalizado: { nombre: 'Contrademanda', unSoloUso: true },
}

/** Nombre legible de un reclamo: «Ingeniero» o «Ingeniero Especial». */
export const nombreReclamo = (r: Reclamo): string =>
  r.especial ? `${ROLES[r.rol].nombre} Especial` : ROLES[r.rol].nombre

/** ¿Esta carta satisface el reclamo? La especial vale también como la normal. */
export const cumpleReclamo = (c: Pick<Carta, 'rol' | 'especial'>, r: Reclamo): boolean =>
  c.rol === r.rol && (!r.especial || !!c.especial)

export interface DefinicionAccion {
  /** Nombre sin cifras (para tablas y reglas): «Sueldo mínimo». */
  titulo: string
  /** Etiqueta para botones y registro, con la cifra relevante: «Sueldo mínimo (+1)». */
  nombre: string
  coste: number
  /** Rol que hay que tener (o aparentar). null = acción general, no desafiable. */
  rolRequerido: Rol | null
  /** Requiere la carta especial del rol (desafío con penalización doble). */
  especial: boolean
  necesitaObjetivo: boolean
  /** Ataque: si llega a caer, el objetivo pierde una carta (y puede «explotar el site»). */
  ataque: boolean
  /** Sujeta al límite de créditos. */
  generaCreditos: boolean
  /** Reclamos con los que se puede bloquear. */
  bloqueablePor: Reclamo[]
  /** true = solo el objetivo puede bloquear; false = cualquiera. */
  soloObjetivoBloquea: boolean
}

const R = (rol: Rol, especial = false): Reclamo => ({ rol, especial })

export const ACCIONES: Record<TipoAccion, DefinicionAccion> = {
  sueldoMinimo: {
    titulo: 'Sueldo mínimo',
    nombre: `Sueldo mínimo (+${GANANCIA_SUELDO_MINIMO})`,
    coste: 0, rolRequerido: null, especial: false, necesitaObjetivo: false, ataque: false, generaCreditos: true,
    bloqueablePor: [], soloObjetivoBloquea: false,
  },
  nomina: {
    titulo: 'Nómina',
    nombre: `Nómina (+${GANANCIA_NOMINA})`,
    coste: 0, rolRequerido: null, especial: false, necesitaObjetivo: false, ataque: false, generaCreditos: true,
    bloqueablePor: [R('rh')], soloObjetivoBloquea: false,
  },
  demandaLaboral: {
    titulo: 'Demanda laboral',
    nombre: 'Demanda laboral',
    coste: DEMANDA_COSTE, rolRequerido: null, especial: false, necesitaObjetivo: true, ataque: true, generaCreditos: false,
    // Solo el objetivo, y solo con el Sindicalizado Especial (Contrademanda, un solo uso).
    bloqueablePor: [R('sindicalizado', true)], soloObjetivoBloquea: true,
  },
  malversacion: {
    titulo: 'Malversación',
    nombre: `Malversación (+${GANANCIA_MALVERSACION})`,
    coste: 0, rolRequerido: 'rh', especial: false, necesitaObjetivo: false, ataque: false, generaCreditos: true,
    bloqueablePor: [], soloObjetivoBloquea: false,
  },
  roboAguinaldo: {
    titulo: HABILIDADES_ESPECIALES.rh.nombre,
    nombre: `${HABILIDADES_ESPECIALES.rh.nombre} (+${GANANCIA_ROBO_AGUINALDO})`,
    coste: 0, rolRequerido: 'rh', especial: true, necesitaObjetivo: false, ataque: false, generaCreditos: true,
    bloqueablePor: [], soloObjetivoBloquea: false,
  },
  despido: {
    titulo: 'Despido',
    nombre: 'Despido',
    coste: DESPIDO_COSTE, rolRequerido: 'ceo', especial: false, necesitaObjetivo: true, ataque: true, generaCreditos: false,
    bloqueablePor: [R('sindicalizado')], soloObjetivoBloquea: true,
  },
  renuncia: {
    titulo: HABILIDADES_ESPECIALES.ceo.nombre,
    nombre: HABILIDADES_ESPECIALES.ceo.nombre,
    coste: DESPIDO_COSTE, rolRequerido: 'ceo', especial: true, necesitaObjetivo: true, ataque: true, generaCreditos: false,
    // Salta a los Sindicalizados normales: solo frena el Especial.
    bloqueablePor: [R('sindicalizado', true)], soloObjetivoBloquea: true,
  },
  roboMerito: {
    titulo: 'Robo de mérito',
    nombre: `Robo de mérito (roba ${ROBO_MERITO})`,
    coste: 0, rolRequerido: 'jefeArea', especial: false, necesitaObjetivo: true, ataque: false, generaCreditos: true,
    bloqueablePor: [R('jefeArea'), R('ingeniero')], soloObjetivoBloquea: true,
  },
  reasignacion: {
    titulo: 'Reasignación',
    nombre: 'Reasignación',
    coste: 0, rolRequerido: 'ingeniero', especial: false, necesitaObjetivo: false, ataque: false, generaCreditos: false,
    bloqueablePor: [], soloObjetivoBloquea: false,
  },
}

/** Reclamos que pueden bloquear la acción en este modo (sin especiales no existen los especiales). */
export const bloqueosVigentes = (tipo: TipoAccion, especiales: boolean): Reclamo[] =>
  ACCIONES[tipo].bloqueablePor.filter((r) => especiales || !r.especial)

/** ¿Existe esta acción en el modo de juego? Las especiales solo existen con cartas especiales. */
export const accionDisponible = (tipo: TipoAccion, especiales: boolean): boolean =>
  especiales || !ACCIONES[tipo].especial

/** Reclamo que implica declarar esta acción, o null si es una acción general. */
export const reclamoDeAccion = (tipo: TipoAccion): Reclamo | null => {
  const d = ACCIONES[tipo]
  return d.rolRequerido ? { rol: d.rolRequerido, especial: d.especial } : null
}
