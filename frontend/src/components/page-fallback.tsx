import { Spinner } from '@/components/ui/spinner'

/** Shown while a lazily loaded page's code arrives. */
export function PageFallback() {
  return (
    <div className="flex h-96 items-center justify-center text-muted-foreground">
      <Spinner />
    </div>
  )
}
