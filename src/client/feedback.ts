import type { Vista } from './vista'

export type SenalFeedback = 'miTurno' | 'meDesafian' | 'atencion'

/** Patrones de vibración en ms. */
export const PATRONES: Record<SenalFeedback, number[]> = {
  miTurno: [120, 60, 120],
  meDesafian: [300, 100, 300, 100, 300],
  atencion: [60],
}

/** Qué señal corresponde al pasar de la vista anterior a la nueva (null = ninguna). */
export function detectarSenal(anterior: Vista | null, nueva: Vista): SenalFeedback | null {
  if (anterior?.tipo === nueva.tipo) return null // solo en transiciones
  switch (nueva.tipo) {
    case 'elegirAccion':
      return 'miTurno'
    case 'defenderse':
      return 'meDesafian'
    case 'responderDesafio':
    case 'responderBloqueo':
    case 'responderDesafioBloqueo':
    case 'perderCarta':
    case 'reasignar':
      return 'atencion'
    default:
      return null
  }
}

/** iOS Safari no soporta vibración: se ignora sin error (queda el feedback visual). */
export function vibrar(senal: SenalFeedback) {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate(PATRONES[senal])
  }
}
