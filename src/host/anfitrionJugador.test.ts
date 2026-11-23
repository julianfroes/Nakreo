import { describe, expect, it } from 'vitest'
import { ClienteConexion } from '../client/ClienteConexion'
import type { EstadoProyectado } from '../game/proyeccion'
import { crearRng } from '../game/rng'
import type { EstadoJuego } from '../game/types'
import { crearParLocal } from '../shared/conexionLocal'
import { ServidorEnMemoria } from '../shared/servidorEnMemoria'
import { logSilencioso } from '../shared/transporte'
import { HostServidor } from './HostServidor'

/** Deja correr las microtareas pendientes (la conexión local entrega de forma asíncrona). */
const flush = () => new Promise((r) => setTimeout(r, 0))

/** La «red» de cada host de prueba: por ahí llegan los jugadores remotos (no son el anfitrión). */
const redes = new WeakMap<HostServidor, ServidorEnMemoria>()

function nuevoHost(extra: { especiales?: boolean } = {}) {
  const red = new ServidorEnMemoria()
  const host = new HostServidor('ABCDE', red, { log: logSilencioso, rng: crearRng(5), ...extra })
  redes.set(host, red)
  return host
}

/** Un jugador con su última proyección y eventos. `local` = el propio anfitrión (conexión local). */
function jugador(host: HostServidor, nombre: string, token: string, local: boolean) {
  const recibido = {
    estados: [] as EstadoProyectado[],
    salas: [] as boolean[],
    jugadoresSala: [] as string[][],
    errores: [] as string[],
    cerrada: false,
  }
  const cliente = new ClienteConexion(
    local ? host.conectarLocal() : redes.get(host)!.conectar(),
    nombre,
    token,
    {
      alEstado: (p) => recibido.estados.push(p),
      alSala: (sala) => {
        recibido.salas.push(sala.iniciada)
        recibido.jugadoresSala.push(sala.jugadores.map((j) => j.nombre))
      },
      alError: (codigo) => recibido.errores.push(codigo),
      alCerrar: () => (recibido.cerrada = true),
    },
    logSilencioso,
  )
  return { cliente, recibido }
}

/** El anfitrión jugando en su propia sala. */
const jugadorLocal = (host: HostServidor, nombre: string, token: string) => jugador(host, nombre, token, true)
/** Otro jugador que llega por la red. */
const jugadorRemoto = (host: HostServidor, nombre: string, token: string) => jugador(host, nombre, token, false)

describe('conexión local', () => {
  it('entrega en orden y con copia: nadie comparte objetos con el otro extremo', async () => {
    const [a, b] = crearParLocal()
    const recibidos: { n: number }[] = []
    b.alRecibir((m) => recibidos.push(m as { n: number }))
    const original = { n: 1 }
    a.enviar(original)
    a.enviar({ n: 2 })
    original.n = 99 // mutar después de enviar no afecta a lo entregado
    await flush()
    expect(recibidos.map((m) => m.n)).toEqual([1, 2])
    recibidos[0].n = 7 // ni lo recibido altera al emisor
    expect(original.n).toBe(99)
  })

  it('al cerrar, avisa a ambos extremos después de los mensajes ya enviados', async () => {
    const [a, b] = crearParLocal()
    const log: string[] = []
    b.alRecibir((m) => log.push(`msg:${m}`))
    a.alCerrar(() => log.push('cierre-a'))
    b.alCerrar(() => log.push('cierre-b'))
    a.enviar('hola')
    a.cerrar()
    await flush()
    expect(log).toEqual(['msg:hola', 'cierre-a', 'cierre-b'])
    expect(() => a.enviar('tarde')).toThrow()
  })
})

describe('anfitrión que también juega', () => {
  it('se une a su propia sala como un jugador más', async () => {
    const host = nuevoHost()
    const yo = jugadorLocal(host, 'Anfitrión', 'token-local-1')
    await flush()
    expect(yo.cliente.idJugador).toBe('j1')
    expect(host.jugadoresSala()).toEqual([
      { id: 'j1', nombre: 'Anfitrión', conectado: true, listo: false },
    ])
  })

  it('solo recibe su proyección privada: nunca las cartas de los demás', async () => {
    const host = nuevoHost()
    const yo = jugadorLocal(host, 'Anfitrión', 'token-local-1')
    const otro = jugadorRemoto(host, 'Beto', 'token-local-2')
    await flush()
    host.iniciarPartida()
    await flush()

    const miEstado = yo.recibido.estados.at(-1)!
    const suEstado = otro.recibido.estados.at(-1)!
    const misIds = miEstado.yo.mano.map((c) => c.id)
    const susIds = suEstado.yo.mano.map((c) => c.id)
    expect(misIds).toHaveLength(2)
    expect(misIds.some((id) => susIds.includes(id))).toBe(false)
    // La proyección del anfitrión-jugador no contiene ninguna carta del otro ni del mazo.
    const texto = JSON.stringify(yo.recibido.estados)
    for (const id of susIds) expect(texto).not.toMatch(new RegExp(`"id":${id}[,}]`))
    expect(texto).not.toMatch(/"mazo"/)
  })

  it('puede jugar: sus intenciones pasan por el motor con su identidad', async () => {
    const host = nuevoHost()
    const yo = jugadorLocal(host, 'Anfitrión', 'token-local-1')
    jugadorRemoto(host, 'Beto', 'token-local-2')
    await flush()
    host.iniciarPartida()
    await flush()

    yo.cliente.enviar({ tipo: 'elegirAccion', accion: 'sueldoMinimo' })
    await flush()
    const est = yo.recibido.estados.at(-1)!
    expect(est.jugadores.find((j) => j.id === 'j1')!.creditos).toBe(3)
    expect(est.jugadorActivo).toBe('j2')
  })

  it('al terminar puede reiniciar o volver al lobby, y los demás se enteran', async () => {
    const host = nuevoHost()
    const yo = jugadorLocal(host, 'Anfitrión', 'token-local-1')
    const otro = jugadorRemoto(host, 'Beto', 'token-local-2')
    await flush()
    host.iniciarPartida()
    await flush()

    // Llevamos la partida al fin: j2 con una sola carta recibe una Demanda laboral de j1.
    const interno = host as unknown as { estado: EstadoJuego }
    interno.estado.jugadores[1].cartas[1].revelada = true
    interno.estado.jugadores[1].creditos = 0 // sin créditos no hay ventana de «explotar el site»
    interno.estado.jugadores[0].creditos = 7
    yo.cliente.enviar({ tipo: 'elegirAccion', accion: 'demandaLaboral', objetivo: 'j2' })
    await flush()
    otro.cliente.enviar({ tipo: 'pasar' }) // j2 no se cubre
    await flush()
    expect(yo.recibido.estados.at(-1)!.fase.tipo).toBe('fin')

    host.reiniciarPartida()
    await flush()
    expect(yo.recibido.estados.at(-1)!.fase.tipo).toBe('accion')
    expect(otro.recibido.estados.at(-1)!.yo.mano.every((c) => !c.revelada)).toBe(true)

    // Otra vez al fin, y ahora de vuelta al lobby.
    const interno2 = host as unknown as { estado: EstadoJuego }
    interno2.estado.jugadores.forEach((j) => (j.cartas[1].revelada = true))
    interno2.estado.jugadores.forEach((j) => (j.creditos = 0))
    const activo = interno2.estado.jugadorActivo
    interno2.estado.jugadores.find((j) => j.id === activo)!.creditos = 7
    const [atacante, victima] = activo === 'j1' ? [yo, 'j2'] : [otro, 'j1']
    atacante.cliente.enviar({ tipo: 'elegirAccion', accion: 'demandaLaboral', objetivo: victima })
    await flush()
    ;(activo === 'j1' ? otro : yo).cliente.enviar({ tipo: 'pasar' }) // la víctima no se cubre
    await flush()
    host.volverAlLobby()
    await flush()
    expect(host.iniciada).toBe(false)
    expect(yo.recibido.salas.at(-1)).toBe(false)
    expect(otro.recibido.salas.at(-1)).toBe(false)
  })

  it('si se cierra la sala, la conexión local se cierra', async () => {
    const host = nuevoHost()
    const yo = jugadorLocal(host, 'Anfitrión', 'token-local-1')
    await flush()
    host.cerrar()
    await flush()
    expect(yo.recibido.cerrada).toBe(true)
  })
})

describe('el anfitrión de una mesa ocupa (y deja) un asiento', () => {
  const ultimaSala = (r: { jugadoresSala: string[][] }) => r.jugadoresSala.at(-1)

  it('se une a una sala que ya tiene jugadores y los demás lo ven', async () => {
    const host = nuevoHost()
    const beto = jugadorRemoto(host, 'Beto', 'token-remoto-1')
    await flush()
    expect(host.snapshot().asientoLocal).toBeNull() // solo mesa

    const yo = jugadorLocal(host, 'Anfitrión', 'token-local-1')
    await flush()
    expect(host.snapshot().asientoLocal).toBe('j2')
    expect(host.snapshot().jugadores.map((j) => j.nombre)).toEqual(['Beto', 'Anfitrión'])
    expect(ultimaSala(beto.recibido)).toEqual(['Beto', 'Anfitrión'])
    expect(yo.cliente.idJugador).toBe('j2')
  })

  it('respeta el aforo del modo: sin roles especiales, con 6 sentados no entra', async () => {
    const host = nuevoHost({ especiales: false })
    for (let i = 1; i <= 6; i++) jugadorRemoto(host, `J${i}`, `token-remoto-${i}`)
    await flush()
    const yo = jugadorLocal(host, 'Anfitrión', 'token-local-1')
    await flush()
    expect(yo.recibido.errores).toEqual(['salaLlena'])
    expect(host.snapshot().asientoLocal).toBeNull()
    expect(host.snapshot().jugadores).toHaveLength(6)
  })

  it('su asiento cuenta para el aforo: con él dentro, el último lugar se ocupa', async () => {
    const host = nuevoHost({ especiales: false })
    for (let i = 1; i <= 5; i++) jugadorRemoto(host, `J${i}`, `token-remoto-${i}`)
    jugadorLocal(host, 'Anfitrión', 'token-local-1')
    await flush()
    expect(host.snapshot()).toMatchObject({ asientoLocal: 'j6' })
    const tarde = jugadorRemoto(host, 'Tarde', 'token-remoto-9')
    await flush()
    expect(tarde.recibido.errores).toEqual(['salaLlena'])
  })

  it('no puede unirse con la partida en curso', async () => {
    const host = nuevoHost()
    jugadorRemoto(host, 'Beto', 'token-remoto-1')
    jugadorRemoto(host, 'Carla', 'token-remoto-2')
    await flush()
    host.iniciarPartida()
    const yo = jugadorLocal(host, 'Anfitrión', 'token-local-1')
    await flush()
    expect(yo.recibido.errores).toEqual(['partidaEnCurso'])
    expect(host.snapshot().asientoLocal).toBeNull()
  })

  it('el anfitrión no puede ocupar dos asientos', async () => {
    const host = nuevoHost()
    jugadorLocal(host, 'Anfitrión', 'token-local-1')
    await flush()
    const doble = jugadorLocal(host, 'Anfitrión otra vez', 'token-local-2')
    await flush()
    expect(doble.recibido.errores).toEqual(['yaTienesAsiento'])
    expect(host.snapshot().jugadores).toHaveLength(1)
    expect(host.snapshot().asientoLocal).toBe('j1')
  })

  describe('dejar el asiento', () => {
    it('libera el asiento, avisa a los demás, cierra su conexión y vuelve a ser solo la mesa', async () => {
      const host = nuevoHost()
      const beto = jugadorRemoto(host, 'Beto', 'token-remoto-1')
      const yo = jugadorLocal(host, 'Anfitrión', 'token-local-1')
      await flush()
      beto.cliente.marcarListo(true)
      await flush()

      host.dejarAsientoLocal()
      await flush()
      expect(host.snapshot().asientoLocal).toBeNull()
      expect(host.snapshot().jugadores.map((j) => j.nombre)).toEqual(['Beto'])
      expect(ultimaSala(beto.recibido)).toEqual(['Beto'])
      expect(yo.recibido.cerrada).toBe(true)
      expect(host.snapshot().jugadores[0].listo).toBe(true) // lo demás no cambia
    })

    it('puede volver a sentarse después y obtiene un asiento nuevo', async () => {
      const host = nuevoHost()
      jugadorRemoto(host, 'Beto', 'token-remoto-1')
      jugadorLocal(host, 'Anfitrión', 'token-local-1')
      await flush()
      host.dejarAsientoLocal()
      const otraVez = jugadorLocal(host, 'Anfitrión', 'token-local-1')
      await flush()
      expect(otraVez.recibido.errores).toEqual([])
      expect(host.snapshot().asientoLocal).toBe('j3')
      expect(host.snapshot().jugadores).toHaveLength(2)
    })

    it('el aforo se libera: cabe otro jugador en su lugar', async () => {
      const host = nuevoHost({ especiales: false })
      for (let i = 1; i <= 5; i++) jugadorRemoto(host, `J${i}`, `token-remoto-${i}`)
      jugadorLocal(host, 'Anfitrión', 'token-local-1')
      await flush()
      host.dejarAsientoLocal()
      const nuevo = jugadorRemoto(host, 'Nuevo', 'token-remoto-9')
      await flush()
      expect(nuevo.recibido.errores).toEqual([])
      expect(host.snapshot().jugadores).toHaveLength(6)
    })

    it('afecta al inicio: sin su asiento puede faltar un jugador', async () => {
      const host = nuevoHost()
      jugadorRemoto(host, 'Beto', 'token-remoto-1')
      jugadorLocal(host, 'Anfitrión', 'token-local-1')
      await flush()
      expect(host.snapshot().puedeIniciar).toBe(true)
      host.dejarAsientoLocal()
      expect(host.snapshot()).toMatchObject({
        puedeIniciar: false,
        motivoBloqueo: 'Faltan 1 jugador (mínimo 2).',
      })
    })

    it('no se puede con la partida en curso ni sin tener asiento', async () => {
      const host = nuevoHost()
      jugadorRemoto(host, 'Beto', 'token-remoto-1')
      await flush()
      expect(() => host.dejarAsientoLocal()).toThrow(/No ocupas ningún asiento/)

      jugadorLocal(host, 'Anfitrión', 'token-local-1')
      await flush()
      host.iniciarPartida()
      expect(() => host.dejarAsientoLocal()).toThrow(/partida en curso/)
      expect(host.snapshot().asientoLocal).toBe('j2')
    })
  })

  it('al iniciar, el anfitrión sentado solo recibe su proyección y la mesa pública sigue sin manos', async () => {
    const host = nuevoHost()
    const beto = jugadorRemoto(host, 'Beto', 'token-remoto-1')
    const yo = jugadorLocal(host, 'Anfitrión', 'token-local-1')
    await flush()
    host.iniciarPartida()
    await flush()
    const miProyeccion = yo.recibido.estados.at(-1)!
    expect(miProyeccion.yo.id).toBe('j2')
    expect(miProyeccion.yo.mano).toHaveLength(2)
    expect(beto.recibido.estados.at(-1)!.yo.id).toBe('j1')
    expect(JSON.stringify(host.snapshot().mesa)).not.toContain('"mano"')
  })
})
