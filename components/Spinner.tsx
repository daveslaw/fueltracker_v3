type Props = {
  className?: string
}

export function Spinner({ className }: Props) {
  return <span className={`loader ${className ?? ''}`} />
}
