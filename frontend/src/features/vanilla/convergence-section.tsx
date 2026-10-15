import type { ConvergenceResponse } from '@/lib/api'
import { LatticeConvergenceChart, MonteCarloConvergenceChart } from './convergence-charts'

export function ConvergenceSection({
  data,
  stale,
}: {
  data: ConvergenceResponse | undefined
  stale: boolean
}) {
  return (
    <section className="flex flex-col gap-3">
      <header>
        <h2 className="font-semibold">How fast do the numerical methods converge?</h2>
        <p className="text-muted-foreground text-sm">
          Accuracy is bought with computation. These studies show how much.
        </p>
      </header>
      <div className="grid gap-6 xl:grid-cols-2">
        <LatticeConvergenceChart data={data} stale={stale} />
        <MonteCarloConvergenceChart data={data} stale={stale} />
      </div>
    </section>
  )
}
