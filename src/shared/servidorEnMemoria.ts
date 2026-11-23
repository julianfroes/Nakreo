import { crearParLocal } from './conexionLocal'
import type { Conexion, ServidorTransporte } from './transporte'

/**
 * Servidor de transporte en memoria, SOLO para pruebas. Cada `conectar()` simula
 * a un jugador remoto (como uno que llega por WebRTC): a diferencia de
 * `HostServidor.conectarLocal()`, esa conexión no es la del propio anfitrión.
 */
export class ServidorEnMemoria implements ServidorTransporte {
  private recibir: ((c: Conexion) => void) | null = null

  alConectar(cb: (conexion: Conexion) => void) {
    this.recibir = cb
  }

  cerrar() {}

  /** Conecta un jugador remoto y devuelve su extremo (el del cliente). */
  conectar(): Conexion {
    const [cliente, servidor] = crearParLocal()
    this.recibir?.(servidor)
    return cliente
  }
}
