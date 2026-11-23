import { ROLES } from '../../game/roles'
import type { Rol } from '../../game/types'

/**
 * Iconos de los roles: un set ORIGINAL (dibujado para Nakreo, sin licencias ni
 * atribuciones) con el mismo trazo y peso visual. Cuadrícula de 24 × 24, trazo de
 * 1,75 con extremos y uniones redondeados, y un relleno tenue del mismo color para
 * dar cuerpo. Se leen bien desde 24 px hasta 64 px o más.
 *
 *   CEO → maletín · RH → papeles · Sindicalizado → escudo
 *   Jefe de Área → chaleco · Ingeniero → engranaje
 */

/** Color de cada rol sobre fondo oscuro (tonos 300: contraste holgado frente al fondo de las cartas). */
const COLOR: Record<Rol, string> = {
  rh: 'text-amber-300',
  ceo: 'text-rose-300',
  jefeArea: 'text-emerald-300',
  ingeniero: 'text-sky-300',
  sindicalizado: 'text-violet-300',
}

/** Perfil de un engranaje de 8 dientes, calculado (así no depende de ningún icono ajeno). */
function perfilEngranaje(dientes = 8, rExt = 9.4, rInt = 7.4): string {
  const paso = (2 * Math.PI) / dientes
  const base = paso * 0.2 // semiancho angular del diente en su base
  const punta = paso * 0.115 // y en su cresta
  const punto = (ang: number, r: number) =>
    `${(12 + r * Math.sin(ang)).toFixed(2)} ${(12 - r * Math.cos(ang)).toFixed(2)}`
  const partes: string[] = []
  for (let i = 0; i < dientes; i++) {
    const a = paso * i
    partes.push(
      `${i === 0 ? 'M' : 'A'}${i === 0 ? '' : `${rInt} ${rInt} 0 0 1 `}${punto(a - base, rInt)}`,
      `L${punto(a - punta, rExt)}`,
      `L${punto(a + punta, rExt)}`,
      `L${punto(a + base, rInt)}`,
    )
  }
  // Cierra con el arco del último valle hasta el primer diente.
  partes.push(`A${rInt} ${rInt} 0 0 1 ${punto(-base, rInt)}Z`)
  return partes.join('')
}

const ENGRANAJE = perfilEngranaje()

/** Cada icono: el cuerpo con relleno tenue y los detalles solo con trazo. */
function Dibujo({ rol }: { rol: Rol }) {
  const cuerpo = { fill: 'currentColor', fillOpacity: 0.16 } as const
  switch (rol) {
    case 'ceo': // maletín
      return (
        <>
          <path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7" />
          <rect x="3" y="7" width="18" height="13" rx="2.5" {...cuerpo} />
          <path d="M3 13h18" />
          <rect x="10.4" y="11.6" width="3.2" height="3.2" rx=".7" fill="currentColor" />
        </>
      )
    case 'rh': // papeles
      return (
        <>
          <path d="M5 17.5V4.5A1.5 1.5 0 0 1 6.5 3H12" />
          <path d="M8.5 6.5H14l4.5 4.5v8.5a1.5 1.5 0 0 1-1.5 1.5H8.5A1.5 1.5 0 0 1 7 19.5v-11.5a1.5 1.5 0 0 1 1.5-1.5z" {...cuerpo} />
          <path d="M14 6.5V11h4.5" />
          <path d="M9.5 14.5h6M9.5 17.5h4" />
        </>
      )
    case 'sindicalizado': // escudo
      return (
        <>
          <path d="M12 3l7.5 3v5.5c0 4.6-3.1 8.1-7.5 9.5-4.4-1.4-7.5-4.9-7.5-9.5V6L12 3z" {...cuerpo} />
          <path d="M8.6 12l2.4 2.4 4.4-4.8" />
        </>
      )
    case 'jefeArea': // chaleco
      return (
        <>
          <path d="M8 3.5L12 9.5l4-6 3.5 3V20.5h-15V6.5L8 3.5z" {...cuerpo} />
          <path d="M12 9.5v11" />
          <circle cx="14.6" cy="13" r=".75" fill="currentColor" />
          <circle cx="14.6" cy="16.6" r=".75" fill="currentColor" />
          <path d="M6.6 16.5h3" />
        </>
      )
    case 'ingeniero': // engranaje
      return (
        <>
          <path d={ENGRANAJE} {...cuerpo} />
          <circle cx="12" cy="12" r="2.9" />
        </>
      )
  }
}

interface Props {
  rol: Rol
  /** Carta especial: añade la insignia dorada. */
  especial?: boolean
  /** Lado en px (por defecto 32), o «auto» para llenar el contenedor (que fija su tamaño). */
  tamano?: number | 'auto'
  /**
   * true cuando el nombre del rol ya está escrito al lado: así los lectores de
   * pantalla no lo leen dos veces. Si es false, el icono se anuncia como imagen con el nombre del rol.
   */
  decorativo?: boolean
  className?: string
}

/** Icono de un rol. Mínimo recomendado 24 px; ideal entre 32 y 48 px (64 px en las cartas). */
export function IconoRol({
  rol,
  especial = false,
  tamano = 32,
  decorativo = false,
  className = '',
}: Props) {
  const nombre = especial ? `${ROLES[rol].nombre} Especial` : ROLES[rol].nombre
  const lado = tamano === 'auto' ? undefined : tamano
  return (
    <svg
      viewBox="0 0 24 24"
      width={lado}
      height={lado}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
      role={decorativo ? undefined : 'img'}
      aria-label={decorativo ? undefined : nombre}
      aria-hidden={decorativo ? true : undefined}
      className={`${tamano === 'auto' ? 'size-full' : 'shrink-0 overflow-visible'} ${COLOR[rol]} ${className}`}
    >
      <Dibujo rol={rol} />
      {especial && (
        // Insignia de carta especial: estrella dorada grande, con contorno oscuro para que
        // se distinga aunque se superponga al dibujo del rol.
        <path
          className="text-yellow-300"
          d="M18.5 0l1.7 3.8 3.8 1.7-3.8 1.7-1.7 3.8-1.7-3.8-3.8-1.7 3.8-1.7z"
          fill="currentColor"
          stroke="#020617"
          strokeWidth={1.6}
          paintOrder="stroke"
        />
      )}
    </svg>
  )
}

/** Icono y nombre del rol (o «Rol Especial») en línea, para botones y frases. */
export function EtiquetaRol({
  rol,
  especial = false,
  tamano = 20,
}: {
  rol: Rol
  especial?: boolean
  tamano?: number
}) {
  const nombre = especial ? `${ROLES[rol].nombre} Especial` : ROLES[rol].nombre
  return (
    <span className="inline-flex items-center gap-1.5 align-middle">
      <IconoRol rol={rol} especial={especial} tamano={tamano} decorativo />
      <span>{nombre}</span>
    </span>
  )
}
