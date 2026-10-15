import { useMemo, type ReactNode } from 'react'
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
import type { Histogram } from '@/lib/api'
import { fixed } from '@/lib/format'

export interface LineSeries {
  name: string
  color: string
  points: [number, number][]
  dashed?: boolean
  /** Show 8px markers at each point (sparse sensitivity grids). */
  markers?: boolean
}

interface LinesChartProps {
  title: string
  description: ReactNode
  series: LineSeries[]
  xName: string
  yName: string
  xFormat: (x: number) => string
  yFormat: (y: number) => string
  /** Dashed vertical guide at the current input. */
  current?: number
  /** Logarithmic x-axis (e.g. counts that double). */
  logX?: boolean
  stale: boolean
  ariaLabel: string
  className?: string
}

/** Lines on value axes with a crosshair tooltip; a legend appears for 2+ series. */
export function LinesChart({
  title,
  description,
  series,
  xName,
  yName,
  xFormat,
  yFormat,
  current,
  logX = false,
  stale,
  ariaLabel,
  className,
}: LinesChartProps) {
  const c = useChartColors()
  const option = useMemo<ChartOption | null>(() => {
    if (series.every((s) => s.points.length === 0)) return null
    const axis = axisStyle(c)
    return {
      animationDurationUpdate: 150,
      grid: GRID,
      tooltip: {
        ...tooltipStyle(c),
        formatter: (raw: unknown) => {
          const params = raw as { seriesName: string; color: string; value: [number, number] }[]
          if (!params.length) return ''
          return (
            tooltipHeader(xFormat(params[0].value[0])) +
            params.map((p) => tooltipRow(p.color, yFormat(p.value[1]), p.seriesName)).join('')
          )
        },
      },
      xAxis: {
        type: logX ? 'log' : 'value',
        logBase: 2,
        name: xName,
        nameLocation: 'middle',
        nameGap: 28,
        scale: true,
        ...axis,
        splitLine: { show: false },
        axisLabel: { ...axis.axisLabel, formatter: (v: number) => xFormat(v) },
      },
      yAxis: {
        type: 'value',
        name: yName,
        scale: true,
        ...axis,
        axisLabel: { ...axis.axisLabel, formatter: (v: number) => yFormat(v) },
      },
      series: series.map((s, i) => ({
        name: s.name,
        type: 'line' as const,
        data: s.points,
        showSymbol: Boolean(s.markers),
        symbol: 'circle',
        symbolSize: 8,
        lineStyle: {
          width: 2,
          color: s.color,
          type: s.dashed ? ('dashed' as const) : ('solid' as const),
        },
        itemStyle: { color: s.color, borderColor: c.surface, borderWidth: 2 },
        markLine:
          i === 0 && current != null
            ? {
                silent: true,
                symbol: 'none',
                lineStyle: { color: c.axis, type: 'dashed' as const, width: 1 },
                label: { show: false },
                data: [{ xAxis: current }],
              }
            : undefined,
      })),
    }
  }, [series, xName, yName, xFormat, yFormat, current, logX, c])
  return (
    <ChartCard
      title={title}
      description={description}
      action={
        series.length > 1 ? (
          <div className="flex flex-wrap gap-4">
            {series.map((s) => (
              <LegendKey key={s.name} color={s.color} label={s.name} />
            ))}
          </div>
        ) : undefined
      }
      stale={stale}
    >
      {option ? (
        <EChart option={option} className={className} ariaLabel={ariaLabel} />
      ) : (
        <div className={className ?? 'h-72'} />
      )}
    </ChartCard>
  )
}

interface HistogramChartProps {
  title: string
  description: ReactNode
  /** One or two distributions on the same bins. */
  histograms: { name: string; color: string; data: Histogram }[]
  xName: string
  xFormat: (x: number) => string
  /** Vertical guides at given x values (snapped to the nearest bin). Labelled when there is
   * one; with several, name them in the description (labels would collide). */
  markers?: { x: number; label: string }[]
  stale: boolean
  ariaLabel: string
}

/** Share of paths per bin (%), so different path counts compare directly. */
export function HistogramChart({
  title,
  description,
  histograms,
  xName,
  xFormat,
  markers = [],
  stale,
  ariaLabel,
}: HistogramChartProps) {
  const c = useChartColors()
  const option = useMemo<ChartOption | null>(() => {
    const first = histograms[0]?.data
    if (!first) return null
    const axis = axisStyle(c)
    const edges = first.edges
    const centres = first.counts.map((_, i) => (edges[i] + edges[i + 1]) / 2)
    const nearest = (x: number) =>
      centres.reduce((best, v, i) => (Math.abs(v - x) < Math.abs(centres[best] - x) ? i : best), 0)
    return {
      animationDurationUpdate: 150,
      grid: GRID,
      tooltip: {
        ...tooltipStyle(c),
        axisPointer: { type: 'shadow' },
        formatter: (raw: unknown) => {
          const params = raw as {
            dataIndex: number
            seriesName: string
            color: string
            value: number
          }[]
          const i = params[0]?.dataIndex ?? 0
          return (
            tooltipHeader(`${xFormat(edges[i])} to ${xFormat(edges[i + 1])}`) +
            params.map((p) => tooltipRow(p.color, `${fixed(p.value, 1)}%`, p.seriesName)).join('')
          )
        },
      },
      xAxis: {
        type: 'category',
        data: centres.map((x) => xFormat(x)),
        name: xName,
        nameLocation: 'middle',
        nameGap: 28,
        ...axis,
        axisLabel: { ...axis.axisLabel, interval: Math.max(0, Math.round(centres.length / 6) - 1) },
        splitLine: { show: false },
      },
      yAxis: { type: 'value', name: 'Share of paths (%)', ...axis },
      series: histograms.map((h, k) => {
        const total = h.data.counts.reduce((a, b) => a + b, 0) || 1
        return {
          name: h.name,
          type: 'bar' as const,
          data: h.data.counts.map((n) => (100 * n) / total),
          barGap: '10%',
          barCategoryGap: histograms.length > 1 ? '20%' : 2,
          barMaxWidth: 24,
          itemStyle: { color: h.color, borderRadius: [4, 4, 0, 0] },
          markLine:
            k === 0 && markers.length
              ? {
                  silent: true,
                  symbol: 'none',
                  lineStyle: { color: c.ink2, type: 'dashed' as const, width: 1 },
                  label: {
                    show: markers.length === 1,
                    color: c.muted,
                    fontSize: 11,
                    formatter: '{b}',
                  },
                  data: markers.map((m) => ({ name: m.label, xAxis: nearest(m.x) })),
                }
              : undefined,
        }
      }),
    }
  }, [histograms, xName, xFormat, markers, c])
  return (
    <ChartCard
      title={title}
      description={description}
      action={
        histograms.length > 1 ? (
          <div className="flex gap-4">
            {histograms.map((h) => (
              <LegendKey key={h.name} color={h.color} label={h.name} band />
            ))}
          </div>
        ) : undefined
      }
      stale={stale}
    >
      {option ? <EChart option={option} ariaLabel={ariaLabel} /> : <div className="h-72" />}
    </ChartCard>
  )
}
