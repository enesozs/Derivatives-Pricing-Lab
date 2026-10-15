import { PanelSection } from '@/components/panel-section'
import { ParamControl } from '@/components/param-control'
import { Segmented } from '@/components/segmented'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import type { ExerciseStyle, OptionKind } from '@/lib/api'
import { DEFAULT_IV_PARAMS, type ImpliedVolParams } from './params'

interface ImpliedVolPanelProps {
  params: ImpliedVolParams
  onChange: (params: ImpliedVolParams) => void
}

export function ImpliedVolPanel({ params, onChange }: ImpliedVolPanelProps) {
  const set =
    <K extends keyof ImpliedVolParams>(key: K) =>
    (value: ImpliedVolParams[K]) =>
      onChange({ ...params, [key]: value })

  return (
    <Card className="overflow-hidden">
      <PanelSection
        title="Observed price"
        hint="What the option trades at, per unit of underlying."
      >
        <ParamControl
          label="Option price"
          value={params.price}
          onChange={set('price')}
          min={0.01}
          max={Math.max(50, Math.ceil(params.spot))}
          step={0.01}
          digits={2}
        />
      </PanelSection>
      <Separator />
      <PanelSection title="Contract">
        <div className="flex flex-col gap-2">
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
          <Segmented<ExerciseStyle>
            label="Exercise style"
            value={params.exercise}
            onChange={set('exercise')}
            options={[
              { value: 'european', label: 'European' },
              { value: 'american', label: 'American' },
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
          min={0.05}
          max={5}
          step={0.05}
          unit="yrs"
          digits={2}
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
          onClick={() => onChange(DEFAULT_IV_PARAMS)}
        >
          Reset to defaults
        </Button>
      </div>
    </Card>
  )
}
