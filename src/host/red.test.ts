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
import type { EstadoJuego } from '../game/types'
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

  it('rechaza el noveno jugador', () => {
    const { srv } = sala()
    unir(srv, 8)
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
    cs[0].enviar({ tipo: 'intencion', intencion: { tipo: 'elegirAccion', accion: 'sueldoMinimo' } })

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
    b.enviar({ tipo: 'intencion', intencion: { tipo: 'elegirAccion', accion: 'sueldoMinimo', jugador: 'j1' } })
    expect(ultimo(b, 'error')).toMatchObject({ codigo: 'noEsTuTurno' })

    // a (activo) intenta actuar como j2: se aplica igualmente a j1.
    a.enviar({ tipo: 'intencion', intencion: { tipo: 'elegirAccion', accion: 'sueldoMinimo', jugador: 'j2' } })
    const est = ultimo(a, 'estado') as Extract<MensajeHost, { tipo: 'estado' }>
    expect(est.proyeccion.jugadores.find((j) => j.id === 'j1')!.creditos).toBe(3)
    expect(est.proyeccion.jugadores.find((j) => j.id === 'j2')!.creditos).toBe(2)
  })

  it('una intención ilegal solo genera error al remitente', () => {
    const { srv, host } = sala()
    const [a, b] = unir(srv, 2)
    host.iniciarPartida()
    const antes = mensajes(b).length
    a.enviar({ tipo: 'intencion', intencion: { tipo: 'elegirAccion', accion: 'demandaLaboral', objetivo: 'j2' } })
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
    c1.enviar({ tipo: 'elegirAccion', accion: 'sueldoMinimo' })
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

    cs[0].enviar({ tipo: 'intencion', intencion: { tipo: 'elegirAccion', accion: 'sueldoMinimo' } })
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

describe('reinicio de partida', () => {
  /** Lleva la partida al fin: j2 se queda con una carta y j1 le pone una Demanda laboral. */
  function hastaElFin() {
    const { srv, host } = sala()
    const cs = unir(srv, 2)
    host.iniciarPartida()
    const interno = host as unknown as { estado: EstadoJuego }
    interno.estado.jugadores[1].cartas[1].revelada = true
    interno.estado.jugadores[1].creditos = 0 // sin créditos no hay ventana de «explotar el site»
    interno.estado.jugadores[0].creditos = 7
    cs[0].enviar({ tipo: 'intencion', intencion: { tipo: 'elegirAccion', accion: 'demandaLaboral', objetivo: 'j2' } })
    cs[1].enviar({ tipo: 'intencion', intencion: { tipo: 'pasar' } }) // j2 no se cubre
    expect(host.snapshot().mesa!.fase.tipo).toBe('fin')
    return { srv, host, cs }
  }

  it('solo se puede reiniciar cuando la partida terminó', () => {
    const { srv, host } = sala()
    unir(srv, 2)
    host.iniciarPartida()
    expect(() => host.reiniciarPartida()).toThrow()
    expect(() => host.volverAlLobby()).toThrow()
  })

  it('«jugar de nuevo» reparte una partida nueva con los mismos jugadores', () => {
    const { host, cs } = hastaElFin()
    host.reiniciarPartida()
    const mesa = host.snapshot().mesa!
    expect(mesa.fase.tipo).toBe('accion')
    expect(mesa.turno).toBe(1)
    expect(mesa.jugadores.map((j) => j.eliminado)).toEqual([false, false])
    expect(mesa.jugadores.every((j) => j.creditos === 2 && j.cartasVivas === 2)).toBe(true)
    // Ambos reciben su nueva mano.
    for (const c of cs) {
      const est = ultimo(c, 'estado') as Extract<MensajeHost, { tipo: 'estado' }>
      expect(est.proyeccion.fase.tipo).toBe('accion')
      expect(est.proyeccion.yo.mano.every((x) => !x.revelada)).toBe(true)
    }
  })

  it('descarta a los desconectados y exige 2 jugadores conectados', () => {
    const { srv, host, cs } = hastaElFin()
    const [, b] = cs
    b.cerrar()
    expect(() => host.reiniciarPartida()).toThrow(/al menos 2/)
    const b2 = srv.conectar()
    unirse(b2, 'Otro', tokenDe('2'))
    expect(() => host.reiniciarPartida()).not.toThrow()
  })

  it('«volver al lobby» avisa a los clientes y permite entrar jugadores nuevos', () => {
    const { srv, host, cs } = hastaElFin()
    host.volverAlLobby()
    expect(host.iniciada).toBe(false)
    const s = ultimo(cs[0], 'sala') as Extract<MensajeHost, { tipo: 'sala' }>
    expect(s.iniciada).toBe(false)

    const nuevo = srv.conectar()
    unirse(nuevo, 'Nuevo', tokenDe('nuevo'))
    expect(ultimo(nuevo, 'bienvenida')).toEqual({ tipo: 'bienvenida', idJugador: 'j3' })
    expect(host.snapshot().puedeIniciar).toBe(true)
    host.iniciarPartida()
    expect(host.snapshot().mesa!.jugadores).toHaveLength(3)
  })
})

describe('modo de juego y aforo de la sala', () => {
  const salaSin = () => {
    const srv = new ServidorFalso()
    const host = new HostServidor('ABCDE', srv, { ...opciones, especiales: false })
    return { srv, host }
  }
  const sala_ = (c: ExtremoFalso) => ultimo(c, 'sala') as Extract<MensajeHost, { tipo: 'sala' }>

  it('anuncia el modo y el aforo a los jugadores', () => {
    const { srv, host } = sala()
    const [a] = unir(srv, 2)
    expect(sala_(a)).toMatchObject({ especiales: true, max: 8, iniciada: false })
    expect(host.snapshot()).toMatchObject({ especiales: true, max: 8 })

    const { srv: srvB, host: hostB } = salaSin()
    const [b] = unir(srvB, 2)
    expect(sala_(b)).toMatchObject({ especiales: false, max: 6 })
    expect(hostB.snapshot()).toMatchObject({ especiales: false, max: 6 })
  })

  it('sin roles especiales la sala se llena con 6 y el séptimo ve «Sala llena (6/6)»', () => {
    const { srv } = salaSin()
    unir(srv, 6)
    const extra = srv.conectar()
    unirse(extra, 'Extra', tokenDe('extra'))
    expect(ultimo(extra, 'error')).toMatchObject({ codigo: 'salaLlena', mensaje: 'Sala llena (6/6)' })
  })

  it('con roles especiales caben 8 y el noveno ve «Sala llena (8/8)»', () => {
    const { srv } = sala()
    unir(srv, 8)
    const extra = srv.conectar()
    unirse(extra, 'Extra', tokenDe('extra'))
    expect(ultimo(extra, 'error')).toMatchObject({ codigo: 'salaLlena', mensaje: 'Sala llena (8/8)' })
  })

  it('un jugador que ya tenía asiento puede reconectar aunque la sala esté llena', () => {
    const { srv } = salaSin()
    const cs = unir(srv, 6)
    cs[2].cerrar()
    const vuelve = srv.conectar()
    unirse(vuelve, 'Jugador3', tokenDe('3'))
    expect(ultimo(vuelve, 'bienvenida')).toMatchObject({ idJugador: 'j3' })
  })

  it('la partida usa el modo de la sala (mazo de 15, sin especiales) y los clientes lo ven', () => {
    const { srv, host } = salaSin()
    const cs = unir(srv, 3)
    host.iniciarPartida()
    const interno = host as unknown as { estado: EstadoJuego }
    const todas = [...interno.estado.mazo, ...interno.estado.jugadores.flatMap((j) => j.cartas)]
    expect(interno.estado.especiales).toBe(false)
    expect(todas).toHaveLength(15)
    expect(todas.some((c) => c.especial)).toBe(false)
    const est = ultimo(cs[0], 'estado') as Extract<MensajeHost, { tipo: 'estado' }>
    expect(est.proyeccion.especiales).toBe(false)
    expect(host.snapshot().mesa?.especiales).toBe(false)
  })

  describe('cambiar el modo en la sala de espera', () => {
    it('avisa a todos, vacía los «listo» y cambia el aforo', () => {
      const { srv, host } = sala()
      const [a, b] = unir(srv, 3)
      a.enviar({ tipo: 'listo', listo: true })
      expect(host.snapshot().jugadores.filter((j) => j.listo)).toHaveLength(1)

      host.cambiarModo(false)
      expect(host.snapshot()).toMatchObject({ especiales: false, max: 6 })
      expect(host.snapshot().jugadores.some((j) => j.listo)).toBe(false)
      expect(sala_(a)).toMatchObject({ especiales: false, max: 6 })
      expect(sala_(b)).toMatchObject({ especiales: false, max: 6 })

      host.cambiarModo(true)
      expect(sala_(b)).toMatchObject({ especiales: true, max: 8 })
    })

    it('se rechaza si hay más jugadores de los que caben en el modo nuevo', () => {
      const { srv, host } = sala()
      unir(srv, 7)
      expect(() => host.cambiarModo(false)).toThrow(/7 jugadores/)
      expect(host.snapshot()).toMatchObject({ especiales: true, max: 8 })
      // Con 6 sí cabe.
      const { srv: srv6, host: host6 } = sala()
      unir(srv6, 6)
      expect(() => host6.cambiarModo(false)).not.toThrow()
    })

    it('no se puede con la partida en curso, pero sí tras volver al lobby', () => {
      const { srv, host } = sala()
      unir(srv, 2)
      host.iniciarPartida()
      expect(() => host.cambiarModo(false)).toThrow(/en curso/)

      const interno = host as unknown as { estado: EstadoJuego }
      interno.estado.fase = { tipo: 'fin', ganador: 'j1' } // fin de partida
      host.volverAlLobby()
      expect(() => host.cambiarModo(false)).not.toThrow()
      expect(host.snapshot().especiales).toBe(false)
    })

    it('«jugar de nuevo» conserva el modo', () => {
      const { srv, host } = salaSin()
      unir(srv, 2)
      host.iniciarPartida()
      const interno = host as unknown as { estado: EstadoJuego }
      interno.estado.fase = { tipo: 'fin', ganador: 'j1' }
      host.reiniciarPartida()
      expect(interno.estado.especiales).toBe(false)
      expect(interno.estado.mazo.length + interno.estado.jugadores.length * 2).toBe(15)
    })

    it('un cliente no puede cambiar el modo (solo el anfitrión, por su API local)', () => {
      const { srv, host } = sala()
      const [a] = unir(srv, 2)
      a.enviar({ tipo: 'cambiarModo', especiales: false })
      expect(ultimo(a, 'error')).toMatchObject({ codigo: 'mensajeInvalido' })
      expect(host.snapshot().especiales).toBe(true)
    })
  })

  describe('«estoy listo» (guía visual)', () => {
    it('se marca y se desmarca, y se anuncia a todos', () => {
      const { srv, host } = sala()
      const [a, b] = unir(srv, 2)
      a.enviar({ tipo: 'listo', listo: true })
      expect(host.snapshot().jugadores.map((j) => j.listo)).toEqual([true, false])
      expect(sala_(b).jugadores.map((j) => j.listo)).toEqual([true, false])
      a.enviar({ tipo: 'listo', listo: false })
      expect(host.snapshot().jugadores.map((j) => j.listo)).toEqual([false, false])
    })

    it('no condiciona el inicio: se puede iniciar sin que nadie esté listo', () => {
      const { srv, host } = sala()
      unir(srv, 2)
      expect(host.snapshot().puedeIniciar).toBe(true)
      expect(() => host.iniciarPartida()).not.toThrow()
    })

    it('un desconectado no aparece como listo', () => {
      const { srv, host } = sala()
      const [a] = unir(srv, 2)
      a.enviar({ tipo: 'listo', listo: true })
      a.cerrar()
      expect(host.snapshot().jugadores[0]).toMatchObject({ conectado: false, listo: false })
    })

    it('exige estar unido, estar en el lobby y un booleano', () => {
      const { srv, host } = sala()
      const intruso = srv.conectar()
      intruso.enviar({ tipo: 'listo', listo: true })
      expect(ultimo(intruso, 'error')).toMatchObject({ codigo: 'noUnido' })

      const [a] = unir(srv, 2)
      a.enviar({ tipo: 'listo', listo: 'sí' })
      expect(ultimo(a, 'error')).toMatchObject({ codigo: 'mensajeInvalido' })

      host.iniciarPartida()
      a.enviar({ tipo: 'listo', listo: true })
      expect(ultimo(a, 'error')).toMatchObject({ codigo: 'faseIncorrecta' })
    })

    it('al volver al lobby todos quedan sin marcar', () => {
      const { srv, host } = sala()
      const [a] = unir(srv, 2)
      a.enviar({ tipo: 'listo', listo: true })
      host.iniciarPartida()
      const interno = host as unknown as { estado: EstadoJuego }
      interno.estado.fase = { tipo: 'fin', ganador: 'j1' }
      host.volverAlLobby()
      expect(host.snapshot().jugadores.some((j) => j.listo)).toBe(false)
    })
  })

  describe('motivo por el que no se puede iniciar', () => {
    it('explica qué falta', () => {
      const { srv, host } = sala()
      expect(host.snapshot()).toMatchObject({ puedeIniciar: false, motivoBloqueo: 'Faltan 2 jugadores (mínimo 2).' })
      const [a] = unir(srv, 1)
      expect(host.snapshot().motivoBloqueo).toBe('Faltan 1 jugador (mínimo 2).')
      unirse(srv.conectar(), 'Otro', tokenDe('otro'))
      expect(host.snapshot()).toMatchObject({ puedeIniciar: true, motivoBloqueo: null })
      a.cerrar()
      expect(host.snapshot().motivoBloqueo).toMatch(/desconectados: Jugador1/)
      expect(host.snapshot().puedeIniciar).toBe(false)
    })
  })
})
