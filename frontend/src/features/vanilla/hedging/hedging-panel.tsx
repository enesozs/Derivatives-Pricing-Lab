import { PanelSection } from '@/components/panel-section'
import { ParamControl } from '@/components/param-control'
import { Segmented } from '@/components/segmented'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import type { OptionKind } from '@/lib/api'
import { DEFAULT_HEDGE, type HedgeParams } from './params'

interface HedgingPanelProps {
  params: HedgeParams
  onChange: (params: HedgeParams) => void
}

export function HedgingPanel({ params, onChange }: HedgingPanelProps) {
  const set =
    <K extends keyof HedgeParams>(key: K) =>
    (value: HedgeParams[K]) =>
      onChange({ ...params, [key]: value })

  return (
    <Card className="overflow-hidden">
      <PanelSection title="Position" hint="One European option, hedged with the underlying.">
        <div className="flex flex-col gap-2">
          <Segmented<'short' | 'long'>
            label="Position"
            value={params.position}
            onChange={set('position')}
            options={[
              { value: 'short', label: 'Sold (short)' },
              { value: 'long', label: 'Bought (long)' },
            ]}
            className="w-full"
          />
          <Segmented<OptionKind>
            label="Option type"
            value={params.kind}
            onChange={set('kind')}
            options={[
              { value: 'call', label: 'Call' },
              { value: 'put', label: 'Put' },
            ]}
            className="w-full"
          />
        </div>
        <ParamControl
          label="Strike"
          value={params.strike}
          onChange={set('strike')}
          min={10}
          max={300}
          step={1}
        />
        <ParamControl
          label="Time to expiry"
          value={params.expiry}
          onChange={set('expiry')}
          min={0.1}
          max={3}
          step={0.05}
          unit="yrs"
          digits={2}
        />
      </PanelSection>
      <Separator />
      <PanelSection
        title="Volatility"
        hint="The hedger prices and hedges at one volatility; the market delivers another."
      >
        <ParamControl
          label="Realised (market)"
          value={params.realisedVolPct}
          onChange={set('realisedVolPct')}
          min={5}
          max={80}
          step={1}
          unit="%"
        />
        <ParamControl
          label="Assumed (hedger)"
          value={params.hedgeVolPct}
          onChange={set('hedgeVolPct')}
          min={5}
          max={80}
          step={1}
          unit="%"
        />
      </PanelSection>
      <Separator />
      <PanelSection
        title="Hedging"
        hint="How often the hedge is adjusted and what each trade costs."
      >
        <ParamControl
          label="Re-balances over the life"
          value={params.rebalances}
          onChange={set('rebalances')}
          min={1}
          max={504}
          step={1}
        />
        <ParamControl
          label="Trading cost"
          value={params.costBps}
          onChange={set('costBps')}
          min={0}
          max={50}
          step={0.5}
          unit="bps"
          digits={1}
        />
        <ParamControl
          label="Simulated paths"
          value={params.paths}
          onChange={set('paths')}
          min={200}
          max={10_000}
          step={100}
        />
      </PanelSection>
      <Separator />
      <PanelSection title="Market">
        <ParamControl
          label="Spot price"
          value={params.spot}
          onChange={set('spot')}
          min={10}
          max={300}
          step={1}
        />
        <ParamControl
          label="Risk-free rate"
          value={params.ratePct}
          onChange={set('ratePct')}
          min={-2}
          max={15}
          step={0.25}
          unit="%"
          digits={2}
        />
        <ParamControl
          label="Dividend yield"
          value={params.dividendPct}
          onChange={set('dividendPct')}
          min={0}
          max={15}
          step={0.25}
          unit="%"
          digits={2}
        />
      </PanelSection>
      <Separator />
      <div className="px-5 py-4">
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => onChange(DEFAULT_HEDGE)}
        >
          Reset to defaults
        </Button>
      </div>
    </Card>
  )
}
