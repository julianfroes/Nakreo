/**
 * Decide QUÉ debe ver y poder hacer el jugador a partir de su proyección.
 * Es una función pura (testeable) y solo lee `EstadoProyectado`, así que no
 * puede mostrar nada que la proyección no haya entregado ya.
 */
import { EXPLOSION_COSTE, LIMITE_CREDITOS } from '../game/config'
import type { EstadoProyectado, JugadorPublico } from '../game/proyeccion'
import { ACCIONES, accionDisponible, bloqueosVigentes } from '../game/roles'
import type { Accion, Carta, CartaEnMano, Reaccion, Reclamo, Rol, TipoAccion } from '../game/types'

export interface AccionUI {
  tipo: TipoAccion
  nombre: string
  coste: number
  necesitaObjetivo: boolean
  rolRequerido: Rol | null
  /** Requiere la carta especial del rol. */
  especial: boolean
  habilitada: boolean
  /** Por qué está deshabilitada. */
  motivo?: string
}

export type Vista =
  /** Abandoné la partida: ya no puedo volver a entrar en ella. */
  | { tipo: 'retirado' }
  | { tipo: 'fin'; ganador: string; gane: boolean }
  | { tipo: 'eliminado' }
  | { tipo: 'elegirAccion'; acciones: AccionUI[]; objetivos: JugadorPublico[] }
  | { tipo: 'responderDesafio'; accion: Accion }
  /**
   * Puedo bloquear alegando alguno de `roles`. Si `explosion`, y soy el objetivo de un
   * ataque, también puedo «explotar el site» desde aquí (a la vez; no hace falta bloquear antes).
   */
  | {
      tipo: 'responderBloqueo'
      accion: Accion
      roles: Reclamo[]
      explosion: { pago: number } | null
      /** Contrabloqueo: me bloquearon la acción y puedo alegar Ingeniero para anular el bloqueo. */
      contra: boolean
    }
  | { tipo: 'responderDesafioBloqueo'; accion: Accion; bloqueador: string; reclamo: Reclamo }
  /** Me atacan (Demanda/Despido): puedo «explotar el site» (Ingeniero Especial). */
  | { tipo: 'explotarSite'; accion: Accion; pago: number }
  /** Alguien reacciona con una habilidad especial: ¿lo desafío? */
  | { tipo: 'responderDesafioReaccion'; accion: Accion; reaccion: Reaccion }
  /**
   * Me desafían: debo probar que tengo `reclamo`, rendirme o (antes de mostrar
   * carta) declarar que me salvo con el Jefe de Área Especial (Excusa de mérito).
   */
  | { tipo: 'defenderse'; reclamo: Reclamo; desafiante: string; accion: Accion; puedeSalvarse: boolean }
  | { tipo: 'perderCarta' }
  | { tipo: 'reasignar'; opciones: (Carta | CartaEnMano)[]; cuantas: number }
  | { tipo: 'esperando'; mensaje: string }

export const nombreDe = (p: EstadoProyectado, id: string): string =>
  p.jugadores.find((j) => j.id === id)?.nombre ?? id

function accionesDisponibles(p: EstadoProyectado): AccionUI[] {
  const creditos = p.yo.creditos
  return (Object.keys(ACCIONES) as TipoAccion[])
    .filter((tipo) => accionDisponible(tipo, p.especiales))
    .map((tipo) => {
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
        especial: d.especial,
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

  if (p.jugadores.find((j) => j.id === yo)?.retirado) return { tipo: 'retirado' }
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
        ? {
            tipo: 'responderBloqueo',
            accion: f.accion,
            roles: f.contra ? [ACCIONES[f.accion.tipo].contrabloqueo!] : bloqueosVigentes(f.accion.tipo, p.especiales),
            contra: !!f.contra,
            explosion: f.explosion ? { pago: Math.min(EXPLOSION_COSTE, p.yo.creditos) } : null,
          }
        : { tipo: 'esperando', mensaje: esperaA(p, f.pendientes) }

    case 'ventanaDesafioBloqueo':
      return f.pendientes.includes(yo)
        ? {
            tipo: 'responderDesafioBloqueo',
            accion: f.accion,
            bloqueador: f.bloqueo.jugador,
            reclamo: { rol: f.bloqueo.rol, especial: f.bloqueo.especial },
          }
        : { tipo: 'esperando', mensaje: esperaA(p, f.pendientes) }

    case 'ventanaIngeniero':
      return f.pendientes.includes(yo)
        ? { tipo: 'explotarSite', accion: f.accion, pago: Math.min(EXPLOSION_COSTE, p.yo.creditos) }
        : { tipo: 'esperando', mensaje: `${nombreDe(p, f.accion.objetivo ?? '')} decide si reacciona…` }

    case 'ventanaDesafioReaccion':
      return f.pendientes.includes(yo)
        ? { tipo: 'responderDesafioReaccion', accion: f.accion, reaccion: f.reaccion }
        : { tipo: 'esperando', mensaje: esperaA(p, f.pendientes) }

    case 'revelacion':
      return f.acusado === yo
        ? {
            tipo: 'defenderse',
            reclamo: { rol: f.rol, especial: f.especial },
            desafiante: f.desafiante,
            accion: f.accion,
            puedeSalvarse: p.especiales && f.origen !== 'reaccion',
          }
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
