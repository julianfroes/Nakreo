/** Generador de números en [0, 1). Inyectable para tests deterministas. */
export type Rng = () => number

/** PRNG con semilla (mulberry32). Para tests y reproducibilidad. */
export function crearRng(semilla: number): Rng {
  let a = semilla >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Fisher-Yates. Devuelve una copia barajada. */
export function barajar<T>(items: readonly T[], rng: Rng): T[] {
  const r = [...items]
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const tmp = r[i]
    r[i] = r[j]
    r[j] = tmp
  }
  return r
}
