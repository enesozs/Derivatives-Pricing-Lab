import { AlertTriangleIcon } from 'lucide-react'
import { useState } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { ConvergenceSection } from './convergence-section'
import { GreekChart } from './greek-chart'
import { MethodsTable } from './methods-table'
import { ParameterPanel } from './parameter-panel'
import { DEFAULT_PARAMS } from './params'
import { useVanilla } from './use-vanilla'
import { ValueChart } from './value-chart'
import { ValueSummary } from './value-summary'

export function VanillaLab() {
  const [params, setParams] = useState(DEFAULT_PARAMS)
  const { settled, price, profile, convergence } = useVanilla(params)
  const error = price.error ?? profile.error ?? convergence.error

  return (
    <div className="grid gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
      <aside className="lg:sticky lg:top-20 lg:self-start">
        <ParameterPanel params={params} onChange={setParams} />
      </aside>

      <div className="flex min-w-0 flex-col gap-6">
        {error && (
          <Alert variant="error">
            <AlertTriangleIcon />
            <AlertTitle>Pricing failed</AlertTitle>
            <AlertDescription>{error.message}</AlertDescription>
          </Alert>
        )}
        <ValueSummary params={settled} data={price.data} stale={price.isPlaceholderData} />
        <div className="grid gap-6 xl:grid-cols-2">
          <ValueChart params={settled} data={profile.data} stale={profile.isPlaceholderData} />
          <GreekChart params={settled} data={profile.data} stale={profile.isPlaceholderData} />
        </div>
        <MethodsTable data={price.data} stale={price.isPlaceholderData} />
        <ConvergenceSection data={convergence.data} stale={convergence.isPlaceholderData} />
      </div>
    </div>
  )
}
