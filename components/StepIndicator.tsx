import Link from 'next/link'

export type StepStatus = 'complete' | 'current' | 'upcoming'

export interface Step {
  label: string
  href: string
  status: StepStatus
}

interface Props {
  steps: Step[]
  currentIndex: number
}

export function StepIndicator({ steps, currentIndex }: Props) {
  const prev = currentIndex > 0 ? steps[currentIndex - 1] : null
  const next = currentIndex < steps.length - 1 ? steps[currentIndex + 1] : null

  return (
    <nav aria-label="Step indicator" className="flex items-center gap-2 text-sm">
      {prev && (
        <Link href={prev.href} aria-label="Previous step" className="text-muted-foreground hover:text-foreground">
          ←
        </Link>
      )}

      <ol className="flex items-center gap-1">
        {steps.map((step, i) => {
          const number = i + 1
          if (step.status === 'complete') {
            return (
              <li key={step.href}>
                <Link href={step.href} className="text-foreground underline-offset-2 hover:underline">
                  {number}. {step.label}
                </Link>
              </li>
            )
          }
          if (step.status === 'current') {
            return (
              <li key={step.href} aria-current="step" className="font-medium">
                {number}. {step.label}
              </li>
            )
          }
          return (
            <li key={step.href} className="text-muted-foreground">
              {number}. {step.label}
            </li>
          )
        })}
      </ol>

      {next && (
        <Link href={next.href} aria-label="Next step" className="text-muted-foreground hover:text-foreground">
          →
        </Link>
      )}
    </nav>
  )
}
