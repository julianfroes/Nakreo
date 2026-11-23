import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { useCliente } from '../../client/store'
import { Button } from '../../shared/components/Button'
import { MAX_NOMBRE } from '../../shared/protocolo'
import type { SnapshotHost } from '../HostServidor'
import { obtenerHost } from '../hostStore'
import { guardarNombre, leerNombre } from '../preferencias'

/**
 * «Unirme a esta sala como jugador»: el anfitrión de una mesa ocupa un asiento
 * antes de iniciar. Entra por la conexión local en memoria, así que el host
 * valida aforo, partida en curso y un único asiento. El botón es solo comodidad.
 */
export function UnirmeComoJugador({ s }: { s: SnapshotHost }) {
  const [abierto, setAbierto] = useState(false)
  const [nombre, setNombre] = useState(leerNombre)
  const entrada = useRef<HTMLInputElement>(null)
  const id = useId()
  const unirseLocal = useCliente((c) => c.unirseLocal)
  const limpiarError = useCliente((c) => c.limpiarError)
  const error = useCliente((c) => c.error)
  const conectando = useCliente((c) => c.conexion === 'conectando')

  useEffect(() => {
    if (abierto) entrada.current?.focus()
  }, [abierto])

  const motivo = s.iniciada
    ? 'La partida ya comenzó.'
    : s.jugadores.length >= s.max
      ? `Sala llena (${s.max}/${s.max}).`
      : null

  if (!abierto) {
    return (
      <div className="space-y-1">
        <Button
          variant="secondary"
          disabled={motivo !== null}
          onClick={() => {
            limpiarError()
            setAbierto(true)
          }}
        >
          Unirme a esta sala como jugador
        </Button>
        {motivo && <p className="text-center text-sm text-slate-400">{motivo}</p>}
      </div>
    )
  }

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    const host = obtenerHost()
    const limpio = nombre.trim()
    if (!host || !limpio) return
    guardarNombre(limpio)
    await unirseLocal(host, limpio)
  }

  return (
    <form
      onSubmit={enviar}
      aria-labelledby={`${id}-titulo`}
      className="space-y-3 rounded-2xl border border-slate-700 bg-slate-900 p-4"
    >
      <h3 id={`${id}-titulo`} className="text-lg font-semibold">
        Unirme como jugador
      </h3>
      <p id={`${id}-aviso`} className="text-sm text-slate-300">
        Esta pantalla pasará a mostrar solo tus cartas privadas y dejará de mostrar la mesa general. Seguirás
        administrando la sala, y podrás dejar tu asiento antes de iniciar.
      </p>
      <input
        ref={entrada}
        className="w-full rounded-xl border border-slate-600 bg-slate-950 px-4 py-3 text-lg focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cyan-300"
        placeholder="Tu nombre"
        aria-label="Tu nombre"
        aria-describedby={`${id}-aviso`}
        value={nombre}
        maxLength={MAX_NOMBRE}
        autoComplete="nickname"
        onChange={(e) => setNombre(e.target.value)}
      />
      {error && (
        <p role="alert" className="text-sm text-rose-300">
          {error}
        </p>
      )}
      <Button type="submit" disabled={!nombre.trim() || conectando || motivo !== null}>
        {conectando ? 'Uniéndome…' : 'Unirme'}
      </Button>
      <Button type="button" variant="secondary" onClick={() => setAbierto(false)}>
        Cancelar
      </Button>
    </form>
  )
}
