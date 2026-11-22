/** Adaptador de PeerJS (WebRTC) a las interfaces de `transporte.ts`. */
import Peer, { type DataConnection } from 'peerjs'
import { idPeer } from './codigoSala'
import { ErrorIdOcupado, type Conexion, type ServidorTransporte } from './transporte'

const TIMEOUT_CONEXION_MS = 10_000

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
    const peer = new Peer(idPeer(codigo))
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
    const peer = new Peer()
    const fallar = (e: Error) => {
      clearTimeout(timer)
      peer.destroy()
      reject(e)
    }
    const timer = setTimeout(() => fallar(new Error('Tiempo de conexión agotado')), TIMEOUT_CONEXION_MS)

    peer.on('error', (err) =>
      fallar(new Error(mensajeErrorPeer(err.type, err.message))),
    )
    peer.on('open', () => {
      const dc = peer.connect(idPeer(codigo), { serialization: 'json', reliable: true })
      dc.on('error', (e) => fallar(e))
      dc.on('open', () => {
        clearTimeout(timer)
        resolve(envolver(dc, () => peer.destroy()))
      })
    })
  })
}
