import {
  GANANCIA_DIVIDENDOS,
  GANANCIA_INGRESO,
  GANANCIA_SUBSIDIO,
  GOLPE_COSTE,
  ROBO_DESVIO,
  SABOTAJE_COSTE,
} from './config'
import type { Rol, TipoAccion } from './types'

export const ROLES: Record<Rol, { nombre: string }> = {
  directorFinanciero: { nombre: 'Director Financiero' },
  saboteador: { nombre: 'Saboteador' },
  contrabandista: { nombre: 'Contrabandista' },
  ingeniero: { nombre: 'Ingeniero' },
  jefeSeguridad: { nombre: 'Jefe de Seguridad' },
}

export const TODOS_LOS_ROLES = Object.keys(ROLES) as Rol[]

export interface DefinicionAccion {
  nombre: string
  coste: number
  /** Rol que hay que tener (o aparentar). null = acción general, no desafiable. */
  rolRequerido: Rol | null
  necesitaObjetivo: boolean
  /** Sujeta al límite de créditos. */
  generaCreditos: boolean
  /** Roles con los que se puede bloquear. */
  bloqueablePor: Rol[]
  /** true = solo el objetivo puede bloquear; false = cualquiera. */
  soloObjetivoBloquea: boolean
}

export const ACCIONES: Record<TipoAccion, DefinicionAccion> = {
  ingreso: {
    nombre: `Ingreso (+${GANANCIA_INGRESO})`,
    coste: 0, rolRequerido: null, necesitaObjetivo: false, generaCreditos: true,
    bloqueablePor: [], soloObjetivoBloquea: false,
  },
  subsidio: {
    nombre: `Subsidio (+${GANANCIA_SUBSIDIO})`,
    coste: 0, rolRequerido: null, necesitaObjetivo: false, generaCreditos: true,
    bloqueablePor: ['directorFinanciero'], soloObjetivoBloquea: false,
  },
  golpe: {
    nombre: 'Golpe de Mando',
    coste: GOLPE_COSTE, rolRequerido: null, necesitaObjetivo: true, generaCreditos: false,
    bloqueablePor: [], soloObjetivoBloquea: false,
  },
  dividendos: {
    nombre: `Dividendos (+${GANANCIA_DIVIDENDOS})`,
    coste: 0, rolRequerido: 'directorFinanciero', necesitaObjetivo: false, generaCreditos: true,
    bloqueablePor: [], soloObjetivoBloquea: false,
  },
  sabotaje: {
    nombre: 'Sabotaje',
    coste: SABOTAJE_COSTE, rolRequerido: 'saboteador', necesitaObjetivo: true, generaCreditos: false,
    bloqueablePor: ['jefeSeguridad'], soloObjetivoBloquea: true,
  },
  desvio: {
    nombre: `Desvío (roba ${ROBO_DESVIO})`,
    coste: 0, rolRequerido: 'contrabandista', necesitaObjetivo: true, generaCreditos: true,
    bloqueablePor: ['contrabandista', 'ingeniero'], soloObjetivoBloquea: true,
  },
  reasignacion: {
    nombre: 'Reasignación',
    coste: 0, rolRequerido: 'ingeniero', necesitaObjetivo: false, generaCreditos: false,
    bloqueablePor: [], soloObjetivoBloquea: false,
  },
}
