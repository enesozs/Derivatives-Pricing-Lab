import { createContext, useContext, useState, type ReactNode } from 'react'
import type { RateQuote } from '@/lib/api'

/** Illustrative upward-then-humped USD-style quotes (not live data); mirrors the backend sample. */
export const SAMPLE_QUOTES: RateQuote[] = [
  { kind: 'deposit', maturity: 1 / 12, rate: 0.043, start: 0, frequency: 1 },
  { kind: 'deposit', maturity: 0.25, rate: 0.0425, start: 0, frequency: 1 },
  { kind: 'deposit', maturity: 0.5, rate: 0.0415, start: 0, frequency: 1 },
  { kind: 'swap', maturity: 1, rate: 0.04, start: 0, frequency: 1 },
  { kind: 'swap', maturity: 2, rate: 0.038, start: 0, frequency: 1 },
  { kind: 'swap', maturity: 3, rate: 0.0372, start: 0, frequency: 1 },
  { kind: 'swap', maturity: 5, rate: 0.037, start: 0, frequency: 1 },
  { kind: 'swap', maturity: 7, rate: 0.0375, start: 0, frequency: 1 },
  { kind: 'swap', maturity: 10, rate: 0.0385, start: 0, frequency: 1 },
  { kind: 'swap', maturity: 15, rate: 0.0398, start: 0, frequency: 1 },
  { kind: 'swap', maturity: 20, rate: 0.0402, start: 0, frequency: 1 },
  { kind: 'swap', maturity: 30, rate: 0.0395, start: 0, frequency: 1 },
]

const CurveContext = createContext<{ quotes: RateQuote[]; setQuotes: (q: RateQuote[]) => void }>({
  quotes: SAMPLE_QUOTES,
  setQuotes: () => {},
})

/** The market quotes behind the curve, shared by every Rates page. */
export function CurveProvider({ children }: { children: ReactNode }) {
  const [quotes, setQuotes] = useState(SAMPLE_QUOTES)
  return <CurveContext.Provider value={{ quotes, setQuotes }}>{children}</CurveContext.Provider>
}

export function useCurveQuotes() {
  return useContext(CurveContext)
}

export function tenorLabel(t: number): string {
  if (t < 1) return `${Math.round(t * 12)}M`
  return `${Number.isInteger(t) ? t : t.toFixed(1)}Y`
}
