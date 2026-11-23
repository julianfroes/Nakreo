/**
 * Anfitrión autoritativo. Mantiene el estado completo del juego y es el único
 * que llama al motor. Los clientes solo envían intenciones y reciben
 * proyecciones (`proyectarEstado`); nunca el estado completo.
 */
import { aplicar } from '../game/engine'
import { MIN_JUGADORES, maxJugadores } from '../game/config'
import { proyectarEstado, proyectarPublico, type EstadoPublico } from '../game/proyeccion'
import { barajar, type Rng } from '../game/rng'
import { crearPartida } from '../game/setup'
import type { EstadoJuego, EventoJuego, Intencion } from '../game/types'
import { generarCodigoSala } from '../shared/codigoSala'
import { crearParLocal } from '../shared/conexionLocal'
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
  /** «Estoy listo» en el lobby: solo informativo. */
  listo: boolean
  /** Asiento del propio anfitrión (se unió por la conexión local en memoria). */
  local: boolean
  /** Abandonó la partida en curso: no puede volver a entrar en ella (su token se rechaza). */
  retirado: boolean
}

/** Foto pública de la sala, para la UI del anfitrión. No contiene tokens ni información oculta. */
export interface SnapshotHost {
  codigo: string
  jugadores: JugadorSala[]
  iniciada: boolean
  /** Vista pública de la mesa; null mientras se está en el lobby. */
  mesa: EstadoPublico | null
  /** Hay entre MIN y el aforo y todos conectados. */
  puedeIniciar: boolean
  /** Por qué no se puede iniciar (null si se puede, o si la partida ya empezó). */
  motivoBloqueo: string | null
  /** Modo de juego: false = sin roles especiales. */
  especiales: boolean
  /** Aforo de la sala en este modo. */
  max: number
  /** Id del asiento del propio anfitrión si también juega; null si solo hace de mesa. */
  asientoLocal: string | null
  /** false = se perdió la conexión con el servidor de salas (nadie nuevo puede unirse). */
  senalizacionOk: boolean
}

export interface OpcionesHost {
  log?: Log
  rng?: Rng
  generarCodigo?: () => string
  /** false = sala sin roles especiales (máx. 6 jugadores). Por defecto true. */
  especiales?: boolean
  /**
   * Tiempo que se espera antes de cerrar una conexión remota tras enviarle su
   * último mensaje (rechazo, salida, cierre de sala), para que llegue. Por defecto 300 ms.
   */
  retardoCierreMs?: number
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
  private especiales: boolean
  private retardoCierreMs: number
  private cerrada = false
  /** Extremos del servidor de las conexiones locales (las del propio anfitrión). */
  private locales = new WeakSet<Conexion>()

  constructor(codigo: string, servidor: ServidorTransporte, opciones: OpcionesHost = {}) {
    this.codigo = codigo
    this.servidor = servidor
    this.log = opciones.log ?? crearLog('host')
    this.rng = opciones.rng ?? Math.random
    this.especiales = opciones.especiales ?? true
    this.retardoCierreMs = opciones.retardoCierreMs ?? 300
    this.log.info(`Sala abierta: ${codigo} (${this.especiales ? 'con' : 'sin'} roles especiales)`)
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

  /** Aforo de la sala en el modo actual. */
  get max(): number {
    return maxJugadores(this.especiales)
  }

  /**
   * Cambia el modo de juego. Solo en el lobby, y nunca a uno cuyo aforo sea
   * menor que los jugadores ya sentados. Todos deben volver a marcar «listo».
   */
  cambiarModo(especiales: boolean) {
    if (this.estado) throw new Error('No se puede cambiar el modo con la partida en curso')
    if (especiales === this.especiales) return
    const max = maxJugadores(especiales)
    if (this.asientos.length > max) {
      throw new Error(
        `Hay ${this.asientos.length} jugadores y el modo sin roles especiales admite ${max} como máximo`,
      )
    }
    this.especiales = especiales
    for (const a of this.asientos) a.listo = false
    this.log.info(`Modo cambiado: ${especiales ? 'con' : 'sin'} roles especiales`)
    this.difundirSala()
    this.notificar()
  }

  /**
   * Conexión en memoria para que el propio anfitrión juegue en su sala. Se trata
   * como cualquier otra conexión (el jugador local solo recibe su proyección).
   * Devuelve el extremo del cliente.
   */
  conectarLocal(): Conexion {
    const [extremoCliente, extremoServidor] = crearParLocal()
    this.locales.add(extremoServidor)
    this.alNuevaConexion(extremoServidor)
    return extremoCliente
  }

  /**
   * El anfitrión deja su asiento de jugador y vuelve a ser solo la mesa. Solo en
   * la sala de espera: con la partida en curso no se puede abandonar la mesa.
   */
  dejarAsientoLocal() {
    if (this.estado) throw new Error('No puedes dejar tu asiento con la partida en curso')
    const asiento = this.asientos.find((a) => a.local)
    if (!asiento) throw new Error('No ocupas ningún asiento')
    this.quitarAsiento(asiento)
  }

  /** Libera un asiento de la sala de espera: cierra su conexión y avisa a todos. */
  private quitarAsiento(asiento: Asiento) {
    const c = asiento.conexion
    this.asientos = this.asientos.filter((a) => a !== asiento)
    if (c) {
      this.porConexion.delete(c) // el cierre de esta conexión ya no cuenta como una caída
      c.cerrar()
    }
    this.log.info(`Asiento liberado: ${asiento.nombre} (${asiento.id})`)
    this.difundirSala()
    this.notificar()
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
      puedeIniciar: !this.estado && this.motivoBloqueo() === null,
      motivoBloqueo: this.estado ? null : this.motivoBloqueo(),
      especiales: this.especiales,
      max: this.max,
      asientoLocal: this.asientos.find((a) => a.local)?.id ?? null,
    }
  }

  /** Qué impide iniciar ahora mismo (null = nada). */
  private motivoBloqueo(): string | null {
    if (this.asientos.length < MIN_JUGADORES) {
      const faltan = MIN_JUGADORES - this.asientos.length
      return `Faltan ${faltan} jugador${faltan === 1 ? '' : 'es'} (mínimo ${MIN_JUGADORES}).`
    }
    const caidos = this.asientos.filter((a) => a.conexion === null)
    if (caidos.length > 0) {
      return `Hay jugadores desconectados: ${caidos.map((a) => a.nombre).join(', ')}.`
    }
    return null
  }

  private notificar() {
    if (this.oyentes.size === 0) return
    const s = this.snapshot()
    this.oyentes.forEach((cb) => cb(s))
  }

  /** Lista pública de la sala (sin tokens). */
  jugadoresSala(): JugadorSala[] {
    return this.asientos.map((a) => ({
      id: a.id,
      nombre: a.nombre,
      conectado: a.conexion !== null,
      listo: a.conexion !== null && a.listo,
    }))
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
      { especiales: this.especiales },
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
    for (const a of this.asientos) a.listo = false
    this.log.info('Vuelta al lobby')
    this.difundirSala()
    this.notificar()
  }

  private exigirFin() {
    if (this.estado?.fase.tipo !== 'fin') throw new Error('La partida no ha terminado')
    const conectados = this.asientos.filter((a) => a.conexion && !a.retirado).length
    if (conectados < MIN_JUGADORES) {
      throw new Error(`Se necesitan al menos ${MIN_JUGADORES} jugadores conectados`)
    }
  }

  /** Quita a los desconectados y a los retirados de la partida que acaba (empieza otra o se vuelve al lobby). */
  private quitarDesconectados() {
    this.asientos = this.asientos.filter((a) => a.conexion !== null && !a.retirado)
  }

  /**
   * Cierra la sala. Antes avisa a cada jugador conectado (`salaCerrada`) para que
   * vea el motivo al instante en lugar de intentar reconectar; el cierre de las
   * conexiones remotas espera un instante para que ese aviso llegue.
   */
  cerrar() {
    if (this.cerrada) return
    this.cerrada = true
    const conexiones = this.asientos.flatMap((a) => (a.conexion ? [a.conexion] : []))
    for (const c of conexiones) this.enviar(c, { tipo: 'salaCerrada' })
    const cerrarTodo = () => {
      for (const c of conexiones) c.cerrar()
      this.servidor.cerrar()
      this.log.info('Sala cerrada')
    }
    if (this.retardoCierreMs > 0 && conexiones.some((c) => !this.locales.has(c))) {
      setTimeout(cerrarTodo, this.retardoCierreMs)
    } else {
      cerrarTodo()
    }
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
    else if (msg.tipo === 'listo') this.marcarListo(c, msg)
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
    if (existente?.retirado) {
      return this.rechazar(c, 'retirado', 'Abandonaste esta partida: no puedes volver a entrar en ella.')
    }
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
    if (this.asientos.length >= this.max) {
      return this.rechazar(c, 'salaLlena', `Sala llena (${this.max}/${this.max})`)
    }

    // El anfitrión (conexión local) no puede ocupar dos asientos.
    const esLocal = this.locales.has(c)
    if (esLocal && this.asientos.some((a) => a.local)) {
      return this.rechazar(c, 'yaTienesAsiento', 'El anfitrión ya ocupa un asiento')
    }

    const asiento: Asiento = {
      id: `j${this.siguienteAsiento++}`,
      nombre: msg.nombre,
      token: msg.token,
      conexion: c,
      listo: false,
      local: esLocal,
      retirado: false,
    }
    this.asientos.push(asiento)
    this.porConexion.set(c, asiento)
    this.log.info(`Jugador unido: ${asiento.nombre} (${asiento.id})`)
    this.enviar(c, { tipo: 'bienvenida', idJugador: asiento.id })
    this.difundirSala()
    this.notificar()
  }

  /**
   * Un jugador abandona. En la sala de espera, o con la partida terminada, se libera
   * su asiento. Con la partida en curso el motor lo retira (sus cartas pasan al
   * descarte público, su turno y lo pendiente se resuelven) y no podrá volver a entrar
   * en esta partida. El anfitrión no puede retirarse: cierra la sala.
   */
  private salirDeSala(c: Conexion, asiento: Asiento) {
    const estado = this.estado
    if (!estado || estado.fase.tipo === 'fin') return this.quitarAsiento(asiento)
    if (asiento.local) {
      return this.enviarError(c, 'mensajeInvalido', 'El anfitrión no puede retirarse: debe cerrar la sala')
    }
    // Un espectador ya eliminado solo libera su asiento.
    if (estado.jugadores.find((j) => j.id === asiento.id)?.eliminado) return this.quitarAsiento(asiento)

    const r = aplicar(estado, { tipo: 'salir', jugador: asiento.id }, this.rng)
    if (!r.ok) return this.enviarError(c, r.error.codigo, r.error.mensaje)
    asiento.retirado = true
    this.estado = r.estado
    this.log.info(`Jugador retirado: ${asiento.nombre} (${asiento.id})`)
    this.difundirEstado(r.eventos) // también a él: su última proyección dice que está retirado
    this.notificar()
    this.cerrarTrasEntregar(c)
  }

  /** «Estoy listo»: guía visual del lobby. La identidad sale de la conexión. */
  private marcarListo(c: Conexion, msg: Extract<MensajeCliente, { tipo: 'listo' }>) {
    const asiento = this.porConexion.get(c)
    if (!asiento) return this.enviarError(c, 'noUnido', 'Debes unirte primero')
    if (this.estado) return this.enviarError(c, 'faseIncorrecta', 'La partida ya comenzó')
    if (asiento.listo === msg.listo) return
    asiento.listo = msg.listo
    this.difundirSala()
    this.notificar()
  }

  private recibirIntencion(c: Conexion, msg: Extract<MensajeCliente, { tipo: 'intencion' }>) {
    const asiento = this.porConexion.get(c)
    if (!asiento) return this.enviarError(c, 'noUnido', 'Debes unirte primero')
    if (msg.intencion.tipo === 'salir') return this.salirDeSala(c, asiento)
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
    const msg: MensajeHost = {
      tipo: 'sala',
      jugadores: this.jugadoresSala(),
      iniciada: this.iniciada,
      especiales: this.especiales,
      max: this.max,
    }
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

  /** Cierra la conexión tras dar tiempo a que llegue el último mensaje enviado. */
  private cerrarTrasEntregar(c: Conexion) {
    if (this.retardoCierreMs > 0 && !this.locales.has(c)) setTimeout(() => c.cerrar(), this.retardoCierreMs)
    else c.cerrar()
  }

  /** Rechaza a una conexión sin asiento y la cierra tras dar tiempo a entregar el error. */
  private rechazar(c: Conexion, codigo: CodigoErrorRed, mensaje: string) {
    this.enviarError(c, codigo, mensaje)
    this.cerrarTrasEntregar(c)
  }
}
