/** Adaptador de PeerJS (WebRTC) a las interfaces de `transporte.ts`. */
import Peer, { type DataConnection } from 'peerjs'
import { idPeer } from './codigoSala'
import { ErrorIdOcupado, type Conexion, type ServidorTransporte } from './transporte'

/** Negociar WebRTC por redes móviles/Wi-Fi con NAT puede tardar bastante más de 10 s. */
const TIMEOUT_CONEXION_MS = 30_000

/**
 * Servidores ICE. STUN descubre la dirección pública; TURN retransmite el tráfico
 * cuando la conexión directa es imposible (Wi-Fi con aislamiento de clientes, NAT
 * estricto, mDNS...). No hay TURN público fiable: los que traía PeerJS por defecto
 * (turn.peerjs.com) ya no existen. Para tener respaldo, define uno propio en
 * .env.local (varias URLs separadas por comas; ver README):
 *   VITE_TURN_URL=turn:host:80,turns:host:443?transport=tcp
 *   VITE_TURN_USER=...  VITE_TURN_CREDENTIAL=...
 */
function servidoresIce(): RTCIceServer[] {
  const servidores: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
  ]
  const url = import.meta.env.VITE_TURN_URL as string | undefined
  if (url) {
    servidores.push({
      urls: url.split(','),
      username: import.meta.env.VITE_TURN_USER as string | undefined,
      credential: import.meta.env.VITE_TURN_CREDENTIAL as string | undefined,
    })
  }
  return servidores
}

const opcionesPeer = { config: { iceServers: servidoresIce() } }

/** Recoge qué tipos de candidatos ICE se obtuvieron, para explicar un fallo de conexión. */
function vigilarIce(pc: RTCPeerConnection | undefined) {
  const cuenta: Record<string, number> = { host: 0, srflx: 0, relay: 0 }
  const errores = new Set<string>()
  let estado = 'nuevo'
  pc?.addEventListener('icecandidate', (e) => {
    const tipo = e.candidate?.candidate.match(/ typ (\w+)/)?.[1]
    if (tipo) cuenta[tipo] = (cuenta[tipo] ?? 0) + 1
  })
  pc?.addEventListener('icecandidateerror', (e) => {
    const ev = e as RTCPeerConnectionIceErrorEvent
    errores.add(`${ev.errorCode} ${ev.url}`)
  })
  pc?.addEventListener('iceconnectionstatechange', () => {
    estado = pc.iceConnectionState
  })
  return () =>
    `candidatos locales ${cuenta.host}, STUN ${cuenta.srflx}, relé TURN ${cuenta.relay}; estado ICE: ${estado}` +
    (errores.size ? `; errores: ${[...errores].slice(0, 3).join(', ')}` : '')
}

/** Mensajes en español para los errores de PeerJS. */
export function mensajeErrorPeer(tipo: string, detalle: string): string {
  switch (tipo) {
    case 'peer-unavailable':
      return 'Sala no encontrada'
    case 'network':
    case 'socket-error':
    case 'socket-closed':
      return 'Sin conexión con el servidor de salas. Revisa tu internet e inténtalo de nuevo'
    case 'server-error':
      return 'El servidor de salas no responde. Inténtalo de nuevo en unos minutos'
    case 'browser-incompatible':
      return 'Tu navegador no es compatible con WebRTC'
    default:
      return detalle || 'Error de conexión'
  }
}

function envolver(dc: DataConnection, alCerrarTodo?: () => void): Conexion {
  return {
    enviar: (m) => dc.send(m),
    alRecibir: (cb) => dc.on('data', cb),
    alCerrar: (cb) => {
      dc.on('close', cb)
      dc.on('error', cb)
    },
    cerrar: () => {
      dc.close()
      alCerrarTodo?.()
    },
  }
}

/** Anfitrión: registra el ID de sala en el servidor de señalización. */
export function abrirServidorPeer(codigo: string): Promise<ServidorTransporte> {
  return new Promise((resolve, reject) => {
    const peer = new Peer(idPeer(codigo), opcionesPeer)
    let manejador: ((c: Conexion) => void) | null = null
    let alSenalizacion: ((ok: boolean) => void) | null = null
    const pendientes: Conexion[] = []

    peer.on('connection', (dc) => {
      // No se puede enviar hasta que el canal esté abierto.
      dc.on('open', () => {
        const c = envolver(dc)
        if (manejador) manejador(c)
        else pendientes.push(c)
      })
    })
    // Si se pierde la señalización, se reintenta; las conexiones P2P ya abiertas siguen vivas.
    peer.on('disconnected', () => {
      alSenalizacion?.(false)
      peer.reconnect()
    })
    peer.on('error', (err) => {
      if (err.type === 'unavailable-id') reject(new ErrorIdOcupado())
      else {
        console.warn('[peer] error', err.type, err.message)
        reject(new Error(mensajeErrorPeer(err.type, err.message)))
      }
    })
    // 'open' se emite también tras cada reconexión con el servidor de salas.
    peer.on('open', () => {
      alSenalizacion?.(true)
      resolve({
        alConectar(cb) {
          manejador = cb
          pendientes.splice(0).forEach(cb)
        },
        alEstadoSenalizacion: (cb) => {
          alSenalizacion = cb
        },
        cerrar: () => peer.destroy(),
      })
    })
  })
}

/** Cliente: se conecta al anfitrión usando el código de sala. */
export function conectarPeer(codigo: string): Promise<Conexion> {
  return new Promise((resolve, reject) => {
    const peer = new Peer(opcionesPeer)
    let resumenIce = () => ''
    const fallar = (e: Error) => {
      clearTimeout(timer)
      peer.destroy()
      reject(e)
    }
    const timer = setTimeout(() => {
      const detalle = resumenIce()
      console.warn('[peer] tiempo agotado:', detalle)
      fallar(
        new Error(
          `No se pudo establecer la conexión con el anfitrión (${detalle}). ` +
            'Si estás en la misma Wi-Fi, el router puede bloquear la comunicación entre dispositivos ' +
            '("aislamiento de clientes"); prueba con otra red o con datos móviles.',
        ),
      )
    }, TIMEOUT_CONEXION_MS)

    peer.on('error', (err) =>
      fallar(new Error(mensajeErrorPeer(err.type, err.message))),
    )
    peer.on('open', () => {
      const dc = peer.connect(idPeer(codigo), { serialization: 'json', reliable: true })
      resumenIce = vigilarIce(dc.peerConnection)
      dc.on('error', (e) => fallar(e))
      dc.on('open', () => {
        clearTimeout(timer)
        resolve(envolver(dc, () => peer.destroy()))
      })
    })
  })
}
