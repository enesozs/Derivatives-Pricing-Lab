/** Linear interpolation of y(x) on an increasing grid; null where y is missing or x is outside. */
export function interpolate(xs: number[], ys: (number | null)[], x: number): number | null {
  for (let i = 1; i < xs.length; i++) {
    if (x <= xs[i]) {
      const y0 = ys[i - 1]
      const y1 = ys[i]
      if (x < xs[i - 1] || y0 == null || y1 == null) return null
      const w = (x - xs[i - 1]) / (xs[i] - xs[i - 1])
      return y0 + w * (y1 - y0)
    }
  }
  return null
}
