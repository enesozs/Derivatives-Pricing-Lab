import { Navigate, Route, Routes } from 'react-router'
import { AppShell } from '@/components/app-shell'
import NotFound from '@/components/not-found'
import { ExoticsLayout } from '@/features/exotics/layout'
import { AmericanPage, ExoticPricerPage } from '@/features/exotics/pages'
import { MultiAssetLayout } from '@/features/multi-asset/layout'
import { CorrelationPage, QuantoPage } from '@/features/multi-asset/pages'
import { RatesLayout } from '@/features/rates/layout'
import { CurvesPage, LinearPage, RateOptionsPage, ShortRatePage } from '@/features/rates/pages'
import { VanillaLayout } from '@/features/vanilla/layout'
import { VolatilityLayout } from '@/features/volatility/layout'
import { CalibrationPage, ModelsPage, SurfacePage } from '@/features/volatility/pages'
import {
  HedgingPage,
  ImpliedVolPage,
  MethodsPage,
  PricerPage,
  StrategiesPage,
} from '@/features/vanilla/pages'

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Navigate to="/vanilla" replace />} />
        <Route path="vanilla" element={<VanillaLayout />}>
          <Route index element={<PricerPage />} />
          <Route path="implied-vol" element={<ImpliedVolPage />} />
          <Route path="methods" element={<MethodsPage />} />
          <Route path="strategies" element={<StrategiesPage />} />
          <Route path="hedging" element={<HedgingPage />} />
        </Route>
        <Route path="volatility" element={<VolatilityLayout />}>
          <Route index element={<SurfacePage />} />
          <Route path="models" element={<ModelsPage />} />
          <Route path="calibration" element={<CalibrationPage />} />
        </Route>
        <Route path="exotics" element={<ExoticsLayout />}>
          <Route index element={<ExoticPricerPage />} />
          <Route path="american" element={<AmericanPage />} />
        </Route>
        <Route path="multi-asset" element={<MultiAssetLayout />}>
          <Route index element={<CorrelationPage />} />
          <Route path="quanto" element={<QuantoPage />} />
        </Route>
        <Route path="rates" element={<RatesLayout />}>
          <Route index element={<CurvesPage />} />
          <Route path="linear" element={<LinearPage />} />
          <Route path="options" element={<RateOptionsPage />} />
          <Route path="models" element={<ShortRatePage />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
