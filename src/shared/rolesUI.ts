import { ROLES } from '../game/roles'
import type { Rol } from '../game/types'

/** Presentación de cada rol. Los iconos son provisionales (emoji) y viven solo aquí. */
export interface RolUI {
  nombre: string
  icono: string
  descripcion: string
  /** Clases Tailwind completas (deben aparecer literales para que se generen). */
  borde: string
  fondo: string
}

const base: Record<Rol, Omit<RolUI, 'nombre'>> = {
  directorFinanciero: {
    icono: '💼',
    descripcion: 'Cobra 3 créditos (Dividendos). Bloquea el Subsidio.',
    borde: 'border-amber-400',
    fondo: 'from-amber-900/60 to-slate-900',
  },
  saboteador: {
    icono: '🧨',
    descripcion: 'Paga 3 para eliminar un cargo a otro jugador (Sabotaje).',
    borde: 'border-rose-400',
    fondo: 'from-rose-900/60 to-slate-900',
  },
  contrabandista: {
    icono: '📦',
    descripcion: 'Roba 2 créditos a otro jugador (Desvío). Bloquea el Desvío.',
    borde: 'border-emerald-400',
    fondo: 'from-emerald-900/60 to-slate-900',
  },
  ingeniero: {
    icono: '⚙️',
    descripcion: 'Cambia tus cartas con el mazo (Reasignación). Bloquea el Desvío.',
    borde: 'border-sky-400',
    fondo: 'from-sky-900/60 to-slate-900',
  },
  jefeSeguridad: {
    icono: '🛡️',
    descripcion: 'Bloquea el Sabotaje dirigido contra ti.',
    borde: 'border-violet-400',
    fondo: 'from-violet-900/60 to-slate-900',
  },
}

export const ROL_UI: Record<Rol, RolUI> = Object.fromEntries(
  (Object.keys(ROLES) as Rol[]).map((r) => [r, { nombre: ROLES[r].nombre, ...base[r] }]),
) as Record<Rol, RolUI>
