import { COPIAS_ESPECIALES_POR_ROL, COPIAS_POR_ROL } from '../game/config'
import type { Carta, Rol } from '../game/types'

/**
 * Arte de las cartas: cada carta física del mazo tiene su propia imagen
 * (`src/assets/cartas/<rol>-1|2|3|especial.webp`). Vite las empaqueta con hash en el
 * nombre (caché seguro) y respeta la ruta base de GitHub Pages. Si falta una imagen,
 * `urlArte` devuelve undefined y la interfaz usa el icono del rol.
 *
 * Privacidad: la clave del arte sale del `id` de la carta, pero solo se calcula para
 * cartas cuyo rol el jugador ya conoce (las suyas y las reveladas), así que no revela nada.
 */
const imagenes = import.meta.glob<string>('../assets/cartas/*.webp', {
  eager: true,
  import: 'default',
  query: '?url',
})

const urls = new Map(
  Object.entries(imagenes).map(([ruta, url]) => [ruta.split('/').pop()!.replace('.webp', ''), url]),
)

/** Ids por rol: en `crearPartida` cada rol ocupa un tramo de este tamaño (normales y luego especial). */
export const IDS_POR_ROL = COPIAS_POR_ROL + COPIAS_ESPECIALES_POR_ROL

/** Clave del arte de una carta concreta: «ceo-2», «rh-especial»… */
export const claveArte = (c: Pick<Carta, 'id' | 'rol' | 'especial'>): string =>
  c.especial ? `${c.rol}-especial` : `${c.rol}-${(c.id % IDS_POR_ROL) + 1}`

/** Clave por rol, copia (1..COPIAS_POR_ROL) o especial; para la galería. */
export const claveArteRol = (rol: Rol, copia: number | 'especial'): string => `${rol}-${copia}`

/** URL de la imagen, o undefined si todavía no se ha subido. */
export const urlArte = (clave: string): string | undefined => urls.get(clave)
