/** Cliente: envía intenciones al host y recibe su proyección del estado. */
import type { EstadoProyectado } from '../game/proyeccion'
import type { EventoJuego } from '../game/types'
import { normalizarCodigo } from '../shared/codigoSala'
import {
  parsearMensajeHost,
  type IntencionCliente,
  type JugadorSala,
  type MensajeHost,
  type SalaInfo,
} from '../shared/protocolo'
import { crearLog, type Conexion, type Log } from '../shared/transporte'

export interface EventosCliente {
  alBienvenida?(idJugador: string): void
  alSala?(sala: SalaInfo): void
  alEstado?(proyeccion: EstadoProyectado, eventos: EventoJuego[]): void
  alError?(codigo: string, mensaje: string): void
  /** El anfitrión cerró la sala (mensaje explícito, sin esperar a que caiga la conexión). */
  alSalaCerrada?(): void
  alCerrar?(): void
}

/** Token secreto por sala; permite recuperar el asiento tras recargar la página. */
export function obtenerToken(codigo: string, almacen: Storage = sessionStorage): string {
  const clave = `nakreo-token-${codigo}`
  let token = almacen.getItem(clave)
  if (!token) {
    // getRandomValues funciona también fuera de contextos seguros (p. ej. http en LAN).
    const bytes = crypto.getRandomValues(new Uint8Array(16))
    token = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
    almacen.setItem(clave, token)
  }
  return token
}

export class ClienteConexion {
  idJugador: string | null = null
  jugadoresSala: JugadorSala[] = []
  ultimoEstado: EstadoProyectado | null = null
  private conexion: Conexion
  private eventos: EventosCliente
  private log: Log

  constructor(
    conexion: Conexion,
    nombre: string,
    token: string,
    eventos: EventosCliente = {},
    log: Log = crearLog('cliente'),
  ) {
    this.conexion = conexion
    this.eventos = eventos
    this.log = log
    conexion.alRecibir((raw) => this.alMensaje(raw))
    conexion.alCerrar(() => {
      this.log.warn('Conexión cerrada')
      this.eventos.alCerrar?.()
    })
    conexion.enviar({ tipo: 'unirse', nombre, token })
  }

  /** Envía una intención (sin `jugador`: el host te identifica por la conexión). */
  enviar(intencion: IntencionCliente) {
    this.log.info('→ intención', intencion.tipo)
    this.conexion.enviar({ tipo: 'intencion', intencion })
  }

  /** Marca o desmarca «estoy listo» (guía visual del lobby; el host lo valida). */
  marcarListo(listo: boolean) {
    this.conexion.enviar({ tipo: 'listo', listo })
  }

  cerrar() {
    this.conexion.cerrar()
  }

  private alMensaje(raw: unknown) {
    const msg: MensajeHost | null = parsearMensajeHost(raw)
    if (!msg) return this.log.warn('Mensaje del host inválido descartado')
    switch (msg.tipo) {
      case 'bienvenida':
        this.idJugador = msg.idJugador
        this.log.info('← bienvenida, soy', msg.idJugador)
        return this.eventos.alBienvenida?.(msg.idJugador)
      case 'sala':
        this.jugadoresSala = msg.jugadores
        this.log.info('← sala', msg.jugadores.map((j) => `${j.nombre}${j.conectado ? '' : ' (off)'}`), msg.iniciada ? 'iniciada' : 'en lobby')
        return this.eventos.alSala?.({
          jugadores: msg.jugadores,
          iniciada: msg.iniciada,
          especiales: msg.especiales,
          max: msg.max,
        })
      case 'estado':
        this.ultimoEstado = msg.proyeccion
        this.log.info('← estado', msg.proyeccion.fase.tipo, `eventos nuevos: ${msg.eventos.length}`)
        return this.eventos.alEstado?.(msg.proyeccion, msg.eventos)
      case 'error':
        this.log.warn('← error', msg.codigo, msg.mensaje)
        return this.eventos.alError?.(msg.codigo, msg.mensaje)
      case 'salaCerrada':
        this.log.info('← sala cerrada por el anfitrión')
        return this.eventos.alSalaCerrada?.()
    }
  }
}

/** Conecta con la sala `codigo` y se une con `nombre`. */
export async function unirseASala(
  codigoCrudo: string,
  nombre: string,
  conectar: (codigo: string) => Promise<Conexion>,
  eventos?: EventosCliente,
  almacen?: Storage,
): Promise<ClienteConexion> {
  const codigo = normalizarCodigo(codigoCrudo)
  if (!codigo) throw new Error('Código de sala inválido')
  const conexion = await conectar(codigo)
  return new ClienteConexion(conexion, nombre, obtenerToken(codigo, almacen), eventos)
}
