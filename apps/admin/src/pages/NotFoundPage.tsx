import { Compass } from 'lucide-react'
import { ButtonLink } from '../components/ui/button'
import { Card, EmptyState } from '../components/ui/misc'

export default function NotFoundPage() {
  return (
    <Card>
      <EmptyState
        icon={<Compass />}
        title="Page not found"
        description="The page you're looking for doesn't exist or has moved."
        action={<ButtonLink to="/">Back to dashboard</ButtonLink>}
        className="py-24"
      />
    </Card>
  )
}
