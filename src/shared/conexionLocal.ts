/**
 * Par de conexiones en memoria (sin red). Sirve para que el navegador del
 * anfitrión se una a su propia sala como un jugador más: el anfitrión trata
 * esa conexión igual que una de WebRTC (identidad por conexión, validación y
 * proyección), de modo que el jugador local solo ve lo que le corresponde.
 *
 * Cada mensaje se copia vía JSON, como haría la red real, para que ambos
 * extremos nunca compartan objetos (el cliente no puede mutar el estado del
 * anfitrión). La entrega es asíncrona (microtarea) y conserva el orden.
 */
import type { Conexion } from './transporte'

class Extremo implements Conexion {
  par!: Extremo
  cerrado = false
  private receptores: ((m: unknown) => void)[] = []
  private cierres: (() => void)[] = []

  enviar(mensaje: unknown) {
    if (this.cerrado) throw new Error('conexión cerrada')
    const copia = JSON.parse(JSON.stringify(mensaje))
    const destino = this.par
    queueMicrotask(() => destino.receptores.forEach((cb) => cb(copia)))
  }

  alRecibir(cb: (mensaje: unknown) => void) {
    this.receptores.push(cb)
  }

  alCerrar(cb: () => void) {
    this.cierres.push(cb)
  }

  cerrar() {
    if (this.cerrado) return
    this.cerrado = true
    this.par.cerrado = true
    // Va en cola tras los mensajes ya enviados, que se entregan antes del cierre.
    queueMicrotask(() => {
      this.cierres.forEach((cb) => cb())
      this.par.cierres.forEach((cb) => cb())
    })
  }
}

/** Devuelve [extremoCliente, extremoServidor]. */
export function crearParLocal(): [Conexion, Conexion] {
  const cliente = new Extremo()
  const servidor = new Extremo()
  cliente.par = servidor
  servidor.par = cliente
  return [cliente, servidor]
}
