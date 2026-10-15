import { PanelSection } from '@/components/panel-section'
import { ParamControl } from '@/components/param-control'

export interface MarketParams {
  ratePct: number
  dividendPct: number
}

export const DEFAULT_MARKET: MarketParams = { ratePct: 3, dividendPct: 1 }

export function toMarket(m: MarketParams) {
  return { rate: m.ratePct / 100, dividend_yield: m.dividendPct / 100 }
}

/** Rate and dividend yield; the underlying always starts at 100 so levels read as %. */
export function MarketSection({
  market,
  onChange,
}: {
  market: MarketParams
  onChange: (m: MarketParams) => void
}) {
  return (
    <PanelSection
      title="Market"
      hint="Underlying starts at 100, so every level reads as % of the initial fixing."
    >
      <ParamControl
        label="Interest rate"
        value={market.ratePct}
        onChange={(v) => onChange({ ...market, ratePct: v })}
        min={0}
        max={8}
        step={0.25}
        unit="%"
        digits={2}
      />
      <ParamControl
        label="Dividend yield"
        value={market.dividendPct}
        onChange={(v) => onChange({ ...market, dividendPct: v })}
        min={0}
        max={6}
        step={0.25}
        unit="%"
        digits={2}
      />
    </PanelSection>
  )
}
