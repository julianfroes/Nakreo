/** Alfabeto sin caracteres ambiguos (sin 0/O, 1/I/L). */
const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
export const LONGITUD_CODIGO = 5

const PATRON = new RegExp(`^[${ALFABETO}]{${LONGITUD_CODIGO}}$`)

/** Código de sala legible, p. ej. "K7MQP". */
export function generarCodigoSala(
  aleatorio: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n)),
): string {
  const bytes = aleatorio(LONGITUD_CODIGO)
  return Array.from(bytes, (b) => ALFABETO[b % ALFABETO.length]).join('')
}

/** Normaliza lo que escribe el usuario; devuelve null si no es un código válido. */
export function normalizarCodigo(entrada: string): string | null {
  const c = entrada.trim().toUpperCase()
  return PATRON.test(c) ? c : null
}

/**
 * ID real en el servidor de PeerJS. El prefijo evita chocar con otras
 * aplicaciones que usen el servidor público.
 */
export const idPeer = (codigo: string) => `nakreo-${codigo}`
