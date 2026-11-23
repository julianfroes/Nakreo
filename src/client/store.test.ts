import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { crearRng } from '../game/rng'
import { HostServidor } from '../host/HostServidor'
import { ServidorEnMemoria } from '../shared/servidorEnMemoria'
import { logSilencioso } from '../shared/transporte'
import { ClienteConexion } from './ClienteConexion'
import { useCliente } from './store'

/** Deja correr las microtareas pendientes (la conexión local entrega de forma asíncrona). */
const flush = () => new Promise((r) => setTimeout(r, 0))

/** Un almacén de sesión mínimo (los tests corren en Node, sin `sessionStorage`). */
function almacenFalso(): Storage {
  const datos = new Map<string, string>()
  return {
    get length() { return datos.size },
    clear: () => datos.clear(),
    getItem: (k) => datos.get(k) ?? null,
    key: (i) => [...datos.keys()][i] ?? null,
    removeItem: (k) => void datos.delete(k),
    setItem: (k, v) => void datos.set(k, v),
  }
}

describe('unirse a una sala llena', () => {
  beforeEach(() => {
    vi.stubGlobal('sessionStorage', almacenFalso())
  })
  afterEach(() => {
    useCliente.getState().salir()
    vi.unstubAllGlobals()
  })

  /** Sala sin roles especiales (aforo 6) con todos los asientos ocupados. */
  async function salaLlena() {
    const red = new ServidorEnMemoria()
    const host = new HostServidor('ABCDE', red, {
      log: logSilencioso, rng: crearRng(5), especiales: false,
    })
    for (let i = 1; i <= 6; i++) {
      new ClienteConexion(red.conectar(), `J${i}`, `token-${i}-`.padEnd(12, 'x'), {}, logSilencioso)
    }
    await flush()
    expect(host.snapshot().jugadores).toHaveLength(6)
    return host
  }

  it('muestra «Sala llena (6/6)» y bloquea «Unirme» para ese código hasta reintentar', async () => {
    const host = await salaLlena()
    await useCliente.getState().unirseLocal(host, 'Extra')
    await new Promise((r) => setTimeout(r, 20))

    const s = useCliente.getState()
    expect(s.error).toBe('Sala llena (6/6)')
    expect(s.rechazo).toEqual({ codigo: 'ABCDE', motivo: 'salaLlena' })
    expect(s.conexion).toBe('inicio') // vuelve al formulario, sin sala
    expect(s.codigo).toBe('ABCDE') // conserva el código escrito

    s.limpiarRechazo()
    expect(useCliente.getState()).toMatchObject({ rechazo: null, error: null })
  })

  it('el aforo y el modo llegan a la sala de espera del cliente', async () => {
    const host = new HostServidor('ABCDE', new ServidorEnMemoria(), { log: logSilencioso, rng: crearRng(5) })
    await useCliente.getState().unirseLocal(host, 'Ana')
    await new Promise((r) => setTimeout(r, 20))
    expect(useCliente.getState().sala).toMatchObject({ especiales: true, max: 8 })

    host.cambiarModo(false)
    await new Promise((r) => setTimeout(r, 20))
    expect(useCliente.getState().sala).toMatchObject({ especiales: false, max: 6 })

    // «Estoy listo» viaja al host y vuelve en la sala.
    useCliente.getState().marcarListo(true)
    await new Promise((r) => setTimeout(r, 20))
    expect(useCliente.getState().sala?.jugadores[0].listo).toBe(true)
  })
})

describe('abandonar la sala o la partida', () => {
  beforeEach(() => {
    vi.stubGlobal('sessionStorage', almacenFalso())
  })
  afterEach(() => {
    useCliente.getState().salir()
    vi.unstubAllGlobals()
  })

  const esperar = () => new Promise((r) => setTimeout(r, 30))

  /** Una sala con el cliente del store como «Ana» y otros dos jugadores remotos. */
  async function sala(n = 3) {
    const red = new ServidorEnMemoria()
    const host = new HostServidor('ABCDE', red, { log: logSilencioso, rng: crearRng(5), retardoCierreMs: 0 })
    await useCliente.getState().unirseConConector('ABCDE', 'Ana', async () => red.conectar())
    for (let i = 2; i <= n; i++) {
      new ClienteConexion(red.conectar(), `J${i}`, `token-${i}-`.padEnd(12, 'x'), {}, logSilencioso)
    }
    await esperar()
    return { red, host }
  }

  it('en la sala de espera: libera el asiento y vuelve al formulario', async () => {
    const { host } = await sala()
    expect(host.snapshot().jugadores).toHaveLength(3)
    useCliente.getState().abandonar()
    expect(useCliente.getState().saliendo).toBe(true)
    await esperar()
    expect(host.snapshot().jugadores.map((j) => j.nombre)).toEqual(['J2', 'J3'])
    expect(useCliente.getState()).toMatchObject({ conexion: 'inicio', saliendo: false, sala: null })
  })

  it('en la partida: queda retirado, conserva la pantalla de despedida y no intenta reconectar', async () => {
    const { host } = await sala()
    host.iniciarPartida()
    await esperar()
    expect(useCliente.getState().proyeccion).not.toBeNull()

    useCliente.getState().abandonar()
    await esperar()
    const s = useCliente.getState()
    expect(s.retirado).toBe(true)
    expect(s.saliendo).toBe(false)
    expect(s.conexion).toBe('conectado') // sin pantalla de «Reconectando…»
    expect(s.proyeccion?.jugadores.find((j) => j.id === s.proyeccion?.yo.id)?.retirado).toBe(true)
    expect(host.snapshot().mesa!.jugadores.find((j) => j.nombre === 'Ana')!.retirado).toBe(true)

    s.salir() // «Volver al inicio»
    expect(useCliente.getState()).toMatchObject({ conexion: 'inicio', retirado: false, proyeccion: null })
  })

  it('al volver a entrar en esa partida lo rechazan y «Unirme» queda bloqueado', async () => {
    const { red, host } = await sala()
    host.iniciarPartida()
    await esperar()
    useCliente.getState().abandonar()
    await esperar()
    useCliente.getState().salir()

    await useCliente.getState().unirseConConector('ABCDE', 'Ana', async () => red.conectar())
    await esperar()
    const s = useCliente.getState()
    expect(s.error).toMatch(/Abandonaste esta partida/)
    expect(s.rechazo).toEqual({ codigo: 'ABCDE', motivo: 'retirado' })
    expect(s.conexion).toBe('inicio')
  })

  it('si el anfitrión cierra la sala, se sale al instante con el motivo', async () => {
    const { host } = await sala()
    host.cerrar()
    await esperar()
    expect(useCliente.getState()).toMatchObject({
      conexion: 'inicio', error: 'El anfitrión cerró la sala.', sala: null,
    })
  })
});
