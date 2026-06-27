import { TestimonyReview } from '@/domain/entities/Testimony'

interface Props {
  telegramId: number
  firstName:  string | null
  lastName:   string | null
  username:   string | null
  language:   string
  createdAt:  Date
  review:     TestimonyReview
}

export function TestimonyMeta({ telegramId, firstName, lastName, username, language, createdAt }: Props) {
  const fullName = [firstName, lastName].filter(Boolean).join(' ') || null

  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm mb-6">
      {fullName && (
        <>
          <dt className="text-gray-500">Name</dt>
          <dd className="font-medium">{fullName}</dd>
        </>
      )}
      {username && (
        <>
          <dt className="text-gray-500">Username</dt>
          <dd>@{username}</dd>
        </>
      )}
      <dt className="text-gray-500">Telegram ID</dt>
      <dd data-testid="meta-telegram-id" className="font-medium">{telegramId}</dd>

      <dt className="text-gray-500">Language</dt>
      <dd data-testid="meta-language">{language}</dd>

      <dt className="text-gray-500">Created at</dt>
      <dd data-testid="meta-created-at">{createdAt.toISOString()}</dd>
    </dl>
  )
}
