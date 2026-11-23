import { ROLES } from '../game/roles'
import type { Rol } from '../game/types'
import { FICHAS_ROLES } from './reglasContenido'

/**
 * Presentación de cada rol: nombre, texto de la carta y colores. El icono vive en
 * `iconos/IconoRol` (un set de SVG propio, con un color por rol).
 */
export interface RolUI {
  nombre: string
  descripcion: string
  /** Clases Tailwind completas (deben aparecer literales para que se generen). */
  borde: string
  fondo: string
}

const base: Record<Rol, Pick<RolUI, 'borde' | 'fondo'>> = {
  rh: {
    borde: 'border-amber-400',
    fondo: 'from-amber-900/60 to-slate-900',
  },
  ceo: {
    borde: 'border-rose-400',
    fondo: 'from-rose-900/60 to-slate-900',
  },
  jefeArea: {
    borde: 'border-emerald-400',
    fondo: 'from-emerald-900/60 to-slate-900',
  },
  ingeniero: {
    borde: 'border-sky-400',
    fondo: 'from-sky-900/60 to-slate-900',
  },
  sindicalizado: {
    borde: 'border-violet-400',
    fondo: 'from-violet-900/60 to-slate-900',
  },
}

export const ROL_UI: Record<Rol, RolUI> = Object.fromEntries(
  (Object.keys(ROLES) as Rol[]).map((r) => [
    r,
    { nombre: ROLES[r].nombre, descripcion: FICHAS_ROLES[r].resumen, ...base[r] },
  ]),
) as Record<Rol, RolUI>

/** Presentación de una carta concreta: la especial se distingue por nombre y por el dorado. */
export function uiCarta(rol: Rol, especial = false): RolUI {
  const normal = ROL_UI[rol]
  if (!especial) return normal
  return {
    nombre: `${normal.nombre} Especial`,
    descripcion: FICHAS_ROLES[rol].especial.descripcion,
    borde: 'border-yellow-300',
    fondo: 'from-yellow-700/60 to-slate-900',
  }
}
