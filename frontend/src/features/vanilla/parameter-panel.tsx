import type { ReactNode } from 'react'
import { ParamControl } from '@/components/param-control'
import { Segmented } from '@/components/segmented'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import type { ExerciseStyle, OptionKind } from '@/lib/api'
import { DEFAULT_PARAMS, type VanillaParams } from './params'

interface ParameterPanelProps {
  params: VanillaParams
  onChange: (params: VanillaParams) => void
}

function Section({ title, hint, children }: { title: string; hint: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 px-5 py-5">
      <header>
        <h2 className="font-semibold text-sm">{title}</h2>
        <p className="text-muted-foreground text-xs">{hint}</p>
      </header>
      {children}
    </section>
  )
}

export function ParameterPanel({ params, onChange }: ParameterPanelProps) {
  const set =
    <K extends keyof VanillaParams>(key: K) =>
    (value: VanillaParams[K]) =>
      onChange({ ...params, [key]: value })

  return (
    <Card className="overflow-hidden">
      <Section title="Contract" hint="What is traded: payoff, strike and exercise rights.">
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
      </Section>
      <Separator />
      <Section title="Market" hint="Observable today. Rates are continuously compounded.">
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
      </Section>
      <Separator />
      <Section
        title="Model · Black–Scholes"
        hint="Assumed dynamics: lognormal spot, constant volatility."
      >
        <ParamControl
          label="Volatility"
          value={params.volPct}
          onChange={set('volPct')}
          min={1}
          max={150}
          step={1}
          unit="%"
        />
      </Section>
      <Separator />
      <Section title="Numerics" hint="Resolution of the tree and the Monte Carlo simulation.">
        <ParamControl
          label="Tree steps"
          value={params.treeSteps}
          onChange={set('treeSteps')}
          min={10}
          max={2000}
          step={10}
        />
        <ParamControl
          label="Monte Carlo paths"
          value={params.mcPaths}
          onChange={set('mcPaths')}
          min={1000}
          max={500_000}
          step={1000}
        />
      </Section>
      <Separator />
      <div className="px-5 py-4">
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => onChange(DEFAULT_PARAMS)}
        >
          Reset to defaults
        </Button>
      </div>
    </Card>
  )
}
