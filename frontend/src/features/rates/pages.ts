import { lazy } from 'react'

export const loadCurves = () => import('./curves-page')
export const loadLinear = () => import('./linear-page')
export const loadOptions = () => import('./options-page')
export const loadModels = () => import('./models-page')

export const CurvesPage = lazy(loadCurves)
export const LinearPage = lazy(loadLinear)
export const RateOptionsPage = lazy(loadOptions)
export const ShortRatePage = lazy(loadModels)
