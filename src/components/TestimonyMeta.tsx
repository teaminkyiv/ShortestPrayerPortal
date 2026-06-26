// src/components/TestimonyMeta.tsx (final — no meta-status, no meta-summarized-at)
import { TestimonyReview } from '@/domain/entities/Testimony'

interface Props {
  telegramId: number
  language:   string
  createdAt:  Date
  review:     TestimonyReview
}

export function TestimonyMeta({ telegramId, language, createdAt, review }: Props) {
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm mb-6">
      <dt className="text-gray-500">Telegram ID</dt>
      <dd data-testid="meta-telegram-id" className="font-medium">{telegramId}</dd>

      <dt className="text-gray-500">Язык</dt>
      <dd data-testid="meta-language">{language}</dd>

      <dt className="text-gray-500">Дата создания</dt>
      <dd data-testid="meta-created-at">{createdAt.toISOString()}</dd>
    </dl>
  )
}
