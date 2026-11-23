/** Textos en español para registro y estado. Solo usan información pública. */
import type { EstadoPublico } from '../game/proyeccion'
import { ACCIONES, nombreReclamo } from '../game/roles'
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
      return `${n(ev.desafiante)} acusó a ${n(ev.acusado)} de ser ${nombreReclamo(ev)}`
    case 'cartaMostrada':
      return `${n(ev.jugador)} muestra ${nombreReclamo(ev)}`
    case 'desafioResuelto':
      return ev.acusadoTeniaRol
        ? `${n(ev.acusado)} decía la verdad`
        : `${n(ev.acusado)} mentía`
    case 'cartaIntercambiada':
      return `${n(ev.jugador)} cambia su carta por una del mazo`
    case 'bloqueoDeclarado':
      return `${n(ev.bloqueador)} ${ev.contra ? 'contrabloquea' : 'bloquea'} como ${nombreReclamo(ev)}`
    case 'cartaPerdida':
      return `${n(ev.jugador)} pierde ${nombreReclamo(ev)}`
    case 'jugadorEliminado':
      return `${n(ev.jugador)} ha sido eliminado`
    case 'jugadorRetirado':
      return `${n(ev.jugador)} abandonó la partida`
    case 'siteExplotado':
      return `${n(ev.jugador)} paga ${ev.pago} y declara: ¡explotar el site! (Ingeniero Especial)`
    case 'salvacionDeclarada':
      return `${n(ev.jugador)} usa la Excusa de mérito (Jefe de Área Especial)`
    case 'manoRenovada':
      return `${n(ev.jugador)} devuelve sus cartas al mazo y roba nuevas`
    case 'reasignacionRealizada':
      return `${n(ev.jugador)} reasigna sus cartas`
    case 'accionCancelada':
      return `Acción cancelada: ${ACCIONES[ev.accion.tipo].nombre}`
    case 'partidaTerminada':
      return `¡${n(ev.ganador)} gana la partida!`
  }
}

/** Color con el que se resalta un evento en los registros (mesa y panel del jugador). */
export function colorEvento(tipo: EventoJuego['tipo']): string {
  if (
    tipo === 'desafioLanzado' ||
    tipo === 'cartaPerdida' ||
    tipo === 'jugadorEliminado' ||
    tipo === 'jugadorRetirado'
  ) {
    return 'text-rose-300'
  }
  if (tipo === 'partidaTerminada' || tipo === 'turnoIniciado') return 'text-cyan-300'
  return 'text-slate-300'
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
      return f.contra
        ? `${describirAccion(f.accion, n)}. RH la bloquea: ${lista(f.pendientes)} decide si contrabloquea como Ingeniero`
        : `${describirAccion(f.accion, n)}. ¿Alguien bloquea? Esperando a ${lista(f.pendientes)}`
    case 'ventanaDesafioBloqueo':
      return `${n(f.bloqueo.jugador)} ${f.bloqueo.contra ? 'contrabloquea' : 'bloquea'} como ${nombreReclamo(f.bloqueo)}. ¿Alguien desafía? Esperando a ${lista(f.pendientes)}`
    case 'revelacion':
      return `${n(f.acusado)} debe probar que es ${nombreReclamo(f)}`
    case 'ventanaIngeniero':
      return `${describirAccion(f.accion, n)}. ${n(f.pendientes[0])} decide si explota el site`
    case 'ventanaDesafioReaccion':
      return f.reaccion.tipo === 'explosion'
        ? `${n(f.reaccion.jugador)} declara Ingeniero Especial. ¿Alguien desafía? Esperando a ${lista(f.pendientes)}`
        : `${n(f.reaccion.jugador)} usa la Excusa de mérito (Jefe de Área Especial). ¿Alguien desafía? Esperando a ${lista(f.pendientes)}`
    case 'perdiendoCarta':
      return `${n(f.jugador)} elige qué carta perder`
    case 'reasignando':
      return `${n(f.jugador)} reasigna sus cartas`
    case 'fin':
      return `¡${n(f.ganador)} gana la partida!`
  }
}
