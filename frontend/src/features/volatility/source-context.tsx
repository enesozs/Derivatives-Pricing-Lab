import { createContext, useContext, useState, type ReactNode } from 'react'
import type { SourceRequest } from '@/lib/api'

const DEFAULT_SOURCE: SourceRequest = { source: 'snapshot', ticker: 'SPY', rate: 0.04 }

const SourceContext = createContext<{
  source: SourceRequest
  setSource: (source: SourceRequest) => void
}>({ source: DEFAULT_SOURCE, setSource: () => {} })

/** The chosen market-data source, shared by every Volatility page. */
export function VolSourceProvider({ children }: { children: ReactNode }) {
  const [source, setSource] = useState(DEFAULT_SOURCE)
  return <SourceContext.Provider value={{ source, setSource }}>{children}</SourceContext.Provider>
}

export function useVolSource() {
  return useContext(SourceContext)
}
