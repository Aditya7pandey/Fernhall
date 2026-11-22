import { ArrowRight } from 'lucide-react'
import { ButtonLink } from '../components/ui/Button'

export function NotFoundPage({ title = "This page wandered off" }: { title?: string }) {
  return (
    <div className="container-page flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
      <p className="font-display text-[7rem] leading-none font-bold text-sand-2 sm:text-[10rem]">404</p>
      <h1 className="mt-2 text-3xl sm:text-4xl">{title}</h1>
      <p className="mt-3 max-w-sm text-muted">We couldn't find what you were looking for. It may have moved, or never existed.</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <ButtonLink to="/">Back home</ButtonLink>
        <ButtonLink to="/shop" variant="outline">
          Browse the shop <ArrowRight className="size-4" />
        </ButtonLink>
      </div>
    </div>
  )
}
