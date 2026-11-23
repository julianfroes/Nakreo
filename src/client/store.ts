/**
 * Estado del cliente (Zustand): conexión, sala y última proyección recibida.
 * Incluye reconexión automática con el mismo token (los móviles pierden
 * WebRTC al bloquear la pantalla).
 */
import { create } from 'zustand'
import type { EstadoProyectado } from '../game/proyeccion'
import { normalizarCodigo } from '../shared/codigoSala'
import { conectarPeer } from '../shared/peerTransporte'
import type { IntencionCliente, SalaInfo } from '../shared/protocolo'
import type { HostServidor } from '../host/HostServidor'
import type { Conexion } from '../shared/transporte'
import { unirseASala, type ClienteConexion } from './ClienteConexion'

export type EstadoConexion = 'inicio' | 'conectando' | 'conectado' | 'reconectando'

interface ClienteState {
  conexion: EstadoConexion
  codigo: string | null
  nombre: string
  idJugador: string | null
  sala: SalaInfo | null
  proyeccion: EstadoProyectado | null
  /** Mensaje de error para mostrar al usuario (se limpia con `limpiarError`). */
  error: string | null
  /**
   * El anfitrión rechazó la unión a esta sala (llena o ya iniciada): el botón
   * «Unirme» queda bloqueado para ese código hasta que se pida reintentar.
   */
  rechazo: { codigo: string; motivo: string } | null
  /** Nº de intento de reconexión en curso (0 si no se está reconectando). */
  intento: number
  /** true entre enviar una intención y recibir la respuesta del host. */
  pendiente: boolean
  /** Pedí abandonar (sala o partida) y espero la confirmación del host. */
  saliendo: boolean
  /** El host confirmó que me retiré de la partida: ya no puedo volver a entrar en ella. */
  retirado: boolean
  unirse(codigo: string, nombre: string): Promise<void>
  /** Como `unirse`, pero con otro transporte (para pruebas con conexiones en memoria). */
  unirseConConector(codigo: string, nombre: string, conectar: (codigo: string) => Promise<Conexion>): Promise<void>
  /** El anfitrión se une a su propia sala por una conexión en memoria (sin reconexión ni sesión guardada). */
  unirseLocal(host: HostServidor, nombre: string): Promise<void>
  retomarSesion(codigoUrl: string | null): void
  enviar(intencion: IntencionCliente): void
  limpiarError(): void
  limpiarRechazo(): void
  /** «Estoy listo» en el lobby (guía visual). */
  marcarListo(listo: boolean): void
  /** Abandona la sala o la partida avisando al host (libera el asiento o retira al jugador). */
  abandonar(): void
  /** Cierra mi conexión y vuelve al inicio, sin avisar al host (o tras haberme retirado). */
  salir(): void
}

const CLAVE_SESION = 'nakreo-sesion'
const ERRORES_FATALES = ['salaLlena', 'partidaEnCurso', 'yaTienesAsiento', 'retirado']
/** Si el host no responde a «salir» en este tiempo, se sale igualmente. */
const ESPERA_SALIDA_MS = 3000
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
  rechazo: null,
  intento: 0,
  pendiente: false,
  saliendo: false,
  retirado: false,
}

let cliente: ClienteConexion | null = null
let cierreDeliberado = false
let temporizador: ReturnType<typeof setTimeout> | null = null
/** Cómo se abre la conexión: PeerJS normalmente, memoria para el anfitrión-jugador. */
let conector: (codigo: string) => Promise<Conexion> = conectarPeer
let local = false

export const useCliente = create<ClienteState>((set, get) => {
  /** Abre una conexión nueva. Lanza si no se puede alcanzar la sala. */
  async function abrir(codigo: string, nombre: string) {
    const nuevo = await unirseASala(codigo, nombre, conector, {
      alBienvenida: (id) => {
        set({ idJugador: id, conexion: 'conectado', intento: 0 })
        if (!local) sessionStorage.setItem(CLAVE_SESION, JSON.stringify({ codigo, nombre }))
      },
      // Si el anfitrión vuelve al lobby (iniciada = false), se descarta la partida terminada.
      alSala: (sala) => set(sala.iniciada ? { sala } : { sala, proyeccion: null }),
      alEstado: (proyeccion) => {
        const yo = proyeccion.jugadores.find((j) => j.id === proyeccion.yo.id)
        if (yo?.retirado) {
          // Me retiré: el host cierra mi conexión y no hay nada a lo que reconectar.
          cierreDeliberado = true
          if (temporizador) clearTimeout(temporizador)
          sessionStorage.removeItem(CLAVE_SESION)
          set({ proyeccion, pendiente: false, saliendo: false, retirado: true })
          return
        }
        set({ proyeccion, pendiente: false })
      },
      alSalaCerrada: () => {
        // El anfitrión cerró la sala a propósito: se sale al instante, sin reintentar.
        get().salir()
        set({ error: 'El anfitrión cerró la sala.' })
      },
      alError: (c, mensaje) => {
        if (get().saliendo) {
          // El host no aceptó mi salida: sigo en la sala.
          cierreDeliberado = false
          if (temporizador) clearTimeout(temporizador)
          set({ saliendo: false })
        }
        if (ERRORES_FATALES.includes(c)) {
          // El anfitrión no nos dejó entrar: se conserva el código y se bloquea «Unirme» para él.
          const rechazado = get().codigo
          get().salir()
          set({
            error: mensaje,
            pendiente: false,
            codigo: rechazado,
            rechazo: rechazado ? { codigo: rechazado, motivo: c } : null,
          })
          return
        }
        set({ error: mensaje, pendiente: false })
      },
      alCerrar: () => {
        // La conexión local solo se cierra al cerrar la sala: no hay a dónde reconectar.
        if (local || cliente !== nuevo) return
        if (!cierreDeliberado) return reconectar(codigo, nombre, 1, 0)
        // Salí a propósito: si me retiré de una partida se queda la pantalla de despedida;
        // si solo dejé la sala de espera, se vuelve al inicio.
        if (get().saliendo && !get().retirado) get().salir()
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

    unirse: (codigoCrudo, nombre) => get().unirseConConector(codigoCrudo, nombre, conectarPeer),

    async unirseConConector(codigoCrudo, nombre, conectar) {
      const codigo = normalizarCodigo(codigoCrudo)
      if (!codigo) return set({ error: 'Código de sala inválido' })
      cierreDeliberado = false
      local = false
      conector = conectar
      set({ ...inicial, conexion: 'conectando', codigo, nombre })
      try {
        await abrir(codigo, nombre)
      } catch (e) {
        // Se conserva el código para poder corregirlo o reintentar sin reescribirlo.
        set({ ...inicial, codigo, nombre, error: (e as Error).message })
      }
    },

    async unirseLocal(host, nombre) {
      cierreDeliberado = false
      local = true
      conector = async () => host.conectarLocal()
      set({ ...inicial, conexion: 'conectando', codigo: host.codigo, nombre })
      try {
        await abrir(host.codigo, nombre)
      } catch (e) {
        set({ ...inicial, codigo: host.codigo, nombre, error: (e as Error).message })
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

    limpiarRechazo: () => set({ error: null, rechazo: null }),

    abandonar() {
      if (!cliente) return get().salir()
      cierreDeliberado = true // la conexión se cerrará a propósito: no reconectar
      if (temporizador) clearTimeout(temporizador)
      set({ saliendo: true, error: null })
      try {
        cliente.enviar({ tipo: 'salir' })
      } catch {
        return get().salir() // sin conexión: no hay a quién avisar
      }
      // Si el host no confirma, se sale de todos modos.
      temporizador = setTimeout(() => get().salir(), ESPERA_SALIDA_MS)
    },

    marcarListo(listo) {
      cliente?.marcarListo(listo)
    },

    salir() {
      cierreDeliberado = true
      if (temporizador) clearTimeout(temporizador)
      cliente?.cerrar()
      cliente = null
      local = false
      sessionStorage.removeItem(CLAVE_SESION)
      set({ ...inicial })
    },
  }
})
