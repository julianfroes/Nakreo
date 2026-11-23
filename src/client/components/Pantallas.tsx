import { useState, type ReactNode } from 'react'
import { normalizarCodigo } from '../../shared/codigoSala'
import { Button } from '../../shared/components/Button'
import { Aforo, EstadoJugadorSala } from '../../shared/components/EstadoJugadorSala'
import { PanelReglas } from '../../shared/components/PanelReglas'
import { nombreModo } from '../../shared/reglasContenido'
import { navigate } from '../../shared/useHashRoute'
import { useCliente } from '../store'

const caja = 'mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-4 p-6 md:max-w-md'

export function UnirseForm({ codigoInicial }: { codigoInicial: string }) {
  const {
    unirse, nombre: nombreGuardado, codigo: codigoGuardado, error, conexion, rechazo, limpiarRechazo, salir,
  } = useCliente()
  const [codigo, setCodigo] = useState(codigoGuardado ?? codigoInicial)
  const [nombre, setNombre] = useState(nombreGuardado)
  const ocupado = conexion === 'conectando'
  // Sala llena o ya iniciada: «Unirme» queda bloqueado para ese código hasta pedir reintentar.
  const bloqueado = !!rechazo && rechazo.codigo === normalizarCodigo(codigo)
  const campo = 'w-full rounded-xl border border-slate-600 bg-slate-900 px-4 py-3 text-lg'

  return (
    <main className={caja}>
      <h1 className="text-center text-3xl font-bold">Unirse a sala</h1>
      <input
        className={`${campo} text-center font-mono text-2xl uppercase tracking-widest`}
        placeholder="CÓDIGO"
        value={codigo}
        maxLength={5}
        autoCapitalize="characters"
        autoComplete="off"
        onChange={(e) => setCodigo(e.target.value)}
      />
      <input
        className={campo}
        placeholder="Tu nombre"
        value={nombre}
        maxLength={20}
        autoComplete="nickname"
        onChange={(e) => setNombre(e.target.value)}
      />
      {error && (
        <div role="alert" className="rounded-xl border border-rose-700 bg-rose-950/60 px-4 py-3 text-center text-rose-200">
          <p>{error}</p>
          {bloqueado && (
            <button
              type="button"
              onClick={limpiarRechazo}
              className="mt-2 rounded px-2 py-1 underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cyan-300"
            >
              Volver a intentar
            </button>
          )}
        </div>
      )}
      <Button
        disabled={ocupado || bloqueado || !codigo.trim() || !nombre.trim()}
        onClick={() => void unirse(codigo, nombre.trim())}
      >
        {ocupado ? 'Conectando…' : 'Unirme'}
      </Button>
      <Button
        variant="secondary"
        onClick={() => {
          salir()
          navigate('/')
        }}
      >
        ← Volver al inicio
      </Button>
    </main>
  )
}

export function Lobby() {
  const { sala, codigo, idJugador, abandonar, saliendo, marcarListo } = useCliente()
  const yo = sala?.jugadores.find((j) => j.id === idJugador)
  const [reglas, setReglas] = useState(false)
  return (
    <main className={caja}>
      <h1 className="text-center text-3xl font-bold">Sala {codigo}</h1>
      <p className="text-center text-slate-400">Esperando a que el anfitrión inicie la partida…</p>
      {sala && (
        <p className="text-center text-sm text-slate-300">
          {nombreModo(sala.especiales)} · Jugadores <Aforo actual={sala.jugadores.length} max={sala.max} />
        </p>
      )}
      <ul className="space-y-2">
        {sala?.jugadores.map((j) => (
          <li
            key={j.id}
            className="flex items-center justify-between rounded-xl border border-slate-700 px-4 py-3"
          >
            <span className="font-semibold">
              {j.nombre} {j.id === idJugador && <span className="text-cyan-400">(tú)</span>}
            </span>
            <EstadoJugadorSala j={j} />
          </li>
        ))}
      </ul>
      {yo && (
        <Button
          variant={yo.listo ? 'secondary' : 'primary'}
          aria-pressed={yo.listo}
          onClick={() => marcarListo(!yo.listo)}
        >
          {yo.listo ? 'Ya no estoy listo' : 'Estoy listo'}
        </Button>
      )}
      <Button variant="secondary" onClick={() => setReglas(true)}>
        <span aria-hidden>📖</span> Reglas
      </Button>
      <PanelReglas abierto={reglas} onCerrar={() => setReglas(false)} modo="reglas" especiales={sala?.especiales ?? true} />
      <Button variant="secondary" disabled={saliendo} onClick={abandonar}>
        {saliendo ? 'Saliendo…' : 'Salir'}
      </Button>
    </main>
  )
}

export function PantallaFinal({
  ganador,
  gane,
  controles,
}: {
  ganador: string
  gane: boolean
  /** Si se indica (anfitrión que juega), sustituye al texto de espera y al botón Salir. */
  controles?: ReactNode
}) {
  const abandonar = useCliente((s) => s.abandonar)
  return (
    <main className={caja}>
      <p className="text-center text-7xl">{gane ? '🏆' : '🏁'}</p>
      <h1 className="text-center text-3xl font-bold">{gane ? '¡Has ganado!' : 'Partida terminada'}</h1>
      {!gane && <p className="text-center text-slate-300">Ganador: {ganador}</p>}
      {controles ?? (
        <>
          <p className="text-center text-sm text-slate-500">
            Si el anfitrión inicia otra partida, aparecerá aquí automáticamente.
          </p>
          <Button variant="secondary" onClick={abandonar}>Salir</Button>
        </>
      )}
    </main>
  )
}

/** Despedida de quien abandonó la partida: ya no puede volver a entrar en ella. */
export function PantallaRetirado() {
  const salir = useCliente((s) => s.salir)
  return (
    <main className={caja}>
      <p className="text-center text-7xl" aria-hidden>
        🚪
      </p>
      <h1 className="text-center text-3xl font-bold">Abandonaste la partida</h1>
      <p className="text-center text-slate-300">
        Perdiste tus vidas y no puedes volver a entrar en esta partida. Tus cartas quedaron en el descarte.
      </p>
      <Button
        onClick={() => {
          salir()
          navigate('/')
        }}
      >
        Volver al inicio
      </Button>
    </main>
  )
}
