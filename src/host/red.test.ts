import { describe, expect, it } from 'vitest'
import { ClienteConexion, unirseASala } from '../client/ClienteConexion'
import { crearRng } from '../game/rng'
import { generarCodigoSala, normalizarCodigo } from '../shared/codigoSala'
import { parsearMensajeCliente, type MensajeHost } from '../shared/protocolo'
import {
  ErrorIdOcupado,
  logSilencioso,
  type Conexion,
  type ServidorTransporte,
} from '../shared/transporte'
import { crearHost, HostServidor } from './HostServidor'

// ------------------------------------------------------------ Transporte falso

/** Extremo de una conexión en memoria. Serializa a JSON como haría la red real. */
class ExtremoFalso implements Conexion {
  par!: ExtremoFalso
  cerrado = false
  private recibir: ((m: unknown) => void)[] = []
  private cierres: (() => void)[] = []
  recibidos: unknown[] = []

  enviar(m: unknown) {
    if (this.cerrado) throw new Error('conexión cerrada')
    const copia = JSON.parse(JSON.stringify(m))
    this.par.recibidos.push(copia)
    this.par.recibir.forEach((cb) => cb(copia))
  }
  alRecibir(cb: (m: unknown) => void) { this.recibir.push(cb) }
  alCerrar(cb: () => void) { this.cierres.push(cb) }
  cerrar() {
    if (this.cerrado) return
    this.cerrado = true
    this.par.cerrado = true
    this.cierres.forEach((cb) => cb())
    this.par.cierres.forEach((cb) => cb())
  }
}

class ServidorFalso implements ServidorTransporte {
  private cb: ((c: Conexion) => void) | null = null
  alConectar(cb: (c: Conexion) => void) { this.cb = cb }
  cerrar() {}
  /** Simula que un cliente se conecta; devuelve el extremo del cliente. */
  conectar(): ExtremoFalso {
    const cliente = new ExtremoFalso()
    const servidor = new ExtremoFalso()
    cliente.par = servidor
    servidor.par = cliente
    this.cb!(servidor)
    return cliente
  }
}

const opciones = { log: logSilencioso, rng: crearRng(11) }

function sala() {
  const srv = new ServidorFalso()
  const host = new HostServidor('ABCDE', srv, opciones)
  return { srv, host }
}

const unirse = (c: ExtremoFalso, nombre: string, token: string) =>
  c.enviar({ tipo: 'unirse', nombre, token })

const tokenDe = (n: string) => `token-${n}-`.padEnd(12, 'x')

/** Une `n` clientes y devuelve sus extremos. */
function unir(srv: ServidorFalso, n: number): ExtremoFalso[] {
  return Array.from({ length: n }, (_, i) => {
    const c = srv.conectar()
    unirse(c, `Jugador${i + 1}`, tokenDe(String(i + 1)))
    return c
  })
}

const mensajes = (c: ExtremoFalso) => c.recibidos as MensajeHost[]
const ultimo = (c: ExtremoFalso, tipo: MensajeHost['tipo']) =>
  [...mensajes(c)].reverse().find((m) => m.tipo === tipo)

// ------------------------------------------------------------------- Tests

describe('código de sala', () => {
  it('genera 5 caracteres legibles y los normaliza', () => {
    for (let i = 0; i < 200; i++) {
      const c = generarCodigoSala()
      expect(c).toMatch(/^[A-HJKMNP-Z2-9]{5}$/)
      expect(normalizarCodigo(c.toLowerCase())).toBe(c)
    }
    expect(normalizarCodigo('ABC')).toBeNull()
    expect(normalizarCodigo('ABCD0')).toBeNull()
  })

  it('crearHost reintenta con otro código si el ID está ocupado', async () => {
    const intentos: string[] = []
    const codigos = ['AAAAA', 'BBBBB']
    const host = await crearHost(
      async (codigo) => {
        intentos.push(codigo)
        if (codigo === 'AAAAA') throw new ErrorIdOcupado()
        return new ServidorFalso()
      },
      { ...opciones, generarCodigo: () => codigos.shift()! },
    )
    expect(intentos).toEqual(['AAAAA', 'BBBBB'])
    expect(host.codigo).toBe('BBBBB')
  })
})

describe('validación de mensajes', () => {
  it('descarta propiedades extra y mensajes malformados', () => {
    const m = parsearMensajeCliente({
      tipo: 'intencion',
      intencion: { tipo: 'pasar', jugador: 'j2', extra: 1 },
    })
    expect(m).toEqual({ tipo: 'intencion', intencion: { tipo: 'pasar' } })
    for (const malo of [
      null, 'x', 5, {}, { tipo: 'intencion' },
      { tipo: 'intencion', intencion: { tipo: 'elegirAccion', accion: 'hackear' } },
      { tipo: 'intencion', intencion: { tipo: 'revelarCarta', cartaId: 'uno' } },
      { tipo: 'intencion', intencion: { tipo: 'confirmarReasignacion', conservar: [1.5] } },
      { tipo: 'unirse', nombre: '', token: 'x'.repeat(16) },
      { tipo: 'unirse', nombre: 'x'.repeat(50), token: 'x'.repeat(16) },
      { tipo: 'unirse', nombre: 'Ana', token: 'corto' },
    ]) {
      expect(parsearMensajeCliente(malo)).toBeNull()
    }
  })
})

describe('lobby', () => {
  it('registra jugadores, responde bienvenida y difunde la sala', () => {
    const { srv, host } = sala()
    const [a, b] = unir(srv, 2)
    expect(ultimo(a, 'bienvenida')).toEqual({ tipo: 'bienvenida', idJugador: 'j1' })
    expect(ultimo(b, 'bienvenida')).toEqual({ tipo: 'bienvenida', idJugador: 'j2' })
    const salaMsg = ultimo(a, 'sala') as Extract<MensajeHost, { tipo: 'sala' }>
    expect(salaMsg.jugadores.map((j) => j.nombre)).toEqual(['Jugador1', 'Jugador2'])
    expect(host.jugadoresSala().every((j) => j.conectado)).toBe(true)
  })

  it('nunca envía tokens a nadie', () => {
    const { srv } = sala()
    const cs = unir(srv, 3)
    for (const c of cs) expect(JSON.stringify(c.recibidos)).not.toMatch(/token-/)
  })

  it('rechaza el séptimo jugador', () => {
    const { srv } = sala()
    unir(srv, 6)
    const extra = srv.conectar()
    unirse(extra, 'Extra', tokenDe('extra'))
    expect(ultimo(extra, 'error')).toMatchObject({ codigo: 'salaLlena' })
  })

  it('no inicia con menos de 2 jugadores', () => {
    const { srv, host } = sala()
    unir(srv, 1)
    expect(() => host.iniciarPartida()).toThrow()
  })
})

describe('partida en red', () => {
  it('cada cliente recibe solo SU proyección: ninguna carta ajena ni del mazo', () => {
    const { srv, host } = sala()
    const cs = unir(srv, 3)
    host.iniciarPartida()

    const manos = cs.map((c) => {
      const est = ultimo(c, 'estado') as Extract<MensajeHost, { tipo: 'estado' }>
      return est.proyeccion.yo.mano.map((x) => x.id)
    })
    expect(new Set(manos.flat()).size).toBe(6) // manos disjuntas, 2 cartas cada una

    cs.forEach((c, i) => {
      const estados = mensajes(c).filter((m) => m.tipo === 'estado')
      expect(estados.length).toBeGreaterThan(0)
      const texto = JSON.stringify(estados)
      // El mensaje contiene las cartas propias y ninguna ajena.
      const ajenas = manos.filter((_, k) => k !== i).flat()
      for (const id of ajenas) expect(texto).not.toMatch(new RegExp(`"id":${id}[,}]`))
      expect(texto).not.toMatch(/"mazo"/)
    })
  })

  it('aplica la intención, y todos reciben la proyección actualizada', () => {
    const { srv, host } = sala()
    const cs = unir(srv, 2)
    host.iniciarPartida()
    cs[0].enviar({ tipo: 'intencion', intencion: { tipo: 'elegirAccion', accion: 'ingreso' } })

    for (const c of cs) {
      const est = ultimo(c, 'estado') as Extract<MensajeHost, { tipo: 'estado' }>
      expect(est.proyeccion.jugadorActivo).toBe('j2')
      expect(est.proyeccion.jugadores.find((j) => j.id === 'j1')!.creditos).toBe(3)
      expect(est.eventos.length).toBeGreaterThan(0)
    }
  })

  it('el host ignora el `jugador` que declare el cliente (suplantación)', () => {
    const { srv, host } = sala()
    const [a, b] = unir(srv, 2)
    host.iniciarPartida()

    // b (que NO es el jugador activo) intenta actuar como j1.
    b.enviar({ tipo: 'intencion', intencion: { tipo: 'elegirAccion', accion: 'ingreso', jugador: 'j1' } })
    expect(ultimo(b, 'error')).toMatchObject({ codigo: 'noEsTuTurno' })

    // a (activo) intenta actuar como j2: se aplica igualmente a j1.
    a.enviar({ tipo: 'intencion', intencion: { tipo: 'elegirAccion', accion: 'ingreso', jugador: 'j2' } })
    const est = ultimo(a, 'estado') as Extract<MensajeHost, { tipo: 'estado' }>
    expect(est.proyeccion.jugadores.find((j) => j.id === 'j1')!.creditos).toBe(3)
    expect(est.proyeccion.jugadores.find((j) => j.id === 'j2')!.creditos).toBe(2)
  })

  it('una intención ilegal solo genera error al remitente', () => {
    const { srv, host } = sala()
    const [a, b] = unir(srv, 2)
    host.iniciarPartida()
    const antes = mensajes(b).length
    a.enviar({ tipo: 'intencion', intencion: { tipo: 'elegirAccion', accion: 'golpe', objetivo: 'j2' } })
    expect(ultimo(a, 'error')).toMatchObject({ codigo: 'creditosInsuficientes' })
    expect(mensajes(b).length).toBe(antes)
  })

  it('mensajes basura no rompen al host', () => {
    const { srv, host } = sala()
    const [a] = unir(srv, 2)
    for (const basura of [null, 42, 'hola', [], { tipo: 'x' }]) a.enviar(basura)
    expect(ultimo(a, 'error')).toMatchObject({ codigo: 'mensajeInvalido' })
    expect(() => host.iniciarPartida()).not.toThrow()
  })

  it('intención antes de unirse o antes de iniciar es rechazada', () => {
    const { srv, host } = sala()
    const sinUnir = srv.conectar()
    sinUnir.enviar({ tipo: 'intencion', intencion: { tipo: 'pasar' } })
    expect(ultimo(sinUnir, 'error')).toMatchObject({ codigo: 'noUnido' })

    const [a] = unir(srv, 1)
    a.enviar({ tipo: 'intencion', intencion: { tipo: 'pasar' } })
    expect(ultimo(a, 'error')).toMatchObject({ codigo: 'sinPartida' })
    expect(host.iniciada).toBe(false)
  })
})

describe('desconexión y reconexión', () => {
  it('marca al jugador como desconectado y lo difunde', () => {
    const { srv, host } = sala()
    const [a, b] = unir(srv, 2)
    b.cerrar()
    expect(host.jugadoresSala().map((j) => j.conectado)).toEqual([true, false])
    const s = ultimo(a, 'sala') as Extract<MensajeHost, { tipo: 'sala' }>
    expect(s.jugadores[1].conectado).toBe(false)
    expect(() => host.iniciarPartida()).toThrow() // hay desconectados
  })

  it('con el mismo token recupera su asiento y su estado, también durante la partida', () => {
    const { srv, host } = sala()
    const [a, b] = unir(srv, 2)
    host.iniciarPartida()
    const manoAntes = (ultimo(b, 'estado') as Extract<MensajeHost, { tipo: 'estado' }>).proyeccion.yo.mano

    b.cerrar()
    expect(host.jugadoresSala()[1].conectado).toBe(false)

    const b2 = srv.conectar()
    unirse(b2, 'LoQueSea', tokenDe('2'))
    expect(ultimo(b2, 'bienvenida')).toEqual({ tipo: 'bienvenida', idJugador: 'j2' })
    const est = ultimo(b2, 'estado') as Extract<MensajeHost, { tipo: 'estado' }>
    expect(est.proyeccion.yo.mano).toEqual(manoAntes)
    expect(host.jugadoresSala()[1].conectado).toBe(true)
    expect(a.cerrado).toBe(false)
  })

  it('un token desconocido no puede entrar con la partida en curso', () => {
    const { srv, host } = sala()
    unir(srv, 2)
    host.iniciarPartida()
    const intruso = srv.conectar()
    unirse(intruso, 'Intruso', tokenDe('otro'))
    expect(ultimo(intruso, 'error')).toMatchObject({ codigo: 'partidaEnCurso' })
    expect(host.jugadoresSala()).toHaveLength(2)
  })

  it('una segunda conexión con el mismo token reemplaza a la anterior', () => {
    const { srv, host } = sala()
    const [, b] = unir(srv, 2)
    const b2 = srv.conectar()
    unirse(b2, 'Jugador2', tokenDe('2'))
    expect(b.cerrado).toBe(true)
    // El cierre de la conexión vieja no marca al jugador como desconectado.
    expect(host.jugadoresSala()[1].conectado).toBe(true)
  })
})

describe('ClienteConexion', () => {
  it('flujo completo cliente ↔ host con el transporte falso', async () => {
    const { srv, host } = sala()
    const estados: string[] = []
    const crear = async (nombre: string) =>
      unirseASala('ABCDE', nombre, async () => srv.conectar(), {
        alEstado: (p) => estados.push(`${p.yo.id}:${p.fase.tipo}`),
      }, new MemoriaAlmacen())

    const c1 = await crear('Ana')
    const c2 = await crear('Beto')
    expect(c1.idJugador).toBe('j1')
    expect(c2.idJugador).toBe('j2')
    expect(c1 instanceof ClienteConexion).toBe(true)

    host.iniciarPartida()
    c1.enviar({ tipo: 'elegirAccion', accion: 'ingreso' })
    expect(c2.ultimoEstado!.jugadorActivo).toBe('j2')
    expect(estados.length).toBeGreaterThan(2)
  })
})

/** Storage mínimo en memoria para no depender del navegador. */
class MemoriaAlmacen implements Storage {
  private d = new Map<string, string>()
  get length() { return this.d.size }
  clear() { this.d.clear() }
  getItem(k: string) { return this.d.get(k) ?? null }
  key(i: number) { return [...this.d.keys()][i] ?? null }
  removeItem(k: string) { this.d.delete(k) }
  setItem(k: string, v: string) { this.d.set(k, v) }
}

describe('snapshot para la UI del anfitrión', () => {
  it('notifica cambios y solo expone información pública (sin tokens ni manos)', () => {
    const { srv, host } = sala()
    const notificaciones: ReturnType<HostServidor['snapshot']>[] = []
    const baja = host.alCambiar((s) => notificaciones.push(s))

    const cs = unir(srv, 2)
    expect(notificaciones.at(-1)!.jugadores).toHaveLength(2)
    expect(notificaciones.at(-1)!.puedeIniciar).toBe(true)
    expect(notificaciones.at(-1)!.mesa).toBeNull()

    host.iniciarPartida()
    const s = notificaciones.at(-1)!
    expect(s.iniciada).toBe(true)
    expect(s.puedeIniciar).toBe(false)
    expect(Object.keys(s.mesa!)).not.toContain('mazo')
    const texto = JSON.stringify(s)
    expect(texto).not.toMatch(/token-/)
    expect(texto).not.toMatch(/"id":\d/) // ningún id de carta

    cs[0].enviar({ tipo: 'intencion', intencion: { tipo: 'elegirAccion', accion: 'ingreso' } })
    expect(notificaciones.at(-1)!.mesa!.jugadorActivo).toBe('j2')

    cs[1].cerrar()
    expect(notificaciones.at(-1)!.jugadores[1].conectado).toBe(false)

    baja()
    const n = notificaciones.length
    cs[0].cerrar()
    expect(notificaciones.length).toBe(n)
  })

  it('no se puede iniciar con 1 jugador ni con desconectados', () => {
    const { srv, host } = sala()
    unir(srv, 1)
    expect(host.snapshot().puedeIniciar).toBe(false)
    const b = srv.conectar()
    unirse(b, 'Otro', tokenDe('otro'))
    expect(host.snapshot().puedeIniciar).toBe(true)
    b.cerrar()
    expect(host.snapshot().puedeIniciar).toBe(false)
  })
})
