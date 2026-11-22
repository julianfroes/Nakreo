import { useState } from 'react'
import type { JugadorPublico } from '../../game/proyeccion'
import type { TipoAccion } from '../../game/types'
import { Button } from '../../shared/components/Button'
import { ROL_UI } from '../../shared/rolesUI'
import type { AccionUI } from '../vista'

interface Props {
  acciones: AccionUI[]
  objetivos: JugadorPublico[]
  pendiente: boolean
  onElegir: (accion: TipoAccion, objetivo?: string) => void
}

/** Mis acciones del turno. Las que requieren objetivo abren un selector de jugadores. */
export function PanelAcciones({ acciones, objetivos, pendiente, onElegir }: Props) {
  const [elegida, setElegida] = useState<AccionUI | null>(null)

  if (elegida) {
    return (
      <div className="space-y-2 animate-entrada">
        <p className="text-center font-semibold">{elegida.nombre}: ¿contra quién?</p>
        {objetivos.map((o) => (
          <Button
            key={o.id}
            variant="secondary"
            disabled={pendiente}
            onClick={() => onElegir(elegida.tipo, o.id)}
          >
            {o.nombre} <span className="text-sm text-slate-400">◈{o.creditos} 🂠{o.cartasVivas}</span>
          </Button>
        ))}
        <Button variant="secondary" onClick={() => setElegida(null)}>Cancelar</Button>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {acciones.map((a) => {
        const rol = a.rolRequerido ? ROL_UI[a.rolRequerido] : null
        return (
          <div key={a.tipo}>
            <Button
              variant={a.rolRequerido ? 'primary' : 'secondary'}
              disabled={!a.habilitada || pendiente}
              onClick={() => (a.necesitaObjetivo ? setElegida(a) : onElegir(a.tipo))}
            >
              {rol && <span className="mr-2">{rol.icono}</span>}
              {a.nombre}
              {a.coste > 0 && <span className="ml-2 text-sm opacity-80">(◈{a.coste})</span>}
            </Button>
            {a.motivo && <p className="mt-0.5 text-center text-xs text-slate-500">{a.motivo}</p>}
            {rol && a.habilitada && (
              <p className="mt-0.5 text-center text-xs text-slate-500">
                Requiere {rol.nombre} (puedes farolear)
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}
