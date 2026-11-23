import { useState } from 'react'
import { describirModo, nombreModo } from '../reglasContenido'
import { FichasRoles, SeccionesReglas, TarjetasAcciones } from './ContenidoReglas'
import { PanelSuperpuesto } from './PanelSuperpuesto'
import { Pestanas } from './Pestanas'

interface Props {
  abierto: boolean
  onCerrar: () => void
  /**
   * «guia»: resumen de acciones y roles (en partida).
   * «reglas»: el reglamento completo, además de las acciones y los roles.
   */
  modo: 'guia' | 'reglas'
  /**
   * Modo de juego de la sala. Si no se indica (pantalla principal, sin sala) se
   * ofrece elegir con qué modo se quieren leer las reglas.
   */
  especiales?: boolean
  /** Pestaña inicial (solo para revisión visual). */
  pestana?: 'reglas' | 'acciones' | 'roles'
}

/** Reglas o Guía rápida en un panel superpuesto, con el contenido compartido. */
export function PanelReglas({ abierto, onCerrar, modo, especiales, pestana }: Props) {
  const [elegido, setElegido] = useState(true)
  const esp = especiales ?? elegido

  const pestanas = [
    ...(modo === 'reglas'
      ? [{ id: 'reglas', etiqueta: 'Reglas', contenido: <SeccionesReglas especiales={esp} /> }]
      : []),
    { id: 'acciones', etiqueta: 'Acciones', contenido: <TarjetasAcciones especiales={esp} /> },
    { id: 'roles', etiqueta: 'Roles', contenido: <FichasRoles especiales={esp} /> },
  ]

  return (
    <PanelSuperpuesto abierto={abierto} onCerrar={onCerrar} titulo={modo === 'guia' ? 'Guía rápida' : 'Reglas'}>
      {especiales === undefined ? (
        <div role="group" aria-label="Modo de juego" className="mb-3 grid grid-cols-2 gap-1 rounded-xl bg-slate-800 p-1">
          {[true, false].map((valor) => (
            <button
              key={String(valor)}
              type="button"
              aria-pressed={esp === valor}
              onClick={() => setElegido(valor)}
              className={`min-h-11 rounded-lg px-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cyan-300 ${
                esp === valor ? 'bg-slate-100 text-slate-950' : 'text-slate-200 hover:bg-slate-700'
              }`}
            >
              {nombreModo(valor)}
            </button>
          ))}
        </div>
      ) : (
        <p className="mb-3 font-semibold text-cyan-300">Modo de esta sala: {nombreModo(esp)}</p>
      )}
      <p className="mb-4 text-sm text-slate-300">{describirModo(esp)}</p>
      <Pestanas
        nombre={modo === 'guia' ? 'Guía rápida' : 'Reglas'}
        pestanas={pestanas}
        inicial={pestana && pestanas.some((p) => p.id === pestana) ? pestana : undefined}
      />
    </PanelSuperpuesto>
  )
}
