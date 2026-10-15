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
import { Segmented } from '@/components/segmented'
import type { SurfaceSlice } from '@/lib/api'
import { fixed } from '@/lib/format'
import { expiryLabel, maturityLabel } from '../format'

interface SmileChartProps {
  slices: SurfaceSlice[] | undefined
  selected: number
  onSelect: (index: number) => void
  stale: boolean
}

export function SmileChart({ slices, selected, onSelect, stale }: SmileChartProps) {
  const c = useChartColors()
  const slice = slices?.[Math.min(selected, (slices?.length ?? 1) - 1)]

  const option = useMemo<ChartOption | null>(() => {
    if (!slice) return null
    const axis = axisStyle(c)
    const fitStrikes = slice.fit_k.map((k) => slice.forward * Math.exp(k))
    return {
      animationDurationUpdate: 200,
      grid: GRID,
      tooltip: {
        ...tooltipStyle(c),
        trigger: 'item',
        formatter: (raw: unknown) => {
          const item = raw as { seriesName: string; value: number[]; dataIndex: number }
          const [strike, vol] = item.value
          if (item.seriesName === 'SVI fit') {
            return (
              tooltipHeader(`Strike ${fixed(strike, 2)}`) +
              tooltipRow(c.series2, `${fixed(vol, 2)}%`, 'SVI fit')
            )
          }
          const p = slice.points[item.dataIndex]
          return (
            tooltipHeader(
              `Strike ${fixed(strike, 2)} · ${p.kind} · ${p.price_source === 'mid' ? 'bid/ask mid' : 'last trade'}`,
            ) + tooltipRow(c.series1, `${fixed(vol, 2)}%`, 'Market implied vol')
          )
        },
      },
      xAxis: {
        type: 'value',
        name: 'Strike',
        nameLocation: 'middle',
        nameGap: 28,
        scale: true,
        ...axis,
        axisLabel: { ...axis.axisLabel, formatter: (v: number) => fixed(v, 0) },
        splitLine: { show: false },
      },
      yAxis: {
        type: 'value',
        name: 'Implied vol (%)',
        scale: true,
        ...axis,
        axisLabel: { ...axis.axisLabel, formatter: (v: number) => fixed(v, 0) },
      },
      series: [
        {
          name: 'Market quotes',
          type: 'scatter',
          data: slice.points.map((p) => [p.strike, p.implied_vol * 100]),
          symbolSize: 7,
          itemStyle: { color: c.series1, borderColor: c.surface, borderWidth: 1, opacity: 0.85 },
        },
        {
          name: 'SVI fit',
          type: 'line',
          data: fitStrikes.map((k, i) => [k, slice.fit_vol[i] * 100]),
          showSymbol: false,
          lineStyle: { width: 2, color: c.series2 },
          itemStyle: { color: c.series2 },
          markLine: {
            silent: true,
            symbol: 'none',
            lineStyle: { color: c.axis, width: 1, type: 'solid' },
            label: { color: c.muted, fontSize: 11, formatter: '{b}' },
            data: [{ name: 'Forward', xAxis: slice.forward }],
          },
        },
      ],
    }
  }, [slice, c])

  const options = (slices ?? []).map((s, i) => ({ value: String(i), label: maturityLabel(s.t) }))
  return (
    <ChartCard
      title={slice ? `Volatility smile · ${expiryLabel(slice.expiry)}` : 'Volatility smile'}
      description={
        slice
          ? `${slice.points.length} out-of-the-money quotes and the SVI fit (error ${fixed(slice.svi.rmse * 100, 2)} vol points${slice.svi.butterfly_violations ? `, ${slice.svi.butterfly_violations} butterfly-arbitrage points` : ', no butterfly arbitrage'}). Low strikes trade at higher volatility: the market pays up for crash protection.`
          : 'Loading…'
      }
      action={
        <div className="flex flex-col items-end gap-2">
          <Segmented
            label="Expiry"
            size="sm"
            value={String(Math.min(selected, Math.max(options.length - 1, 0)))}
            onChange={(v) => onSelect(Number(v))}
            options={options}
            className="max-w-full flex-wrap"
          />
          <div className="flex gap-4">
            <LegendKey color={c.series1} label="Market quotes" band />
            <LegendKey color={c.series2} label="SVI fit" />
          </div>
        </div>
      }
      stale={stale}
    >
      {option ? (
        <EChart
          option={option}
          className="h-80"
          ariaLabel="Implied volatility smile with SVI fit"
        />
      ) : (
        <div className="h-80" />
      )}
    </ChartCard>
  )
}
