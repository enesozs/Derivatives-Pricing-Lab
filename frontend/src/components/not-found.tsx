import { Link } from 'react-router'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <div className="flex h-96 flex-col items-center justify-center gap-3 text-center">
      <p className="font-semibold text-lg">Page not found</p>
      <p className="text-muted-foreground text-sm">This part of the lab doesn't exist (yet).</p>
      <Button variant="outline" size="sm" render={<Link to="/vanilla" />}>
        Back to vanilla options
      </Button>
    </div>
  )
}
