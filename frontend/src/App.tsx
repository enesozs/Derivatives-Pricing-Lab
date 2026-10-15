import { Navigate, Route, Routes } from 'react-router'
import { AppShell } from '@/components/app-shell'
import NotFound from '@/components/not-found'
import { VanillaLayout } from '@/features/vanilla/layout'
import { ImpliedVolPage, PricerPage, StrategiesPage } from '@/features/vanilla/pages'

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Navigate to="/vanilla" replace />} />
        <Route path="vanilla" element={<VanillaLayout />}>
          <Route index element={<PricerPage />} />
          <Route path="implied-vol" element={<ImpliedVolPage />} />
          <Route path="strategies" element={<StrategiesPage />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
