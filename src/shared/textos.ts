/** Textos en español para registro y estado. Solo usan información pública. */
import type { EstadoPublico } from '../game/proyeccion'
import { ACCIONES, ROLES } from '../game/roles'
import type { Accion, EventoJuego } from '../game/types'

type Nombre = (id: string) => string

export function describirAccion(a: Accion, nombre: Nombre): string {
  const base = `${nombre(a.actor)}: ${ACCIONES[a.tipo].nombre}`
  return a.objetivo ? `${base} → ${nombre(a.objetivo)}` : base
}

/** Texto del registro público para un evento (nunca incluye información oculta). */
export function textoEvento(ev: EventoJuego, n: Nombre): string {
  switch (ev.tipo) {
    case 'partidaIniciada':
      return 'La partida ha comenzado'
    case 'turnoIniciado':
      return `Turno de ${n(ev.jugador)}`
    case 'accionDeclarada':
      return describirAccion(ev.accion, n)
    case 'creditosCambiados':
      return `${n(ev.jugador)} ${ev.delta > 0 ? '+' : ''}${ev.delta} créditos`
    case 'desafioLanzado':
      return `${n(ev.desafiante)} acusó a ${n(ev.acusado)} de ser ${ROLES[ev.rol].nombre}`
    case 'cartaMostrada':
      return `${n(ev.jugador)} muestra ${ROLES[ev.rol].nombre}`
    case 'desafioResuelto':
      return ev.acusadoTeniaRol
        ? `${n(ev.acusado)} decía la verdad`
        : `${n(ev.acusado)} mentía`
    case 'cartaIntercambiada':
      return `${n(ev.jugador)} cambia su carta por una del mazo`
    case 'bloqueoDeclarado':
      return `${n(ev.bloqueador)} bloquea como ${ROLES[ev.rol].nombre}`
    case 'cartaPerdida':
      return `${n(ev.jugador)} pierde ${ROLES[ev.rol].nombre}`
    case 'jugadorEliminado':
      return `${n(ev.jugador)} ha sido eliminado`
    case 'reasignacionRealizada':
      return `${n(ev.jugador)} reasigna sus cartas`
    case 'accionCancelada':
      return `Acción cancelada: ${ACCIONES[ev.accion.tipo].nombre}`
    case 'partidaTerminada':
      return `¡${n(ev.ganador)} gana la partida!`
  }
}

/** Frase que resume qué está pasando en la mesa según la fase. */
export function describirFase(
  p: Pick<EstadoPublico, 'fase' | 'jugadores' | 'jugadorActivo'>,
): string {
  const n: Nombre = (id) => p.jugadores.find((j) => j.id === id)?.nombre ?? id
  const lista = (ids: string[]) => ids.map(n).join(', ')
  const f = p.fase
  switch (f.tipo) {
    case 'accion':
      return `Turno de ${n(p.jugadorActivo)}: elige una acción`
    case 'ventanaDesafioAccion':
      return `${describirAccion(f.accion, n)}. ¿Alguien desafía? Esperando a ${lista(f.pendientes)}`
    case 'ventanaBloqueo':
      return `${describirAccion(f.accion, n)}. ¿Alguien bloquea? Esperando a ${lista(f.pendientes)}`
    case 'ventanaDesafioBloqueo':
      return `${n(f.bloqueo.jugador)} bloquea como ${ROLES[f.bloqueo.rol].nombre}. ¿Alguien desafía? Esperando a ${lista(f.pendientes)}`
    case 'revelacion':
      return `${n(f.acusado)} debe probar que es ${ROLES[f.rol].nombre}`
    case 'perdiendoCarta':
      return `${n(f.jugador)} elige qué carta perder`
    case 'reasignando':
      return `${n(f.jugador)} reasigna sus cartas`
    case 'fin':
      return `¡${n(f.ganador)} gana la partida!`
  }
}
