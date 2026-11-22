/**
 * Abstracción mínima de transporte. La lógica de host y cliente solo conoce
 * estas interfaces; PeerJS vive en `peerTransporte.ts`. Esto permite probar
 * todo con un transporte falso en memoria.
 */
export interface Conexion {
  enviar(mensaje: unknown): void
  alRecibir(cb: (mensaje: unknown) => void): void
  /** Puede invocarse más de una vez; los receptores deben ser idempotentes. */
  alCerrar(cb: () => void): void
  cerrar(): void
}

export interface ServidorTransporte {
  alConectar(cb: (conexion: Conexion) => void): void
  /** Avisa si se pierde (false) o recupera (true) la conexión con el servidor de salas. */
  alEstadoSenalizacion?(cb: (ok: boolean) => void): void
  cerrar(): void
}

/** El ID de sala ya está en uso en el servidor de señalización. */
export class ErrorIdOcupado extends Error {
  constructor() {
    super('El código de sala ya está en uso')
  }
}

export interface Log {
  info(...args: unknown[]): void
  warn(...args: unknown[]): void
}

export const crearLog = (prefijo: string): Log => ({
  info: (...a) => console.log(`[${prefijo}]`, ...a),
  warn: (...a) => console.warn(`[${prefijo}]`, ...a),
})

export const logSilencioso: Log = { info: () => {}, warn: () => {} }
