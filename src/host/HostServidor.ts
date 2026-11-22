/**
 * Anfitrión autoritativo. Mantiene el estado completo del juego y es el único
 * que llama al motor. Los clientes solo envían intenciones y reciben
 * proyecciones (`proyectarEstado`); nunca el estado completo.
 */
import { aplicar } from '../game/engine'
import { MAX_JUGADORES, MIN_JUGADORES } from '../game/config'
import { proyectarEstado, proyectarPublico, type EstadoPublico } from '../game/proyeccion'
import { barajar, type Rng } from '../game/rng'
import { crearPartida } from '../game/setup'
import type { EstadoJuego, EventoJuego, Intencion } from '../game/types'
import { generarCodigoSala } from '../shared/codigoSala'
import {
  parsearMensajeCliente,
  type CodigoErrorRed,
  type JugadorSala,
  type MensajeCliente,
  type MensajeHost,
} from '../shared/protocolo'
import {
  crearLog,
  ErrorIdOcupado,
  type Conexion,
  type Log,
  type ServidorTransporte,
} from '../shared/transporte'

interface Asiento {
  id: string
  nombre: string
  /** Secreto del cliente para recuperar su asiento. NUNCA se envía a nadie. */
  token: string
  conexion: Conexion | null
}

/** Foto pública de la sala, para la UI del anfitrión. No contiene tokens ni información oculta. */
export interface SnapshotHost {
  codigo: string
  jugadores: JugadorSala[]
  iniciada: boolean
  /** Vista pública de la mesa; null mientras se está en el lobby. */
  mesa: EstadoPublico | null
  /** Hay entre MIN y MAX jugadores y todos conectados. */
  puedeIniciar: boolean
  /** false = se perdió la conexión con el servidor de salas (nadie nuevo puede unirse). */
  senalizacionOk: boolean
}

export interface OpcionesHost {
  log?: Log
  rng?: Rng
  generarCodigo?: () => string
}

const INTENTOS_CODIGO = 5

/** Abre una sala con un código libre (reintenta si el ID está ocupado). */
export async function crearHost(
  abrir: (codigo: string) => Promise<ServidorTransporte>,
  opciones: OpcionesHost = {},
): Promise<HostServidor> {
  const generar = opciones.generarCodigo ?? generarCodigoSala
  for (let i = 0; i < INTENTOS_CODIGO; i++) {
    const codigo = generar()
    try {
      return new HostServidor(codigo, await abrir(codigo), opciones)
    } catch (e) {
      if (!(e instanceof ErrorIdOcupado)) throw e
    }
  }
  throw new Error('No se pudo reservar un código de sala')
}

export class HostServidor {
  readonly codigo: string
  private servidor: ServidorTransporte
  private log: Log
  private rng: Rng
  private asientos: Asiento[] = []
  private porConexion = new Map<Conexion, Asiento>()
  private estado: EstadoJuego | null = null
  private oyentes = new Set<(s: SnapshotHost) => void>()
  private senalizacionOk = true
  private siguienteAsiento = 1

  constructor(codigo: string, servidor: ServidorTransporte, opciones: OpcionesHost = {}) {
    this.codigo = codigo
    this.servidor = servidor
    this.log = opciones.log ?? crearLog('host')
    this.rng = opciones.rng ?? Math.random
    this.log.info(`Sala abierta: ${codigo}`)
    servidor.alConectar((c) => this.alNuevaConexion(c))
    servidor.alEstadoSenalizacion?.((ok) => {
      this.senalizacionOk = ok
      this.log.info(ok ? 'Servidor de salas conectado' : 'Servidor de salas desconectado')
      this.notificar()
    })
  }

  // ------------------------------------------------------------------ API

  get iniciada(): boolean {
    return this.estado !== null
  }

  /** Suscribe a cambios (sala o partida). Devuelve la función para cancelar. */
  alCambiar(cb: (s: SnapshotHost) => void): () => void {
    this.oyentes.add(cb)
    return () => this.oyentes.delete(cb)
  }

  snapshot(): SnapshotHost {
    return {
      codigo: this.codigo,
      jugadores: this.jugadoresSala(),
      iniciada: this.iniciada,
      mesa: this.estado ? proyectarPublico(this.estado) : null,
      senalizacionOk: this.senalizacionOk,
      puedeIniciar:
        !this.estado &&
        this.asientos.length >= MIN_JUGADORES &&
        this.asientos.every((a) => a.conexion !== null),
    }
  }

  private notificar() {
    if (this.oyentes.size === 0) return
    const s = this.snapshot()
    this.oyentes.forEach((cb) => cb(s))
  }

  /** Lista pública de la sala (sin tokens). */
  jugadoresSala(): JugadorSala[] {
    return this.asientos.map((a) => ({ id: a.id, nombre: a.nombre, conectado: a.conexion !== null }))
  }

  iniciarPartida() {
    if (this.estado) throw new Error('La partida ya comenzó')
    if (this.asientos.length < MIN_JUGADORES) {
      throw new Error(`Se necesitan al menos ${MIN_JUGADORES} jugadores`)
    }
    if (this.asientos.some((a) => !a.conexion)) {
      throw new Error('Hay jugadores desconectados')
    }
    this.estado = crearPartida(
      this.asientos.map((a) => ({ id: a.id, nombre: a.nombre })),
      this.rng,
    )
    this.log.info('Partida iniciada con', this.asientos.length, 'jugadores')
    this.difundirSala()
    this.difundirEstado([...this.estado.registro])
    this.notificar()
  }

  /** Nueva partida con los mismos jugadores (los desconectados se descartan). Solo tras el fin. */
  reiniciarPartida() {
    this.exigirFin()
    this.quitarDesconectados()
    this.asientos = barajar(this.asientos, this.rng) // cambia quién empieza
    this.estado = null
    this.iniciarPartida()
  }

  /** Vuelve al lobby para que entren jugadores nuevos antes de iniciar. Solo tras el fin. */
  volverAlLobby() {
    this.exigirFin()
    this.quitarDesconectados()
    this.estado = null
    this.log.info('Vuelta al lobby')
    this.difundirSala()
    this.notificar()
  }

  private exigirFin() {
    if (this.estado?.fase.tipo !== 'fin') throw new Error('La partida no ha terminado')
    const conectados = this.asientos.filter((a) => a.conexion).length
    if (conectados < MIN_JUGADORES) {
      throw new Error(`Se necesitan al menos ${MIN_JUGADORES} jugadores conectados`)
    }
  }

  private quitarDesconectados() {
    this.asientos = this.asientos.filter((a) => a.conexion !== null)
  }

  cerrar() {
    for (const a of this.asientos) a.conexion?.cerrar()
    this.servidor.cerrar()
    this.log.info('Sala cerrada')
  }

  // --------------------------------------------------------------- Conexiones

  private alNuevaConexion(c: Conexion) {
    this.log.info('Conexión entrante')
    c.alRecibir((raw) => this.alMensaje(c, raw))
    c.alCerrar(() => this.alCerrarConexion(c))
  }

  private alMensaje(c: Conexion, raw: unknown) {
    const msg = parsearMensajeCliente(raw)
    if (!msg) {
      this.log.warn('Mensaje inválido descartado')
      this.enviarError(c, 'mensajeInvalido', 'Mensaje inválido')
      return
    }
    if (msg.tipo === 'unirse') this.unirse(c, msg)
    else this.recibirIntencion(c, msg)
  }

  private alCerrarConexion(c: Conexion) {
    const asiento = this.porConexion.get(c)
    if (!asiento) return // conexión sin asiento, o ya reemplazada
    this.porConexion.delete(c)
    if (asiento.conexion === c) asiento.conexion = null
    this.log.info(`Jugador desconectado: ${asiento.nombre} (${asiento.id})`)
    this.difundirSala()
    this.notificar()
  }

  private unirse(c: Conexion, msg: Extract<MensajeCliente, { tipo: 'unirse' }>) {
    if (this.porConexion.has(c)) {
      this.enviarError(c, 'mensajeInvalido', 'Ya estás unido')
      return
    }

    // Reconexión: el token identifica el asiento (no el id que diga el cliente).
    const existente = this.asientos.find((a) => a.token === msg.token)
    if (existente) {
      const vieja = existente.conexion
      if (vieja) {
        this.porConexion.delete(vieja) // la desconexión de la vieja ya no cuenta
        existente.conexion = null
        vieja.cerrar()
      }
      existente.conexion = c
      this.porConexion.set(c, existente)
      this.log.info(`Jugador reconectado: ${existente.nombre} (${existente.id})`)
      this.enviar(c, { tipo: 'bienvenida', idJugador: existente.id })
      this.difundirSala()
      this.notificar()
      if (this.estado) {
        this.enviar(c, {
          tipo: 'estado',
          proyeccion: proyectarEstado(this.estado, existente.id),
          eventos: [],
        })
      }
      return
    }

    if (this.estado) return this.rechazar(c, 'partidaEnCurso', 'La partida ya comenzó')
    if (this.asientos.length >= MAX_JUGADORES) return this.rechazar(c, 'salaLlena', 'Sala llena')

    const asiento: Asiento = {
      id: `j${this.siguienteAsiento++}`,
      nombre: msg.nombre,
      token: msg.token,
      conexion: c,
    }
    this.asientos.push(asiento)
    this.porConexion.set(c, asiento)
    this.log.info(`Jugador unido: ${asiento.nombre} (${asiento.id})`)
    this.enviar(c, { tipo: 'bienvenida', idJugador: asiento.id })
    this.difundirSala()
    this.notificar()
  }

  private recibirIntencion(c: Conexion, msg: Extract<MensajeCliente, { tipo: 'intencion' }>) {
    const asiento = this.porConexion.get(c)
    if (!asiento) return this.enviarError(c, 'noUnido', 'Debes unirte primero')
    if (!this.estado) return this.enviarError(c, 'sinPartida', 'La partida no ha comenzado')

    // La identidad sale de la conexión, jamás del contenido del mensaje.
    const intencion = { ...msg.intencion, jugador: asiento.id } as Intencion
    this.log.info(`Intención de ${asiento.id}: ${intencion.tipo}`)

    const r = aplicar(this.estado, intencion, this.rng)
    if (!r.ok) {
      this.log.warn(`Intención rechazada (${r.error.codigo})`)
      return this.enviarError(c, r.error.codigo, r.error.mensaje)
    }
    this.estado = r.estado
    this.difundirEstado(r.eventos)
    this.notificar()
  }

  // ------------------------------------------------------------------ Envío

  private difundirSala() {
    const msg: MensajeHost = { tipo: 'sala', jugadores: this.jugadoresSala(), iniciada: this.iniciada }
    for (const a of this.asientos) if (a.conexion) this.enviar(a.conexion, msg)
  }

  /** A cada jugador SU proyección: única vía por la que sale estado de juego. */
  private difundirEstado(eventos: EventoJuego[]) {
    if (!this.estado) return
    for (const a of this.asientos) {
      if (!a.conexion) continue
      this.enviar(a.conexion, {
        tipo: 'estado',
        proyeccion: proyectarEstado(this.estado, a.id),
        eventos,
      })
    }
  }

  private enviar(c: Conexion, msg: MensajeHost) {
    try {
      c.enviar(msg)
    } catch (e) {
      this.log.warn('Fallo al enviar', msg.tipo, e)
    }
  }

  private enviarError(c: Conexion, codigo: CodigoErrorRed, mensaje: string) {
    this.enviar(c, { tipo: 'error', codigo, mensaje })
  }

  /** Rechaza a una conexión sin asiento y la cierra tras dar tiempo a entregar el error. */
  private rechazar(c: Conexion, codigo: CodigoErrorRed, mensaje: string) {
    this.enviarError(c, codigo, mensaje)
    setTimeout(() => c.cerrar(), 300)
  }
}
