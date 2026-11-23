/**
 * Contenido de las reglas, compartido por las cartas, la pantalla de Reglas y
 * la Guía rápida (no se duplica texto entre ellas).
 *
 * Las acciones se LEEN de `ACCIONES` (el motor) y las cifras de `config.ts`:
 * costes, rol requerido y quién bloquea no pueden desincronizarse del juego.
 * Aquí solo se redactan los textos de efecto, las fichas de rol y las reglas
 * generales. Hay un test que comprueba que la tabla del README coincide.
 */
import {
  CARTAS_POR_JUGADOR,
  CARTAS_REASIGNACION,
  COPIAS_ESPECIALES_POR_ROL,
  COPIAS_POR_ROL,
  CREDITOS_INICIALES,
  EXPLOSION_COSTE,
  GANANCIA_MALVERSACION,
  GANANCIA_NOMINA,
  GANANCIA_ROBO_AGUINALDO,
  GANANCIA_SUELDO_MINIMO,
  LIMITE_CREDITOS,
  MIN_JUGADORES,
  PENALIZACION_ESPECIAL,
  ROBO_MERITO,
  maxJugadores,
} from '../game/config'
import {
  ACCIONES,
  HABILIDADES_ESPECIALES,
  ROLES,
  TODOS_LOS_ROLES,
  accionDisponible,
  bloqueosVigentes,
  nombreReclamo,
} from '../game/roles'
import type { Rol, TipoAccion } from '../game/types'

const creditos = (n: number) => `${n} ${n === 1 ? 'crédito' : 'créditos'}`

// ------------------------------------------------------------------- Acciones

const EFECTOS: Record<TipoAccion, string> = {
  sueldoMinimo: `+${creditos(GANANCIA_SUELDO_MINIMO)}`,
  nomina: `+${creditos(GANANCIA_NOMINA)}`,
  demandaLaboral: 'Un rival pierde una carta',
  malversacion: `+${creditos(GANANCIA_MALVERSACION)}`,
  roboAguinaldo: `+${creditos(GANANCIA_ROBO_AGUINALDO)}`,
  despido: 'Un rival pierde una carta',
  renuncia: 'Un rival pierde una carta',
  roboMerito: `Roba hasta ${creditos(ROBO_MERITO)} a un rival`,
  reasignacion: `Roba ${CARTAS_REASIGNACION} cartas del mazo, conserva las que quiera y devuelve el resto`,
}

export interface FilaAccion {
  tipo: TipoAccion
  titulo: string
  coste: number
  efecto: string
  /** Carta que hay que tener (o aparentar), o null si cualquiera puede hacerla. */
  requiere: string | null
  /** Quién puede bloquearla y cómo, o null si no se puede bloquear. */
  bloqueablePor: string | null
}

/**
 * Quién puede bloquear y con qué rol, leído de las reglas del motor:
 * «Quien la recibe, con Sindicalizado», «Cualquier otro jugador, con RH»…
 */
function textoBloqueo(tipo: TipoAccion, especiales: boolean): string | null {
  const d = ACCIONES[tipo]
  const bloqueos = bloqueosVigentes(tipo, especiales)
  if (bloqueos.length === 0) return null
  const roles = bloqueos
    .map((r) => {
      if (!r.especial) return nombreReclamo(r)
      const h = HABILIDADES_ESPECIALES[r.rol]
      return `${nombreReclamo(r)} (${h.nombre}${h.unSoloUso ? ', un solo uso' : ''})`
    })
    .join(' o ')
  return `${d.soloObjetivoBloquea ? 'Quien la recibe' : 'Cualquier otro jugador'}, con ${roles}`
}

/** Las acciones de este modo, en el orden de las reglas (sin especiales no hay acciones especiales). */
export function tablaAcciones(especiales = true): FilaAccion[] {
  return (Object.keys(ACCIONES) as TipoAccion[])
    .filter((tipo) => accionDisponible(tipo, especiales))
    .map((tipo) => {
      const d = ACCIONES[tipo]
      return {
        tipo,
        titulo: d.titulo,
        coste: d.coste,
        efecto: EFECTOS[tipo],
        requiere: d.rolRequerido ? nombreReclamo({ rol: d.rolRequerido, especial: d.especial }) : null,
        bloqueablePor: textoBloqueo(tipo, especiales),
      }
    })
}

/** La fila de una acción tal como aparece en la tabla de reglas (README y pantallas). */
export const filaMarkdown = (f: FilaAccion): string =>
  `| ${f.titulo} | ${f.coste > 0 ? f.coste : '–'} | ${f.efecto} | ${f.requiere ?? '–'} | ${f.bloqueablePor ?? 'No se puede bloquear'} |`

// ---------------------------------------------------------------------- Roles

export interface FichaRol {
  rol: Rol
  nombre: string
  /** Qué hace la carta normal (texto corto para la carta). */
  resumen: string
  especial: {
    nombre: string
    unSoloUso: boolean
    /** Qué hace la carta especial (texto corto para la carta). */
    descripcion: string
  }
}

const especial = (rol: Rol, detalle: string): FichaRol['especial'] => {
  const h = HABILIDADES_ESPECIALES[rol]
  return {
    nombre: h.nombre,
    unSoloUso: h.unSoloUso,
    descripcion: `${h.nombre}${h.unSoloUso ? ' (un solo uso)' : ''}: ${detalle}`,
  }
}

const DETALLES: Record<Rol, { resumen: string; especial: string }> = {
  rh: {
    resumen: `Malversación: cobra ${GANANCIA_MALVERSACION} créditos. Bloquea la Nómina.`,
    especial: `cobra ${GANANCIA_ROBO_AGUINALDO} créditos en lugar de ${GANANCIA_MALVERSACION}.`,
  },
  ceo: {
    resumen: 'Paga 3 para despedir a otro jugador (le quita un cargo).',
    especial: 'despide incluso a los Sindicalizados (salvo al Especial).',
  },
  jefeArea: {
    resumen: `Robo de mérito: roba ${ROBO_MERITO} créditos a otro jugador. Bloquea el Robo de mérito.`,
    especial: 'te salva de un farol sin mostrar carta.',
  },
  ingeniero: {
    resumen: 'Cambia tus cartas con el mazo (Reasignación). Bloquea el Robo de mérito.',
    especial: `al recibir una Demanda laboral, un Despido o una Renuncia «voluntaria», paga ${EXPLOSION_COSTE} (o 1 si es todo lo que tienes) y quita una vida al atacante. Puedes hacerlo en lugar de bloquear, o después si tu bloqueo cae.`,
  },
  sindicalizado: {
    resumen: 'Bloquea el Despido dirigido contra ti.',
    especial: 'cubre una Demanda laboral. Frena también la Renuncia «voluntaria».',
  },
}

/** Los roles tal como se muestran en el modo: sin roles especiales no hay carta especial. */
export interface RolVisible {
  rol: Rol
  nombre: string
  resumen: string
  /** Habilidad de la carta especial; null en el modo sin roles especiales. */
  especial: FichaRol['especial'] | null
}

export function rolesVisibles(especiales: boolean): RolVisible[] {
  return TODOS_LOS_ROLES.map((rol) => ({
    rol,
    nombre: FICHAS_ROLES[rol].nombre,
    resumen: FICHAS_ROLES[rol].resumen,
    especial: especiales ? FICHAS_ROLES[rol].especial : null,
  }))
}

export const FICHAS_ROLES: Record<Rol, FichaRol> = Object.fromEntries(
  TODOS_LOS_ROLES.map((rol) => [
    rol,
    {
      rol,
      nombre: ROLES[rol].nombre,
      resumen: DETALLES[rol].resumen,
      especial: especial(rol, DETALLES[rol].especial),
    } satisfies FichaRol,
  ]),
) as Record<Rol, FichaRol>

// ------------------------------------------------------------ Reglas generales

export interface SeccionReglas {
  id: string
  titulo: string
  puntos: string[]
}

/** Cartas del mazo según el modo: 3 copias por rol, más 1 especial por rol si hay especiales. */
export const cartasEnMazo = (especiales: boolean): number =>
  TODOS_LOS_ROLES.length * (COPIAS_POR_ROL + (especiales ? COPIAS_ESPECIALES_POR_ROL : 0))

export const nombreModo = (especiales: boolean): string =>
  especiales ? 'Con roles especiales' : 'Sin roles especiales'

/** «Hasta 8 jugadores · mazo de 20 cartas · con cartas y habilidades especiales». */
export const describirModo = (especiales: boolean): string =>
  `Hasta ${maxJugadores(especiales)} jugadores · mazo de ${cartasEnMazo(especiales)} cartas · ` +
  (especiales ? 'con cartas y habilidades especiales' : 'sin cartas ni habilidades especiales')

/** Las reglas generales. Sin roles especiales no hay cartas especiales, riesgo doble ni usos únicos. */
export function seccionesReglas(especiales = true): SeccionReglas[] {
  const secciones: SeccionReglas[] = [
    {
      id: 'objetivo',
      titulo: 'Objetivo',
      puntos: ['Gana el último jugador con alguna carta de rol en pie.'],
    },
    {
      id: 'inicio',
      titulo: 'Inicio',
      puntos: [
        `Cada jugador empieza con ${CARTAS_POR_JUGADOR} cartas de rol ocultas (sus cargos) y ${CREDITOS_INICIALES} créditos (◈).`,
        especiales
          ? `El mazo tiene ${cartasEnMazo(true)} cartas: ${COPIAS_POR_ROL} copias de cada rol más ${COPIAS_ESPECIALES_POR_ROL} carta especial por rol.`
          : `El mazo tiene ${cartasEnMazo(false)} cartas: ${COPIAS_POR_ROL} copias de cada rol (modo sin roles especiales).`,
        `Se juega de ${MIN_JUGADORES} a ${maxJugadores(especiales)} jugadores.`,
      ],
    },
    {
      id: 'turno',
      titulo: 'Tu turno',
      puntos: [
        'En tu turno haces una sola acción (ver la tabla de acciones).',
        'Su coste se paga al declararla.',
      ],
    },
    {
      id: 'desafios',
      titulo: 'Faroles y desafíos',
      puntos: [
        'Puedes declarar una acción de rol aunque no tengas la carta (farol).',
        'Cualquier jugador puede desafiar una acción de rol o un bloqueo. El desafiado debe mostrar la carta.',
        'Si la tiene, el desafiante pierde una carta y el desafiado cambia la suya por otra del mazo. Si no, el desafiado pierde la carta que mostró y su acción se cancela.',
        'También puedes rendirte ante un desafío y perder una carta a tu elección.',
      ],
    },
    {
      id: 'bloqueos',
      titulo: 'Bloqueos',
      puntos: [
        'Algunas acciones se pueden bloquear alegando un rol (columna «Bloqueable por» de la tabla): «Alegar Sindicalizado», «Alegar RH»… No hace falta tener la carta, pero si te desafían debes mostrarla. El bloqueo también se puede desafiar.',
        'El Ingeniero normal no puede bloquear el Despido, ni siquiera siendo su objetivo: lo bloquea el Sindicalizado. La Demanda laboral y la Renuncia «voluntaria» solo las frena la Contrademanda del Sindicalizado Especial.',
        ...(especiales
          ? [
              'Al recibir una Demanda laboral, un Despido o una Renuncia ves a la vez tus opciones: alegar el bloqueo que corresponda, o «explotar el site» si eres el Ingeniero Especial (tengas la carta o farolees). Si bloqueas y tu bloqueo cae, aún puedes explotar el site.',
            ]
          : []),
      ],
    },
  ]
  if (especiales) {
    secciones.push(
      {
        id: 'especiales',
        titulo: 'Cartas especiales',
        puntos: [
          'Cada especial cuenta también como su rol normal y añade una habilidad. Se declaran aparte.',
          ...TODOS_LOS_ROLES.map(
            (rol) => `${nombreReclamo({ rol, especial: true })}. ${FICHAS_ROLES[rol].especial.descripcion}`,
          ),
        ],
      },
      {
        id: 'riesgo',
        titulo: 'Riesgo doble',
        puntos: [
          `Si mientes sobre una carta especial y te desafían, pierdes ${PENALIZACION_ESPECIAL} cartas (con ${CARTAS_POR_JUGADOR} cartas vivas, quedas eliminado).`,
          `Si desafías un reclamo especial verdadero, el desafiante pierde ${PENALIZACION_ESPECIAL} cartas.`,
          `Rendirse ante un reclamo especial también cuesta ${PENALIZACION_ESPECIAL}.`,
        ],
      },
      {
        id: 'unSoloUso',
        titulo: 'Habilidades de un solo uso',
        puntos: [
          'Si declaras una habilidad de un solo uso y nadie te desafía, devuelves tus cartas vivas al mazo, se baraja y robas otras (pueden tocarte las mismas).',
          'Si te desafían y demuestras la carta, solo se cambia la mostrada.',
          'Si usas la Excusa de mérito (Jefe de Área Especial), la declaras antes de mostrar carta. Si la desafían se resuelve sola: si la tienes, el desafiante pierde 2 cartas; si no, pierdes todas las tuyas.',
        ],
      },
    )
  }
  secciones.push(
    {
      id: 'creditos',
      titulo: 'Créditos',
      puntos: [
        'Los créditos de una acción se gastan al declararla. Solo se devuelven si descubren el farol de quien la declaró.',
        'Si el objetivo cae antes de que la acción lo alcance, el atacante no recupera sus créditos.',
        `Con ${LIMITE_CREDITOS} créditos o más no puedes hacer acciones que den créditos: debes gastar.`,
      ],
    },
    {
      id: 'eliminacion',
      titulo: 'Eliminación y descarte',
      puntos: [
        'Al perder tu segunda carta quedas eliminado y sigues como espectador.',
        'Las cartas perdidas quedan boca arriba en el descarte, que todos pueden consultar durante la partida.',
      ],
    },
    {
      id: 'salir',
      titulo: 'Salir de la partida',
      puntos: [
        'Puedes salir en cualquier momento, con confirmación. Perderás tus vidas (tus cartas pasan al descarte) y no podrás reingresar a esa partida.',
        'Si tenías una acción pendiente, se cancela y el turno continúa. Si sales de la sala de espera, solo dejas tu asiento libre.',
        'El anfitrión no puede retirarse: si sale, la partida se cierra para todos.',
      ],
    },
  )
  return secciones
}
