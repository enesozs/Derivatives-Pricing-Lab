/** Mobile keyboard for a number field: decimals need a dot, negatives need a minus sign. */
export function inputModeFor(min: number | undefined, step: number, digits: number) {
  if (min !== undefined && min < 0) return 'text' as const
  return digits > 0 || step < 1 ? ('decimal' as const) : ('numeric' as const)
}
