import { PanelSection } from '@/components/panel-section'
import { ParamControl } from '@/components/param-control'
import { Segmented } from '@/components/segmented'
import type { ExoticModelSpec } from '@/lib/api'

export interface ModelParams {
  type: 'black_scholes' | 'heston'
  /** Volatility level in %; for Heston, v0 = theta = (level)^2 so both models start equal. */
  volPct: number
  xi: number
  rho: number
  kappa: number
}

export const DEFAULT_MODEL: ModelParams = {
  type: 'black_scholes',
  volPct: 25,
  xi: 0.5,
  rho: -0.7,
  kappa: 1.5,
}

export function toModelSpec(m: ModelParams): ExoticModelSpec {
  const sigma = m.volPct / 100
  if (m.type === 'black_scholes') return { type: 'black_scholes', volatility: sigma }
  return {
    type: 'heston',
    v0: sigma * sigma,
    theta: sigma * sigma,
    kappa: m.kappa,
    xi: m.xi,
    rho: m.rho,
  }
}

/** Black–Scholes or Heston, with the same volatility level so their prices are comparable. */
export function ModelSection({
  model,
  onChange,
}: {
  model: ModelParams
  onChange: (m: ModelParams) => void
}) {
  const set =
    <K extends keyof ModelParams>(key: K) =>
    (value: ModelParams[K]) =>
      onChange({ ...model, [key]: value })
  return (
    <PanelSection
      title="Model"
      hint={
        model.type === 'black_scholes'
          ? 'Constant volatility: closed forms exist for most exotics.'
          : 'Stochastic volatility at the same average level. Only Monte Carlo can price exotics here; compare with Black–Scholes to see model risk.'
      }
    >
      <Segmented<ModelParams['type']>
        label="Model"
        value={model.type}
        onChange={set('type')}
        options={[
          { value: 'black_scholes', label: 'Black–Scholes' },
          { value: 'heston', label: 'Heston' },
        ]}
        className="w-full"
      />
      <ParamControl
        label="Volatility level"
        value={model.volPct}
        onChange={set('volPct')}
        min={5}
        max={80}
        step={1}
        unit="%"
      />
      {model.type === 'heston' && (
        <>
          <ParamControl
            label="Vol of variance ξ"
            value={model.xi}
            onChange={set('xi')}
            min={0.05}
            max={1.5}
            step={0.05}
            digits={2}
          />
          <ParamControl
            label="Correlation ρ"
            value={model.rho}
            onChange={set('rho')}
            min={-0.95}
            max={0.95}
            step={0.05}
            digits={2}
          />
          <ParamControl
            label="Mean reversion κ"
            value={model.kappa}
            onChange={set('kappa')}
            min={0.2}
            max={8}
            step={0.1}
            digits={1}
          />
        </>
      )}
    </PanelSection>
  )
}
