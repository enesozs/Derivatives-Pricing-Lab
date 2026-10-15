import { useMemo, useState } from 'react'
import { ChartCard, LegendKey } from '@/components/charts/chart-card'
import { EChart, type ChartOption } from '@/components/charts/echart'
import {
  axisStyle,
  GRID,
  tooltipHeader,
  tooltipRow,
  tooltipStyle,
  useChartColors,
} from '@/components/charts/theme'
import { Segmented } from '@/components/segmented'
import type { ModelSmileResponse } from '@/lib/api'
import { fixed } from '@/lib/format'
import { maturityLabel } from '../format'

interface ChartProps {
  data: ModelSmileResponse | undefined
  stale: boolean
  spot: number
}

export function SmilesChart({ data, stale, spot }: ChartProps) {
  const c = useChartColors()
  const option = useMemo<ChartOption | null>(() => {
    if (!data) return null
    const axis = axisStyle(c)
    const moneyness = data.smiles[0].strikes.map((k) => (100 * k) / spot)
    return {
      animationDurationUpdate: 150,
      grid: GRID,
      tooltip: {
        ...tooltipStyle(c),
        formatter: (raw: unknown) => {
          const i = (raw as { dataIndex: number }[])[0]?.dataIndex ?? 0
          return (
            tooltipHeader(`Strike ${fixed(moneyness[i], 0)}% of spot`) +
            data.smiles
              .map((s, k) =>
                tooltipRow(
                  c.ordinal[k],
                  s.implied_vol[i] == null ? '—' : `${fixed(s.implied_vol[i]! * 100, 2)}%`,
                  maturityLabel(s.t),
                ),
              )
              .join('')
          )
        },
      },
      xAxis: {
        type: 'value',
        name: 'Strike (% of spot)',
        nameLocation: 'middle',
        nameGap: 28,
        min: moneyness[0],
        max: moneyness[moneyness.length - 1],
        ...axis,
        splitLine: { show: false },
      },
      yAxis: {
        type: 'value',
        name: 'Implied vol (%)',
        scale: true,
        ...axis,
        axisLabel: { ...axis.axisLabel, formatter: (v: number) => fixed(v, 0) },
      },
      series: data.smiles.map((s, k) => ({
        name: maturityLabel(s.t),
        type: 'line' as const,
        data: moneyness.map((m, i) => [
          m,
          s.implied_vol[i] == null ? null : s.implied_vol[i]! * 100,
        ]),
        showSymbol: false,
        connectNulls: false,
        lineStyle: { width: 2, color: c.ordinal[k] },
        itemStyle: { color: c.ordinal[k] },
      })),
    }
  }, [data, c, spot])

  return (
    <ChartCard
      title="The smile this model implies"
      description="Model prices turned back into Black–Scholes implied volatilities, one line per expiry, shaded from shortest to longest. Gaps mark strikes where the price is too small to imply a volatility."
      action={
        data && (
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {data.smiles.map((s, k) => (
              <LegendKey key={s.t} color={c.ordinal[k]} label={maturityLabel(s.t)} />
            ))}
          </div>
        )
      }
      stale={stale}
    >
      {option ? (
        <EChart
          option={option}
          className="h-96"
          ariaLabel="Model implied volatility smiles for several expiries"
        />
      ) : (
        <div className="h-96" />
      )}
    </ChartCard>
  )
}

export function DensityChart({ data, stale, spot }: ChartProps) {
  const c = useChartColors()
  const [index, setIndex] = useState(3)
  const smile = data?.smiles[Math.min(index, (data?.smiles.length ?? 1) - 1)]
  const option = useMemo<ChartOption | null>(() => {
    if (!data || !smile?.density) return null
    const axis = axisStyle(c)
    const isLongest = smile === data.smiles[data.smiles.length - 1]
    return {
      animationDurationUpdate: 150,
      grid: GRID,
      tooltip: {
        ...tooltipStyle(c),
        formatter: (raw: unknown) => {
          const i = (raw as { dataIndex: number }[])[0]?.dataIndex ?? 0
          return (
            tooltipHeader(`Spot at expiry ${fixed(data.density_spots[i], 1)}`) +
            tooltipRow(c.series1, fixed(smile.density![i] * 100, 3), 'Model density (%/unit)') +
            (isLongest
              ? tooltipRow(
                  c.series2,
                  fixed(data.reference_density[i] * 100, 3),
                  'Lognormal, same ATM vol',
                )
              : '')
          )
        },
      },
      xAxis: {
        type: 'value',
        name: 'Spot at expiry',
        nameLocation: 'middle',
        nameGap: 28,
        min: data.density_spots[0],
        max: data.density_spots[data.density_spots.length - 1],
        ...axis,
        axisLabel: { ...axis.axisLabel, formatter: (v: number) => fixed(v, 0) },
        splitLine: { show: false },
      },
      yAxis: { type: 'value', name: 'Probability density', ...axis, axisLabel: { show: false } },
      series: [
        {
          name: 'Model density',
          type: 'line',
          data: data.density_spots.map((s, i) => [s, smile.density![i]]),
          showSymbol: false,
          lineStyle: { width: 2, color: c.series1 },
          itemStyle: { color: c.series1 },
          areaStyle: { color: c.band },
          markLine: {
            silent: true,
            symbol: 'none',
            lineStyle: { color: c.axis, width: 1, type: 'solid' },
            label: { color: c.muted, fontSize: 11, formatter: '{b}' },
            data: [{ name: 'Spot today', xAxis: spot }],
          },
        },
        ...(isLongest
          ? [
              {
                name: 'Lognormal',
                type: 'line' as const,
                data: data.density_spots.map((s, i) => [s, data.reference_density[i]]),
                showSymbol: false,
                lineStyle: { width: 2, color: c.series2 },
                itemStyle: { color: c.series2 },
              },
            ]
          : []),
      ],
    }
  }, [data, smile, c, spot])

  const isLongest = data && smile === data.smiles[data.smiles.length - 1]
  return (
    <ChartCard
      title="Where the model thinks the price will end up"
      description={
        smile && !smile.density
          ? 'SABR is a smile formula without a characteristic function, so its density is not shown here.'
          : 'The risk-neutral distribution of the price at expiry, recovered from the characteristic function. A fat left tail is what makes downside puts expensive.'
      }
      action={
        data && (
          <div className="flex flex-col items-end gap-2">
            <Segmented
              label="Density expiry"
              size="sm"
              value={String(Math.min(index, data.smiles.length - 1))}
              onChange={(v) => setIndex(Number(v))}
              options={data.smiles.map((s, i) => ({ value: String(i), label: maturityLabel(s.t) }))}
            />
            <div className="flex gap-4">
              <LegendKey color={c.series1} label="Model" />
              {isLongest && <LegendKey color={c.series2} label="Lognormal (same ATM vol)" />}
            </div>
          </div>
        )
      }
      stale={stale}
    >
      {option ? (
        <EChart
          option={option}
          className="h-96"
          ariaLabel="Risk-neutral probability density of the price at expiry"
        />
      ) : (
        <div className="flex h-96 items-center justify-center rounded-xl border border-dashed text-muted-foreground text-sm">
          {smile && !smile.density ? 'No density for SABR' : 'Loading…'}
        </div>
      )}
    </ChartCard>
  )
}
