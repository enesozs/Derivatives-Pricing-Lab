import { Suspense } from 'react'
import { Outlet } from 'react-router'
import { PageFallback } from '@/components/page-fallback'

export function LearnLayout() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Outlet />
    </Suspense>
  )
}
