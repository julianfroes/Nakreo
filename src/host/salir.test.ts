import { afterEach, describe, expect, it, vi } from 'vitest'
import { ClienteConexion } from '../client/ClienteConexion'
import type { EstadoProyectado } from '../game/proyeccion'
import { crearRng } from '../game/rng'
import type { EstadoJuego } from '../game/types'
import { ServidorEnMemoria } from '../shared/servidorEnMemoria'
import { logSilencioso } from '../shared/transporte'
import { HostServidor } from './HostServidor'

/** Salir: sala de espera, partida en curso, partida terminada, y cierre ordenado de la sala. */

const flush = () => new Promise((r) => setTimeout(r, 0))

function nuevaSala(extra: { especiales?: boolean; retardoCierreMs?: number } = {}) {
  const red = new ServidorEnMemoria()
  const host = new HostServidor('ABCDE', red, {
    log: logSilencioso, rng: crearRng(5), retardoCierreMs: 0, ...extra,
  })
  return { red, host }
}

/** Un jugador remoto con todo lo que recibe. */
function jugador(red: ServidorEnMemoria, nombre: string, token = `token-${nombre}-`.padEnd(12, 'x')) {
  const rec = {
    estados: [] as EstadoProyectado[],
    errores: [] as string[],
    cerrada: false,
    salaCerrada: false,
    nombresSala: [] as string[][],
  }
  const cliente = new ClienteConexion(
    red.conectar(),
    nombre,
    token,
    {
      alEstado: (p) => rec.estados.push(p),
      alError: (c) => rec.errores.push(c),
      alSala: (s) => rec.nombresSala.push(s.jugadores.map((j) => j.nombre)),
      alSalaCerrada: () => (rec.salaCerrada = true),
      alCerrar: () => (rec.cerrada = true),
    },
    logSilencioso,
  )
  return { cliente, rec, token }
}

const interno = (host: HostServidor) => host as unknown as { estado: EstadoJuego }

afterEach(() => vi.useRealTimers())

describe('salir de la sala de espera', () => {
  it('libera el asiento de verdad (no deja un fantasma «desconectado» que bloquee el inicio)', async () => {
    const { red, host } = nuevaSala()
    const a = jugador(red, 'Ana')
    const b = jugador(red, 'Beto')
    const c = jugador(red, 'Carla')
    await flush()
    b.cliente.enviar({ tipo: 'salir' })
    await flush()
    expect(host.snapshot().jugadores.map((j) => j.nombre)).toEqual(['Ana', 'Carla'])
    expect(host.snapshot().puedeIniciar).toBe(true) // sin asiento fantasma
    expect(b.rec.cerrada).toBe(true)
    expect(a.rec.nombresSala.at(-1)).toEqual(['Ana', 'Carla'])
    expect(c.rec.nombresSala.at(-1)).toEqual(['Ana', 'Carla'])
  })

  it('el que salió puede volver a entrar (no es una partida en curso)', async () => {
    const { red, host } = nuevaSala()
    jugador(red, 'Ana')
    const b = jugador(red, 'Beto')
    await flush()
    b.cliente.enviar({ tipo: 'salir' })
    await flush()
    const otraVez = jugador(red, 'Beto', b.token)
    await flush()
    expect(otraVez.rec.errores).toEqual([])
    expect(host.snapshot().jugadores.map((j) => j.nombre)).toEqual(['Ana', 'Beto'])
  })

  it('una caída de conexión, en cambio, conserva el asiento (se puede reconectar)', async () => {
    const { red, host } = nuevaSala()
    jugador(red, 'Ana')
    const b = jugador(red, 'Beto')
    await flush()
    b.cliente.cerrar()
    await flush()
    expect(host.snapshot().jugadores.map((j) => [j.nombre, j.conectado])).toEqual([['Ana', true], ['Beto', false]])
  })
})

describe('salir con la partida en curso', () => {
  async function partida(n = 3, extra = {}) {
    const { red, host } = nuevaSala(extra)
    const js = Array.from({ length: n }, (_, i) => jugador(red, ['Ana', 'Beto', 'Carla', 'Diego'][i]))
    await flush()
    host.iniciarPartida()
    await flush()
    return { red, host, js }
  }

  it('retira al jugador: cartas al descarte público, aviso a todos y su conexión se cierra', async () => {
    const { host, js } = await partida()
    const [ana, beto, carla] = js
    beto.cliente.enviar({ tipo: 'salir' })
    await flush()

    const mesa = host.snapshot().mesa!
    const b = mesa.jugadores.find((j) => j.id === 'j2')!
    expect(b).toMatchObject({ retirado: true, eliminado: true, creditos: 0, cartasVivas: 0 })
    expect(b.cartasReveladas).toHaveLength(2) // descarte público
    expect(mesa.registro.some((e) => e.tipo === 'jugadorRetirado' && e.jugador === 'j2')).toBe(true)

    // Los demás reciben el nuevo estado; él recibe su última proyección y se le cierra la conexión.
    expect(ana.rec.estados.at(-1)!.jugadores.find((j) => j.id === 'j2')!.retirado).toBe(true)
    expect(carla.rec.estados.at(-1)!.jugadores.find((j) => j.id === 'j2')!.retirado).toBe(true)
    expect(beto.rec.estados.at(-1)!.jugadores.find((j) => j.id === 'j2')!.retirado).toBe(true)
    expect(beto.rec.cerrada).toBe(true)
  })

  it('el turno continúa: si era el suyo, pasa al siguiente jugador vivo', async () => {
    const { host, js } = await partida()
    js[0].cliente.enviar({ tipo: 'salir' }) // Ana tiene el turno al empezar
    await flush()
    expect(host.snapshot().mesa!.jugadorActivo).toBe('j2')
    expect(host.snapshot().mesa!.fase.tipo).toBe('accion')
  })

  it('no puede reingresar a esta partida: su token se rechaza con un mensaje claro', async () => {
    const { red, host, js } = await partida()
    js[1].cliente.enviar({ tipo: 'salir' })
    await flush()
    const intento = jugador(red, 'Beto', js[1].token)
    await flush()
    expect(intento.rec.errores).toEqual(['retirado'])
    expect(intento.rec.estados).toHaveLength(0) // no recibe ni la mesa
    expect(host.snapshot().jugadores.find((j) => j.nombre === 'Beto')!.conectado).toBe(false)
    // Y con otro token tampoco: la partida ya empezó.
    const otro = jugador(red, 'Beto', 'otro-token-largo-1')
    await flush()
    expect(otro.rec.errores).toEqual(['partidaEnCurso'])
  })

  it('con dos jugadores, el otro gana al instante', async () => {
    const { host, js } = await partida(2)
    js[0].cliente.enviar({ tipo: 'salir' })
    await flush()
    expect(host.snapshot().mesa!.fase).toEqual({ tipo: 'fin', ganador: 'j2' })
    expect(js[1].rec.estados.at(-1)!.fase).toEqual({ tipo: 'fin', ganador: 'j2' })
  })

  it('al volver al lobby los retirados desaparecen y pueden entrar como jugadores nuevos', async () => {
    const { red, host, js } = await partida(4)
    js[1].cliente.enviar({ tipo: 'salir' })
    await flush()
    interno(host).estado.fase = { tipo: 'fin', ganador: 'j1' }
    host.volverAlLobby()
    expect(host.snapshot().jugadores.map((j) => j.nombre)).toEqual(['Ana', 'Carla', 'Diego'])
    const regresa = jugador(red, 'Beto', js[1].token)
    await flush()
    expect(regresa.rec.errores).toEqual([])
    expect(host.snapshot().jugadores.map((j) => j.nombre)).toEqual(['Ana', 'Carla', 'Diego', 'Beto'])
  })

  it('«jugar de nuevo» reparte solo entre los que siguen en la sala', async () => {
    const { host, js } = await partida(4)
    js[1].cliente.enviar({ tipo: 'salir' })
    await flush()
    interno(host).estado.fase = { tipo: 'fin', ganador: 'j1' }
    host.reiniciarPartida()
    expect(interno(host).estado.jugadores.map((j) => j.id).sort()).toEqual(['j1', 'j3', 'j4'])
    expect(interno(host).estado.jugadores.every((j) => !j.retirado && !j.eliminado)).toBe(true)
  })

  it('un espectador ya eliminado que se va solo libera su asiento', async () => {
    const { host, js } = await partida(3)
    interno(host).estado.jugadores[1].cartas.forEach((c) => (c.revelada = true))
    interno(host).estado.jugadores[1].eliminado = true
    js[1].cliente.enviar({ tipo: 'salir' })
    await flush()
    expect(host.snapshot().jugadores.map((j) => j.nombre)).toEqual(['Ana', 'Carla'])
    expect(host.snapshot().mesa!.jugadores.find((j) => j.id === 'j2')!.retirado).toBe(false)
  })

  it('con la partida terminada, salir libera el asiento', async () => {
    const { host, js } = await partida(3)
    interno(host).estado.fase = { tipo: 'fin', ganador: 'j1' }
    js[2].cliente.enviar({ tipo: 'salir' })
    await flush()
    expect(host.snapshot().jugadores.map((j) => j.nombre)).toEqual(['Ana', 'Beto'])
  })

  it('el anfitrión no puede retirarse (debe cerrar la sala), pero en el lobby puede dejar su asiento', async () => {
    const { red, host } = nuevaSala()
    jugador(red, 'Beto')
    const yo = new ClienteConexion(
      host.conectarLocal(), 'Anfitrión', 'token-local-1',
      { alError: (c) => errores.push(c) }, logSilencioso,
    )
    const errores: string[] = []
    await flush()
    host.iniciarPartida()
    await flush()
    yo.enviar({ tipo: 'salir' })
    await flush()
    expect(errores).toEqual(['mensajeInvalido'])
    expect(host.snapshot().asientoLocal).not.toBeNull()
    expect(host.snapshot().mesa!.jugadores.some((j) => j.retirado)).toBe(false)
  })
})

describe('cierre ordenado de la sala', () => {
  it('avisa a cada jugador antes de cerrar', async () => {
    const { red, host } = nuevaSala()
    const a = jugador(red, 'Ana')
    const b = jugador(red, 'Beto')
    await flush()
    host.cerrar()
    await flush()
    expect(a.rec.salaCerrada).toBe(true)
    expect(b.rec.salaCerrada).toBe(true)
    expect(a.rec.cerrada).toBe(true)
  })

  it('espera un instante para que el aviso llegue antes de cortar las conexiones remotas', async () => {
    vi.useFakeTimers()
    const { red, host } = nuevaSala({ retardoCierreMs: 250 })
    const a = jugador(red, 'Ana')
    await vi.advanceTimersByTimeAsync(0) // entra en la sala
    host.cerrar()
    await vi.advanceTimersByTimeAsync(0)
    expect(a.rec.salaCerrada).toBe(true)
    expect(a.rec.cerrada).toBe(false) // aún no se cortó
    await vi.advanceTimersByTimeAsync(250)
    expect(a.rec.cerrada).toBe(true)
  })

  it('cerrar dos veces es inofensivo', async () => {
    const { red, host } = nuevaSala()
    jugador(red, 'Ana')
    await flush()
    host.cerrar()
    expect(() => host.cerrar()).not.toThrow()
  })
})
