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
import type { ExoticProfileResponse } from '@/lib/api'
import { fixed, signed } from '@/lib/format'
import type { ExoticParams } from './params'

type View = 'value' | 'delta'

export function ProfileChart({
  data,
  stale,
  params,
}: {
  data: ExoticProfileResponse | undefined
  stale: boolean
  params: ExoticParams
}) {
  const c = useChartColors()
  const [view, setView] = useState<View>('value')

  const option = useMemo<ChartOption | null>(() => {
    if (!data) return null
    const axis = axisStyle(c)
    const exotic = view === 'value' ? data.value : data.delta
    const vanilla = view === 'value' ? data.vanilla_value : data.vanilla_delta
    const lines: { name: string; xAxis: number }[] = []
    if (params.product !== 'lookback' || params.strikeType === 'fixed')
      lines.push({ name: 'Strike', xAxis: params.strike })
    if (params.product === 'barrier') lines.push({ name: 'Barrier', xAxis: params.barrier })
    const fmt = (v: number) => (view === 'value' ? fixed(v, 3) : signed(v, 3))
    return {
      animationDurationUpdate: 150,
      grid: GRID,
      tooltip: {
        ...tooltipStyle(c),
        formatter: (raw: unknown) => {
          const i = (raw as { dataIndex: number }[])[0]?.dataIndex ?? 0
          return (
            tooltipHeader(`Spot ${fixed(data.spots[i], 2)}`) +
            tooltipRow(c.series1, fmt(exotic[i]), 'Exotic') +
            (vanilla ? tooltipRow(c.series2, fmt(vanilla[i]), 'Vanilla') : '')
          )
        },
      },
      xAxis: {
        type: 'value',
        name: 'Spot today',
        nameLocation: 'middle',
        nameGap: 28,
        min: data.spots[0],
        max: data.spots[data.spots.length - 1],
        ...axis,
        axisLabel: { ...axis.axisLabel, formatter: (v: number) => fixed(v, 0) },
        splitLine: { show: false },
      },
      yAxis: { type: 'value', name: view === 'value' ? 'Value' : 'Delta', ...axis },
      series: [
        ...(vanilla
          ? [
              {
                name: 'Vanilla',
                type: 'line' as const,
                data: data.spots.map((s, i) => [s, vanilla[i]]),
                showSymbol: false,
                lineStyle: { width: 2, color: c.series2 },
                itemStyle: { color: c.series2 },
              },
            ]
          : []),
        {
          name: 'Exotic',
          type: 'line' as const,
          data: data.spots.map((s, i) => [s, exotic[i]]),
          showSymbol: false,
          lineStyle: { width: 2, color: c.series1 },
          itemStyle: { color: c.series1 },
          markLine: {
            silent: true,
            symbol: 'none',
            lineStyle: { color: c.axis, width: 1, type: 'solid' as const },
            label: { color: c.muted, fontSize: 11, formatter: '{b}' },
            data: lines,
          },
        },
      ],
    }
  }, [data, c, view, params.product, params.strike, params.barrier, params.strikeType])

  return (
    <ChartCard
      title={view === 'value' ? 'Value across spot' : 'Delta across spot'}
      description={
        data
          ? `${view === 'value' ? 'Today’s value' : 'Hedge ratio'} of the exotic against the equivalent vanilla. ${params.product === 'barrier' && view === 'delta' ? 'Near a knock-out barrier delta can exceed 1 or flip sign: hard to hedge. ' : ''}Engine: ${data.engine_label}.`
          : 'Loading…'
      }
      action={
        <div className="flex flex-col items-end gap-2">
          <Segmented<View>
            label="Profile view"
            size="sm"
            value={view}
            onChange={setView}
            options={[
              { value: 'value', label: 'Value' },
              { value: 'delta', label: 'Delta' },
            ]}
          />
          <div className="flex gap-4">
            <LegendKey color={c.series1} label="Exotic" />
            {data?.vanilla_value && <LegendKey color={c.series2} label="Vanilla" />}
          </div>
        </div>
      }
      stale={stale}
    >
      {option ? (
        <EChart option={option} ariaLabel="Exotic and vanilla value or delta across spot" />
      ) : (
        <div className="h-72" />
      )}
    </ChartCard>
  )
}
