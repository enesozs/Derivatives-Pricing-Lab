import { PlusIcon } from 'lucide-react'
import { NumberInput } from '@/components/number-input'
import { PanelSection } from '@/components/panel-section'
import { ParamControl } from '@/components/param-control'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { LegEditor } from './leg-editor'
import { applyPreset, type Leg, newLegId, PRESETS, type StrategyParams } from './params'

const MAX_LEGS = 8

interface StrategyPanelProps {
  params: StrategyParams
  onChange: (params: StrategyParams) => void
}

export function StrategyPanel({ params, onChange }: StrategyPanelProps) {
  // Any manual edit turns the strategy into a custom one.
  const edit = (patch: Partial<StrategyParams>) =>
    onChange({ ...params, preset: 'Custom', ...patch })
  const setMarket =
    <K extends 'spot' | 'ratePct' | 'dividendPct' | 'volPct'>(key: K) =>
    (value: number) =>
      onChange({ ...params, [key]: value })

  const updateLeg = (id: number, next: Leg) =>
    edit({ legs: params.legs.map((l) => (l.id === id ? next : l)) })
  const removeLeg = (id: number) => edit({ legs: params.legs.filter((l) => l.id !== id) })
  const addLeg = () => {
    const strike = Math.max(5, Math.round(params.spot / 5) * 5)
    edit({
      legs: [
        ...params.legs,
        {
          id: newLegId(),
          side: 'long',
          kind: 'call',
          exercise: 'european',
          strike,
          expiry: 1,
          quantity: 1,
        },
      ],
    })
  }

  const presetDescription = PRESETS.find((p) => p.name === params.preset)?.description

  return (
    <Card className="overflow-hidden">
      <PanelSection title="Strategy" hint={presetDescription ?? 'Your own combination of legs.'}>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Strategy presets">
          {PRESETS.map((p) => (
            <Button
              key={p.name}
              size="xs"
              variant={p.name === params.preset ? 'default' : 'outline'}
              aria-pressed={p.name === params.preset}
              onClick={() => onChange(applyPreset(params, p.name))}
            >
              {p.name}
            </Button>
          ))}
        </div>
      </PanelSection>
      <Separator />
      <PanelSection
        title="Legs"
        hint="Buy = long, Sell = short. American legs are priced on a tree."
      >
        <div className="flex flex-col gap-2">
          {params.legs.map((leg, i) => (
            <LegEditor
              key={leg.id}
              leg={leg}
              index={i}
              onChange={(next) => updateLeg(leg.id, next)}
              onRemove={() => removeLeg(leg.id)}
            />
          ))}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={addLeg}
          disabled={params.legs.length >= MAX_LEGS}
          className={cn(params.legs.length === 0 && 'border-dashed')}
        >
          <PlusIcon /> Add leg
        </Button>
        <NumberInput
          label="Shares of the underlying (negative = short)"
          value={params.underlying}
          onChange={(underlying) => edit({ underlying })}
          min={-10}
          max={10}
        />
      </PanelSection>
      <Separator />
      <PanelSection title="Market & model" hint="Black–Scholes with constant volatility.">
        <ParamControl
          label="Spot price"
          value={params.spot}
          onChange={setMarket('spot')}
          min={10}
          max={300}
          step={1}
        />
        <ParamControl
          label="Volatility"
          value={params.volPct}
          onChange={setMarket('volPct')}
          min={1}
          max={150}
          step={1}
          unit="%"
        />
        <ParamControl
          label="Risk-free rate"
          value={params.ratePct}
          onChange={setMarket('ratePct')}
          min={-2}
          max={15}
          step={0.25}
          unit="%"
          digits={2}
        />
        <ParamControl
          label="Dividend yield"
          value={params.dividendPct}
          onChange={setMarket('dividendPct')}
          min={0}
          max={15}
          step={0.25}
          unit="%"
          digits={2}
        />
      </PanelSection>
    </Card>
  )
}
