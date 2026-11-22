import { useState, type ReactNode } from 'react'
import { Button } from '../../shared/components/Button'
import { useCliente } from '../store'

const caja = 'mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-4 p-6'

export function UnirseForm({ codigoInicial }: { codigoInicial: string }) {
  const { unirse, nombre: nombreGuardado, codigo: codigoGuardado, error, conexion } = useCliente()
  const [codigo, setCodigo] = useState(codigoGuardado ?? codigoInicial)
  const [nombre, setNombre] = useState(nombreGuardado)
  const ocupado = conexion === 'conectando'
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
        <p role="alert" className="rounded-xl border border-rose-700 bg-rose-950/60 px-4 py-3 text-center text-rose-200">
          {error}
        </p>
      )}
      <Button disabled={ocupado || !codigo.trim() || !nombre.trim()} onClick={() => void unirse(codigo, nombre.trim())}>
        {ocupado ? 'Conectando…' : 'Unirme'}
      </Button>
    </main>
  )
}

export function Lobby() {
  const { sala, codigo, idJugador, salir } = useCliente()
  return (
    <main className={caja}>
      <h1 className="text-center text-3xl font-bold">Sala {codigo}</h1>
      <p className="text-center text-slate-400">Esperando a que el anfitrión inicie la partida…</p>
      <ul className="space-y-2">
        {sala?.jugadores.map((j) => (
          <li
            key={j.id}
            className="flex items-center justify-between rounded-xl border border-slate-700 px-4 py-3"
          >
            <span className="font-semibold">
              {j.nombre} {j.id === idJugador && <span className="text-cyan-400">(tú)</span>}
            </span>
            <span className={j.conectado ? 'text-emerald-400' : 'text-slate-500'}>
              {j.conectado ? '● conectado' : '○ desconectado'}
            </span>
          </li>
        ))}
      </ul>
      <Button variant="secondary" onClick={salir}>Salir</Button>
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
  const salir = useCliente((s) => s.salir)
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
          <Button variant="secondary" onClick={salir}>Salir</Button>
        </>
      )}
    </main>
  )
}
