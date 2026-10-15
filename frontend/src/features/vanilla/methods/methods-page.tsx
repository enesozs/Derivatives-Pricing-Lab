import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { PageHeader } from '@/components/page-header'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { api, type TreeScheme } from '@/lib/api'
import { ParameterPanel } from '../pricer/parameter-panel'
import { DEFAULT_PARAMS, toInputs, type VanillaParams } from '../pricer/params'
import { ExerciseBoundaryChart, PDESlicesChart } from './pde-charts'
import { TreeChart } from './tree-chart'

export default function MethodsPage() {
  const [params, setParams] = useState<VanillaParams>({
    ...DEFAULT_PARAMS,
    kind: 'put',
    exercise: 'american',
  })
  const [steps, setSteps] = useState(5)
  const [scheme, setScheme] = useState<TreeScheme>('crr')
  const settled = useDebouncedValue(params, 150)
  const inputs = useMemo(() => toInputs(settled), [settled])
  const treeRequest = useMemo(() => ({ ...inputs, steps, scheme }), [inputs, steps, scheme])

  const tree = useQuery({
    queryKey: ['vanilla', 'tree', treeRequest],
    queryFn: ({ signal }) => api.tree(treeRequest, signal),
    placeholderData: keepPreviousData,
  })
  const grid = useQuery({
    queryKey: ['vanilla', 'pde-grid', inputs],
    queryFn: ({ signal }) => api.pdeGrid(inputs, signal),
    placeholderData: keepPreviousData,
  })
  const american = settled.exercise === 'american'

  return (
    <>
      <PageHeader title="Trees & grids">
        Look inside the numerical methods: a binomial tree node by node, and the PDE solution as
        time runs to expiry, including where an American option should be exercised.
      </PageHeader>
      <div className="grid gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <ParameterPanel params={params} onChange={setParams} showNumerics={false} />
        </aside>
        <div className="flex min-w-0 flex-col gap-6">
          <TreeChart
            data={tree.data}
            stale={tree.isPlaceholderData}
            steps={steps}
            scheme={scheme}
            american={american}
            onStepsChange={setSteps}
            onSchemeChange={setScheme}
          />
          <div className="grid gap-6 xl:grid-cols-2">
            <PDESlicesChart
              data={grid.data}
              stale={grid.isPlaceholderData}
              strike={settled.strike}
              expiry={settled.expiry}
            />
            <ExerciseBoundaryChart
              data={grid.data}
              stale={grid.isPlaceholderData}
              strike={settled.strike}
              expiry={settled.expiry}
              american={american}
              kind={settled.kind}
            />
          </div>
        </div>
      </div>
    </>
  )
}
