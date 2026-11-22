import { describe, expect, it } from 'vitest'
import { ClienteConexion } from '../client/ClienteConexion'
import type { EstadoProyectado } from '../game/proyeccion'
import { crearRng } from '../game/rng'
import type { EstadoJuego } from '../game/types'
import { crearParLocal } from '../shared/conexionLocal'
import { logSilencioso, type ServidorTransporte } from '../shared/transporte'
import { HostServidor } from './HostServidor'

/** Deja correr las microtareas pendientes (la conexión local entrega de forma asíncrona). */
const flush = () => new Promise((r) => setTimeout(r, 0))

const servidorVacio: ServidorTransporte = { alConectar() {}, cerrar() {} }

function nuevoHost() {
  return new HostServidor('ABCDE', servidorVacio, { log: logSilencioso, rng: crearRng(5) })
}

/** Un jugador conectado por conexión local, con su última proyección y eventos. */
function jugadorLocal(host: HostServidor, nombre: string, token: string) {
  const recibido = { estados: [] as EstadoProyectado[], salas: [] as boolean[], cerrada: false }
  const cliente = new ClienteConexion(
    host.conectarLocal(),
    nombre,
    token,
    {
      alEstado: (p) => recibido.estados.push(p),
      alSala: (_j, iniciada) => recibido.salas.push(iniciada),
      alCerrar: () => (recibido.cerrada = true),
    },
    logSilencioso,
  )
  return { cliente, recibido }
}

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
    expect(host.jugadoresSala()).toEqual([{ id: 'j1', nombre: 'Anfitrión', conectado: true }])
  })

  it('solo recibe su proyección privada: nunca las cartas de los demás', async () => {
    const host = nuevoHost()
    const yo = jugadorLocal(host, 'Anfitrión', 'token-local-1')
    const otro = jugadorLocal(host, 'Beto', 'token-local-2')
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
    jugadorLocal(host, 'Beto', 'token-local-2')
    await flush()
    host.iniciarPartida()
    await flush()

    yo.cliente.enviar({ tipo: 'elegirAccion', accion: 'ingreso' })
    await flush()
    const est = yo.recibido.estados.at(-1)!
    expect(est.jugadores.find((j) => j.id === 'j1')!.creditos).toBe(3)
    expect(est.jugadorActivo).toBe('j2')
  })

  it('al terminar puede reiniciar o volver al lobby, y los demás se enteran', async () => {
    const host = nuevoHost()
    const yo = jugadorLocal(host, 'Anfitrión', 'token-local-1')
    const otro = jugadorLocal(host, 'Beto', 'token-local-2')
    await flush()
    host.iniciarPartida()
    await flush()

    // Llevamos la partida al fin: j2 con una sola carta recibe un golpe de j1.
    const interno = host as unknown as { estado: EstadoJuego }
    interno.estado.jugadores[1].cartas[1].revelada = true
    interno.estado.jugadores[0].creditos = 7
    yo.cliente.enviar({ tipo: 'elegirAccion', accion: 'golpe', objetivo: 'j2' })
    await flush()
    expect(yo.recibido.estados.at(-1)!.fase.tipo).toBe('fin')

    host.reiniciarPartida()
    await flush()
    expect(yo.recibido.estados.at(-1)!.fase.tipo).toBe('accion')
    expect(otro.recibido.estados.at(-1)!.yo.mano.every((c) => !c.revelada)).toBe(true)

    // Otra vez al fin, y ahora de vuelta al lobby.
    const interno2 = host as unknown as { estado: EstadoJuego }
    interno2.estado.jugadores.forEach((j) => (j.cartas[1].revelada = true))
    const activo = interno2.estado.jugadorActivo
    interno2.estado.jugadores.find((j) => j.id === activo)!.creditos = 7
    const [atacante, victima] = activo === 'j1' ? [yo, 'j2'] : [otro, 'j1']
    atacante.cliente.enviar({ tipo: 'elegirAccion', accion: 'golpe', objetivo: victima })
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
