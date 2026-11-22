/**
 * Estado del cliente (Zustand): conexión, sala y última proyección recibida.
 * Incluye reconexión automática con el mismo token (los móviles pierden
 * WebRTC al bloquear la pantalla).
 */
import { create } from 'zustand'
import type { EstadoProyectado } from '../game/proyeccion'
import { normalizarCodigo } from '../shared/codigoSala'
import { conectarPeer } from '../shared/peerTransporte'
import type { IntencionCliente, JugadorSala } from '../shared/protocolo'
import { unirseASala, type ClienteConexion } from './ClienteConexion'

export type EstadoConexion = 'inicio' | 'conectando' | 'conectado' | 'reconectando'

interface ClienteState {
  conexion: EstadoConexion
  codigo: string | null
  nombre: string
  idJugador: string | null
  sala: { jugadores: JugadorSala[]; iniciada: boolean } | null
  proyeccion: EstadoProyectado | null
  /** Mensaje de error para mostrar al usuario (se limpia con `limpiarError`). */
  error: string | null
  /** Nº de intento de reconexión en curso (0 si no se está reconectando). */
  intento: number
  /** true entre enviar una intención y recibir la respuesta del host. */
  pendiente: boolean
  unirse(codigo: string, nombre: string): Promise<void>
  retomarSesion(codigoUrl: string | null): void
  enviar(intencion: IntencionCliente): void
  limpiarError(): void
  salir(): void
}

const CLAVE_SESION = 'nakreo-sesion'
const ERRORES_FATALES = ['salaLlena', 'partidaEnCurso']
const INTERVALO_REINTENTO_MS = 2000
const MAX_REINTENTOS = 60
/** Tras tantos "Sala no encontrada" seguidos al reconectar, se da por cerrada la sala. */
const MAX_SALA_NO_ENCONTRADA = 5
const SALA_NO_ENCONTRADA = 'Sala no encontrada'

const inicial = {
  conexion: 'inicio' as EstadoConexion,
  codigo: null,
  idJugador: null,
  sala: null,
  proyeccion: null,
  error: null,
  intento: 0,
  pendiente: false,
}

let cliente: ClienteConexion | null = null
let cierreDeliberado = false
let temporizador: ReturnType<typeof setTimeout> | null = null

export const useCliente = create<ClienteState>((set, get) => {
  /** Abre una conexión nueva. Lanza si no se puede alcanzar la sala. */
  async function abrir(codigo: string, nombre: string) {
    const nuevo = await unirseASala(codigo, nombre, conectarPeer, {
      alBienvenida: (id) => {
        set({ idJugador: id, conexion: 'conectado', intento: 0 })
        sessionStorage.setItem(CLAVE_SESION, JSON.stringify({ codigo, nombre }))
      },
      alSala: (jugadores, iniciada) => set({ sala: { jugadores, iniciada } }),
      alEstado: (proyeccion) => set({ proyeccion, pendiente: false }),
      alError: (c, mensaje) => {
        if (ERRORES_FATALES.includes(c)) get().salir()
        set({ error: mensaje, pendiente: false })
      },
      alCerrar: () => {
        if (cliente === nuevo && !cierreDeliberado) reconectar(codigo, nombre, 1, 0)
      },
    })
    cliente = nuevo
  }

  function reconectar(codigo: string, nombre: string, intento: number, noEncontradas: number) {
    if (cierreDeliberado) return
    if (noEncontradas >= MAX_SALA_NO_ENCONTRADA) {
      get().salir()
      set({ error: 'El anfitrión cerró la sala o se desconectó. La partida ya no está disponible.' })
      return
    }
    if (intento > MAX_REINTENTOS) {
      get().salir()
      set({ error: 'No se pudo reconectar con la sala. Revisa tu conexión.' })
      return
    }
    set({ conexion: 'reconectando', intento, pendiente: false })
    temporizador = setTimeout(async () => {
      try {
        cliente = null
        await abrir(codigo, nombre)
      } catch (e) {
        const noEncontrada = (e as Error).message === SALA_NO_ENCONTRADA
        reconectar(codigo, nombre, intento + 1, noEncontrada ? noEncontradas + 1 : 0)
      }
    }, INTERVALO_REINTENTO_MS)
  }

  return {
    ...inicial,
    nombre: '',

    async unirse(codigoCrudo, nombre) {
      const codigo = normalizarCodigo(codigoCrudo)
      if (!codigo) return set({ error: 'Código de sala inválido' })
      cierreDeliberado = false
      set({ ...inicial, conexion: 'conectando', codigo, nombre })
      try {
        await abrir(codigo, nombre)
      } catch (e) {
        // Se conserva el código para poder corregirlo o reintentar sin reescribirlo.
        set({ ...inicial, codigo, nombre, error: (e as Error).message })
      }
    },

    retomarSesion(codigoUrl) {
      if (get().conexion !== 'inicio') return
      try {
        const guardada = JSON.parse(sessionStorage.getItem(CLAVE_SESION) ?? 'null')
        if (guardada?.codigo && guardada?.nombre && (!codigoUrl || guardada.codigo === codigoUrl)) {
          void get().unirse(guardada.codigo, guardada.nombre)
        }
      } catch {
        sessionStorage.removeItem(CLAVE_SESION)
      }
    },

    enviar(intencion) {
      if (!cliente || get().pendiente) return
      set({ pendiente: true, error: null })
      cliente.enviar(intencion)
    },

    limpiarError: () => set({ error: null }),

    salir() {
      cierreDeliberado = true
      if (temporizador) clearTimeout(temporizador)
      cliente?.cerrar()
      cliente = null
      sessionStorage.removeItem(CLAVE_SESION)
      set({ ...inicial })
    },
  }
})
