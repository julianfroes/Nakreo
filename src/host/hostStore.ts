/**
 * Puente entre `HostServidor` (sin React) y la UI del anfitrión.
 * La UI SOLO lee `snapshot`, que es público: nunca recibe el estado completo.
 */
import { create } from 'zustand'
import { useCliente } from '../client/store'
import { abrirServidorPeer } from '../shared/peerTransporte'
import { crearHost, type HostServidor, type SnapshotHost } from './HostServidor'

interface HostState {
  snapshot: SnapshotHost | null
  error: string | null
  /** `especiales: false` crea una sala sin roles especiales (máx. 6 jugadores). */
  crearSala(opciones?: { especiales?: boolean }): Promise<void>
  /** Cambia el modo en el lobby (el host lo valida y puede rechazarlo). */
  cambiarModo(especiales: boolean): void
  /** El anfitrión deja su asiento de jugador (solo en el lobby) y vuelve a ser solo la mesa. */
  dejarAsiento(): void
  iniciarPartida(): void
  reiniciarPartida(): void
  volverAlLobby(): void
  cerrarSala(): void
}

let host: HostServidor | null = null
let cancelarSuscripcion: (() => void) | null = null
/** Invalida creaciones en curso (StrictMode monta/desmonta dos veces en desarrollo). */
let generacion = 0

type VentanaDebug = { nakreo?: unknown }

/** Instancia actual del anfitrión (para unir al propio anfitrión como jugador local). */
export const obtenerHost = (): HostServidor | null => host

export const useHost = create<HostState>((set, get) => ({
  snapshot: null,
  error: null,

  async crearSala(opciones = {}) {
    const mia = ++generacion
    set({ snapshot: null, error: null })
    try {
      const nuevo = await crearHost(abrirServidorPeer, { especiales: opciones.especiales ?? true })
      if (mia !== generacion) return nuevo.cerrar() // se cerró mientras se creaba
      host = nuevo
      cancelarSuscripcion = nuevo.alCambiar((snapshot) => set({ snapshot }))
      set({ snapshot: nuevo.snapshot() })
      // Solo desarrollo: expone el host (con el estado completo) en la consola.
      if (import.meta.env.DEV) (window as unknown as VentanaDebug).nakreo = nuevo
    } catch (e) {
      if (mia === generacion) set({ error: (e as Error).message })
    }
  },

  cambiarModo(especiales) {
    try {
      set({ error: null })
      host?.cambiarModo(especiales)
    } catch (e) {
      set({ error: (e as Error).message })
    }
  },

  dejarAsiento() {
    try {
      set({ error: null })
      host?.dejarAsientoLocal()
      useCliente.getState().salir() // el cliente local ya no tiene sala
    } catch (e) {
      set({ error: (e as Error).message })
    }
  },

  iniciarPartida() {
    try {
      set({ error: null })
      host?.iniciarPartida()
    } catch (e) {
      set({ error: (e as Error).message })
    }
  },

  reiniciarPartida() {
    try {
      set({ error: null })
      host?.reiniciarPartida()
    } catch (e) {
      set({ error: (e as Error).message })
    }
  },

  volverAlLobby() {
    try {
      set({ error: null })
      host?.volverAlLobby()
    } catch (e) {
      set({ error: (e as Error).message })
    }
  },

  cerrarSala() {
    generacion++
    cancelarSuscripcion?.()
    host?.cerrar()
    host = null
    cancelarSuscripcion = null
    if (import.meta.env.DEV) delete (window as unknown as VentanaDebug).nakreo
    set({ snapshot: null, error: get().error })
  },
}))
