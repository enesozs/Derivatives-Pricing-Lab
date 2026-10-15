import { useMemo } from 'react'
import { ChartCard, LegendKey } from '@/components/charts/chart-card'
import { EChart, type ChartOption } from '@/components/charts/echart'
import {
  axisStyle,
  FONT_FAMILY,
  GRID,
  tooltipHeader,
  tooltipRow,
  tooltipStyle,
  useChartColors,
} from '@/components/charts/theme'
import { Segmented } from '@/components/segmented'
import type { TreeResponse, TreeScheme } from '@/lib/api'
import { fixed } from '@/lib/format'

interface TreeChartProps {
  data: TreeResponse | undefined
  stale: boolean
  steps: number
  scheme: TreeScheme
  american: boolean
  onStepsChange: (steps: number) => void
  onSchemeChange: (scheme: TreeScheme) => void
}

const STEP_OPTIONS = ['2', '3', '4', '5', '6', '8', '10'] as const

export function TreeChart(props: TreeChartProps) {
  const { data, stale, steps, scheme, american, onStepsChange, onSchemeChange } = props
  const c = useChartColors()

  const option = useMemo<ChartOption | null>(() => {
    if (!data) return null
    const axis = axisStyle(c)
    const node = (level: number, index: number) =>
      data.nodes.find((n) => n.level === level && n.index === index)!
    // Edges as one line series: [from, to, '-'] triples; '-' breaks the line between edges.
    const edges: (number[] | '-')[] = []
    for (const n of data.nodes) {
      if (n.level === data.steps) continue
      for (const next of [node(n.level + 1, n.index), node(n.level + 1, n.index + 1)]) {
        edges.push([n.level, n.spot], [next.level, next.spot], '-')
      }
    }
    const showLabels = data.steps <= 6
    // Node data as [step, spot, value] so ECharts' callbacks can read everything from `value`.
    const nodeSeries = (exercised: boolean) => ({
      name: exercised ? 'Exercise early' : 'Hold',
      type: 'scatter' as const,
      data: data.nodes
        .filter((n) => n.exercised === exercised)
        .map((n) => [n.level, n.spot, n.value]),
      encode: { x: 0, y: 1 },
      symbolSize: data.steps <= 6 ? 14 : 10,
      itemStyle: {
        color: exercised ? c.series2 : c.series1,
        borderColor: c.surface,
        borderWidth: 2,
      },
      label: {
        show: showLabels,
        position: 'right' as const,
        distance: 6,
        color: c.ink2,
        fontSize: 11,
        fontFamily: FONT_FAMILY,
        formatter: (p: { value?: unknown }) => fixed((p.value as number[])[2], 2),
      },
      z: 3,
    })
    return {
      animationDurationUpdate: 200,
      grid: { ...GRID, right: 56 },
      tooltip: {
        ...tooltipStyle(c),
        trigger: 'item',
        formatter: (raw: unknown) => {
          const item = raw as { seriesName: string; value: number[] }
          const [level, spot, value] = item.value
          const exercised = item.seriesName === 'Exercise early'
          return (
            tooltipHeader(`Step ${level} · t = ${fixed(level * data.dt, 3)}y`) +
            tooltipRow(exercised ? c.series2 : c.series1, fixed(value, 4), 'Option value') +
            tooltipRow(c.muted, fixed(spot, 2), 'Spot') +
            (exercised ? tooltipRow(c.series2, 'Yes', 'Exercised early') : '')
          )
        },
      },
      xAxis: {
        type: 'value',
        name: 'Time step',
        nameLocation: 'middle',
        nameGap: 28,
        min: 0,
        max: data.steps,
        interval: 1,
        ...axis,
        splitLine: { show: false },
      },
      yAxis: {
        type: 'value',
        name: 'Spot',
        scale: true,
        ...axis,
        axisLabel: { ...axis.axisLabel, formatter: (v: number) => fixed(v, 0) },
      },
      series: [
        {
          name: 'Edges',
          type: 'line',
          data: edges,
          showSymbol: false,
          silent: true,
          lineStyle: { width: 1, color: c.axis },
          tooltip: { show: false },
          z: 1,
        },
        nodeSeries(false),
        nodeSeries(true),
      ],
    }
  }, [data, c])

  return (
    <ChartCard
      title="Binomial tree, node by node"
      description={
        data
          ? `Each step the spot moves up ×${fixed(data.up, 4)} or down ×${fixed(data.down, 4)}; risk-neutral up-probability p = ${fixed(data.probability, 4)}. Values roll back from the payoff at the last step${american ? '; orange nodes are exercised early' : ''}.`
          : 'Loading…'
      }
      action={
        <div className="flex flex-wrap items-center gap-2">
          <Segmented<TreeScheme>
            label="Tree scheme"
            size="sm"
            value={scheme}
            onChange={onSchemeChange}
            options={[
              { value: 'crr', label: 'CRR' },
              { value: 'jarrow-rudd', label: 'Jarrow–Rudd' },
              { value: 'leisen-reimer', label: 'Leisen–Reimer' },
            ]}
          />
          <Segmented<(typeof STEP_OPTIONS)[number]>
            label="Tree steps"
            size="sm"
            value={String(steps) as (typeof STEP_OPTIONS)[number]}
            onChange={(v) => onStepsChange(Number(v))}
            options={STEP_OPTIONS.map((v) => ({ value: v, label: v }))}
          />
        </div>
      }
      stale={stale}
    >
      <div className="mb-2 flex gap-4">
        <LegendKey color={c.series1} label="Hold" band />
        {american && <LegendKey color={c.series2} label="Exercise early" band />}
      </div>
      {option ? (
        <EChart
          option={option}
          className="h-96"
          ariaLabel="Binomial tree diagram: spot at each node over time steps, with option values"
        />
      ) : (
        <div className="h-96" />
      )}
    </ChartCard>
  )
}
