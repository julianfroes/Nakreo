import { useState } from 'react'
import { COPIAS_POR_ROL } from '../../game/config'
import { TODOS_LOS_ROLES } from '../../game/roles'
import type { Carta } from '../../game/types'
import { IconoRol } from '../iconos/IconoRol'
import { claveArte, IDS_POR_ROL, urlArte } from '../arteCartas'
import { uiCarta } from '../rolesUI'
import { Button } from './Button'
import { PanelSuperpuesto } from './PanelSuperpuesto'
import { Pestanas } from './Pestanas'

/** Las 20 cartas del mazo, con los mismos ids que reparte `crearPartida` (así cada una tiene su arte). */
const cartasDelMazo = (especial: boolean): Carta[] =>
  TODOS_LOS_ROLES.flatMap((rol, r) =>
    especial
      ? [{ id: r * IDS_POR_ROL + COPIAS_POR_ROL, rol, especial: true }]
      : Array.from({ length: COPIAS_POR_ROL }, (_, k) => ({ id: r * IDS_POR_ROL + k, rol })),
  )

/** Imagen de la carta, o su icono sobre el degradado del rol si aún no se ha subido el arte. */
function Arte({ carta, className = '' }: { carta: Carta; className?: string }) {
  const url = urlArte(claveArte(carta))
  const ui = uiCarta(carta.rol, carta.especial)
  return url ? (
    <img src={url} alt="" width={800} height={600} loading="lazy" decoding="async"
      className={`aspect-[4/3] w-full object-cover ${className}`} />
  ) : (
    <span className={`flex aspect-[4/3] w-full items-center justify-center bg-gradient-to-b ${ui.fondo} ${className}`}>
      <IconoRol rol={carta.rol} especial={carta.especial} tamano={56} decorativo />
    </span>
  )
}

function Lista({ especial, onElegir }: { especial: boolean; onElegir: (c: Carta) => void }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {cartasDelMazo(especial).map((c) => {
        const ui = uiCarta(c.rol, c.especial)
        return (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => onElegir(c)}
              className={`w-full overflow-hidden rounded-xl border-2 bg-slate-900 text-left focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cyan-300 ${ui.borde}`}
            >
              <Arte carta={c} />
              <span className="block px-2 py-1.5 text-sm font-semibold">
                {ui.nombre}
                {!c.especial && <span className="text-slate-400"> · {(c.id % IDS_POR_ROL) + 1}</span>}
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

/** Contenido de la galería: pestañas Normales / Especiales y vista ampliada al tocar una carta. */
export function ContenidoGaleria() {
  const [grande, setGrande] = useState<Carta | null>(null)

  if (grande) {
    const ui = uiCarta(grande.rol, grande.especial)
    return (
      <div className="space-y-3">
        <div className={`overflow-hidden rounded-2xl border-2 ${ui.borde}`}>
          <Arte carta={grande} />
        </div>
        <h3 className="text-xl font-bold">{ui.nombre}</h3>
        <p className="text-slate-300">{ui.descripcion}</p>
        <Button variant="secondary" onClick={() => setGrande(null)}>← Volver a la galería</Button>
      </div>
    )
  }

  return (
    <Pestanas
      nombre="Tipo de carta"
      pestanas={[
        { id: 'normales', etiqueta: 'Normales', contenido: <Lista especial={false} onElegir={setGrande} /> },
        { id: 'especiales', etiqueta: 'Especiales', contenido: <Lista especial onElegir={setGrande} /> },
      ]}
    />
  )
}

/** Galería como panel superpuesto (para abrirla desde la pantalla principal o la sala de espera). */
export function PanelGaleriaCartas({ abierto, onCerrar }: { abierto: boolean; onCerrar: () => void }) {
  return (
    <PanelSuperpuesto abierto={abierto} onCerrar={onCerrar} titulo="Cartas">
      <ContenidoGaleria />
    </PanelSuperpuesto>
  )
}
