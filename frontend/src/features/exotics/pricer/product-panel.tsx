import { PanelSection } from '@/components/panel-section'
import { ParamControl } from '@/components/param-control'
import { Segmented } from '@/components/segmented'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import type { OptionKind } from '@/lib/api'
import { ModelSection } from '../model-section'
import {
  DEFAULT_EXOTIC,
  type ExoticParams,
  type Monitoring,
  PRODUCT_INTROS,
  type ProductType,
} from './params'

interface ProductPanelProps {
  params: ExoticParams
  onChange: (params: ExoticParams) => void
}

const MONITORING = [
  { value: 'continuous', label: 'Continuous' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
] satisfies { value: Monitoring; label: string }[]

export function ProductPanel({ params, onChange }: ProductPanelProps) {
  const set =
    <K extends keyof ExoticParams>(key: K) =>
    (value: ExoticParams[K]) =>
      onChange({ ...params, [key]: value })
  const p = params.product
  const showStrike = !(p === 'lookback' || p === 'asian') || params.strikeType === 'fixed'

  return (
    <Card className="overflow-hidden">
      <PanelSection title="Product" hint={PRODUCT_INTROS[p]}>
        <Segmented<ProductType>
          label="Product"
          value={p}
          onChange={set('product')}
          options={[
            { value: 'digital', label: 'Digital' },
            { value: 'barrier', label: 'Barrier' },
            { value: 'asian', label: 'Asian' },
            { value: 'lookback', label: 'Lookback' },
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
        {p === 'digital' && (
          <>
            <Segmented<'cash' | 'asset'>
              label="Payout"
              value={params.payout}
              onChange={set('payout')}
              options={[
                { value: 'cash', label: 'Cash-or-nothing' },
                { value: 'asset', label: 'Asset-or-nothing' },
              ]}
              className="w-full"
            />
            {params.payout === 'cash' && (
              <ParamControl
                label="Cash payout"
                value={params.cash}
                onChange={set('cash')}
                min={1}
                max={100}
                step={1}
              />
            )}
          </>
        )}
        {p === 'barrier' && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <Segmented<'down' | 'up'>
                label="Barrier direction"
                value={params.direction}
                onChange={(direction) =>
                  onChange({
                    ...params,
                    direction,
                    barrier:
                      direction === 'down'
                        ? Math.min(params.barrier, params.spot * 0.85)
                        : Math.max(params.barrier, params.spot * 1.15),
                  })
                }
                options={[
                  { value: 'down', label: 'Down' },
                  { value: 'up', label: 'Up' },
                ]}
                className="w-full"
              />
              <Segmented<'in' | 'out'>
                label="Knock type"
                value={params.knock}
                onChange={set('knock')}
                options={[
                  { value: 'out', label: 'Out' },
                  { value: 'in', label: 'In' },
                ]}
                className="w-full"
              />
            </div>
            <ParamControl
              label="Barrier"
              value={params.barrier}
              onChange={set('barrier')}
              min={50}
              max={150}
              step={1}
            />
          </>
        )}
        {p === 'asian' && (
          <>
            <Segmented<'arithmetic' | 'geometric'>
              label="Averaging"
              value={params.averaging}
              onChange={set('averaging')}
              options={[
                { value: 'arithmetic', label: 'Arithmetic' },
                { value: 'geometric', label: 'Geometric' },
              ]}
              className="w-full"
            />
            <ParamControl
              label="Fixing dates"
              value={params.fixings}
              onChange={set('fixings')}
              min={1}
              max={252}
              step={1}
            />
          </>
        )}
        {(p === 'asian' || p === 'lookback') && (
          <Segmented<'fixed' | 'floating'>
            label="Strike type"
            value={params.strikeType}
            onChange={set('strikeType')}
            options={[
              { value: 'fixed', label: 'Fixed strike' },
              { value: 'floating', label: 'Floating strike' },
            ]}
            className="w-full"
          />
        )}
        {(p === 'barrier' || p === 'lookback') && (
          <Segmented<Monitoring>
            label="Monitoring"
            size="sm"
            value={params.monitoring}
            onChange={set('monitoring')}
            options={MONITORING}
            className="w-full"
          />
        )}
        {showStrike && (
          <ParamControl
            label="Strike"
            value={params.strike}
            onChange={set('strike')}
            min={50}
            max={150}
            step={1}
          />
        )}
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
      <ModelSection model={params.model} onChange={set('model')} />
      <Separator />
      <PanelSection title="Market">
        <ParamControl
          label="Spot price"
          value={params.spot}
          onChange={set('spot')}
          min={50}
          max={150}
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
      <PanelSection title="Simulation">
        <ParamControl
          label="Monte Carlo paths"
          value={params.mcPaths}
          onChange={set('mcPaths')}
          min={5_000}
          max={200_000}
          step={5_000}
        />
      </PanelSection>
      <Separator />
      <div className="px-5 py-4">
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => onChange(DEFAULT_EXOTIC)}
        >
          Reset to defaults
        </Button>
      </div>
    </Card>
  )
}
