import { useMemo } from 'react'
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
import type { ImpliedVolResponse } from '@/lib/api'
import { fixed } from '@/lib/format'

interface PriceVolChartProps {
  price: number
  data: ImpliedVolResponse | undefined
  stale: boolean
}

export function PriceVolChart({ price, data, stale }: PriceVolChartProps) {
  const c = useChartColors()

  const option = useMemo<ChartOption | null>(() => {
    if (!data || data.curve_vols.length === 0) return null
    const axis = axisStyle(c)
    const vols = data.curve_vols.map((v) => v * 100)
    return {
      animationDurationUpdate: 200,
      grid: GRID,
      tooltip: {
        ...tooltipStyle(c),
        formatter: (raw: unknown) => {
          const i = (raw as { dataIndex: number }[])[0]?.dataIndex ?? 0
          return (
            tooltipHeader(`Volatility ${fixed(vols[i], 1)}%`) +
            tooltipRow(c.series1, fixed(data.curve_prices[i], 4), 'Model price') +
            tooltipRow(c.series2, fixed(price, 4), 'Observed price')
          )
        },
      },
      xAxis: {
        type: 'value',
        name: 'Volatility (%)',
        nameLocation: 'middle',
        nameGap: 28,
        min: 0,
        max: Math.ceil(vols[vols.length - 1]),
        ...axis,
        splitLine: { show: false },
      },
      yAxis: { type: 'value', name: 'Option price', ...axis },
      series: [
        {
          name: 'Model price',
          type: 'line',
          data: vols.map((v, i) => [v, data.curve_prices[i]]),
          showSymbol: false,
          lineStyle: { width: 2, color: c.series1 },
          itemStyle: { color: c.series1 },
          markLine: {
            silent: true,
            symbol: 'none',
            lineStyle: { color: c.series2, width: 2, type: 'solid' },
            label: { show: false },
            data: [{ yAxis: price }],
          },
          markPoint: {
            silent: true,
            symbol: 'circle',
            symbolSize: 10,
            itemStyle: { color: c.series1, borderColor: c.surface, borderWidth: 2 },
            label: { show: false },
            data:
              data.implied_vol == null
                ? []
                : [{ name: 'Implied volatility', coord: [data.implied_vol * 100, price] }],
          },
        },
      ],
    }
  }, [data, c, price])

  return (
    <ChartCard
      title="What the solver inverts"
      description="Model price rises steadily with volatility, so each price above the zero-vol floor maps to exactly one volatility: where the curve meets the observed price."
      action={
        <div className="flex gap-4">
          <LegendKey color={c.series1} label="Model price" />
          <LegendKey color={c.series2} label="Observed price" />
        </div>
      }
      stale={stale}
    >
      {option ? (
        <EChart
          option={option}
          ariaLabel="Line chart of model option price against volatility, with the observed price as a horizontal line"
        />
      ) : (
        <div className="h-72" />
      )}
    </ChartCard>
  )
}
