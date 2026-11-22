/**
 * Decide QUÉ debe ver y poder hacer el jugador a partir de su proyección.
 * Es una función pura (testeable) y solo lee `EstadoProyectado`, así que no
 * puede mostrar nada que la proyección no haya entregado ya.
 */
import { LIMITE_CREDITOS } from '../game/config'
import type { EstadoProyectado, JugadorPublico } from '../game/proyeccion'
import { ACCIONES } from '../game/roles'
import type { Accion, Carta, CartaEnMano, Rol, TipoAccion } from '../game/types'

export interface AccionUI {
  tipo: TipoAccion
  nombre: string
  coste: number
  necesitaObjetivo: boolean
  rolRequerido: Rol | null
  habilitada: boolean
  /** Por qué está deshabilitada. */
  motivo?: string
}

export type Vista =
  | { tipo: 'fin'; ganador: string; gane: boolean }
  | { tipo: 'eliminado' }
  | { tipo: 'elegirAccion'; acciones: AccionUI[]; objetivos: JugadorPublico[] }
  | { tipo: 'responderDesafio'; accion: Accion }
  | { tipo: 'responderBloqueo'; accion: Accion; roles: Rol[] }
  | { tipo: 'responderDesafioBloqueo'; accion: Accion; bloqueador: string; rol: Rol }
  /** Me desafían: debo probar que tengo `rol` o rendirme. */
  | { tipo: 'defenderse'; rol: Rol; desafiante: string; accion: Accion }
  | { tipo: 'perderCarta' }
  | { tipo: 'reasignar'; opciones: (Carta | CartaEnMano)[]; cuantas: number }
  | { tipo: 'esperando'; mensaje: string }

export const nombreDe = (p: EstadoProyectado, id: string): string =>
  p.jugadores.find((j) => j.id === id)?.nombre ?? id

function accionesDisponibles(p: EstadoProyectado): AccionUI[] {
  const creditos = p.yo.creditos
  return (Object.keys(ACCIONES) as TipoAccion[]).map((tipo) => {
    const d = ACCIONES[tipo]
    let motivo: string | undefined
    if (creditos < d.coste) motivo = `Necesitas ${d.coste} créditos`
    else if (d.generaCreditos && creditos >= LIMITE_CREDITOS) {
      motivo = `Con ${LIMITE_CREDITOS}+ créditos debes gastar`
    }
    return {
      tipo,
      nombre: d.nombre,
      coste: d.coste,
      necesitaObjetivo: d.necesitaObjetivo,
      rolRequerido: d.rolRequerido,
      habilitada: motivo === undefined,
      motivo,
    }
  })
}

function esperaA(p: EstadoProyectado, ids: string[]): string {
  return ids.length ? `Esperando a ${ids.map((i) => nombreDe(p, i)).join(', ')}…` : 'Esperando…'
}

export function calcularVista(p: EstadoProyectado): Vista {
  const yo = p.yo.id
  const f = p.fase

  if (f.tipo === 'fin') return { tipo: 'fin', ganador: f.ganador, gane: f.ganador === yo }
  if (p.yo.mano.every((c) => c.revelada)) return { tipo: 'eliminado' }

  switch (f.tipo) {
    case 'accion':
      if (p.jugadorActivo === yo) {
        return {
          tipo: 'elegirAccion',
          acciones: accionesDisponibles(p),
          objetivos: p.jugadores.filter((j) => !j.eliminado && j.id !== yo),
        }
      }
      return { tipo: 'esperando', mensaje: `Turno de ${nombreDe(p, p.jugadorActivo)}` }

    case 'ventanaDesafioAccion':
      return f.pendientes.includes(yo)
        ? { tipo: 'responderDesafio', accion: f.accion }
        : { tipo: 'esperando', mensaje: esperaA(p, f.pendientes) }

    case 'ventanaBloqueo':
      return f.pendientes.includes(yo)
        ? { tipo: 'responderBloqueo', accion: f.accion, roles: ACCIONES[f.accion.tipo].bloqueablePor }
        : { tipo: 'esperando', mensaje: esperaA(p, f.pendientes) }

    case 'ventanaDesafioBloqueo':
      return f.pendientes.includes(yo)
        ? {
            tipo: 'responderDesafioBloqueo',
            accion: f.accion,
            bloqueador: f.bloqueo.jugador,
            rol: f.bloqueo.rol,
          }
        : { tipo: 'esperando', mensaje: esperaA(p, f.pendientes) }

    case 'revelacion':
      return f.acusado === yo
        ? { tipo: 'defenderse', rol: f.rol, desafiante: f.desafiante, accion: f.accion }
        : { tipo: 'esperando', mensaje: `${nombreDe(p, f.acusado)} debe mostrar su carta…` }

    case 'perdiendoCarta':
      return f.jugador === yo
        ? { tipo: 'perderCarta' }
        : { tipo: 'esperando', mensaje: `${nombreDe(p, f.jugador)} elige qué carta perder…` }

    case 'reasignando':
      if (f.jugador === yo && f.robadas) {
        const vivas = p.yo.mano.filter((c) => !c.revelada)
        return { tipo: 'reasignar', opciones: [...vivas, ...f.robadas], cuantas: vivas.length }
      }
      return { tipo: 'esperando', mensaje: `${nombreDe(p, f.jugador)} reasigna sus cartas…` }
  }
}
