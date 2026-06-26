import { TestimonyStatus } from '@/domain/entities/Testimony'

interface Props {
  label: TestimonyStatus
  count: number
}

export function StatusCounter({ label, count }: Props) {
  const highlight = label === 'new' && count > 0

  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm text-center">
      <p className="text-sm uppercase text-gray-500 mb-1">{label}</p>
      <p
        data-testid={`counter-${label}`}
        className={`text-3xl font-bold ${highlight ? 'text-red-600' : 'text-gray-800'}`}
      >
        {count}
      </p>
    </div>
  )
}
