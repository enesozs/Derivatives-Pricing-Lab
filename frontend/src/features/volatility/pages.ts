import { lazy } from 'react'

export const loadSurface = () => import('./surface/surface-page')
export const loadModels = () => import('./models/models-page')
export const loadCalibration = () => import('./calibration/calibration-page')

export const SurfacePage = lazy(loadSurface)
export const ModelsPage = lazy(loadModels)
export const CalibrationPage = lazy(loadCalibration)
