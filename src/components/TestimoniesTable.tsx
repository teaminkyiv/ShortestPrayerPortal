import Link from 'next/link'
import { TestimonyListItem } from '@/domain/entities/Testimony'

interface Props {
  items: TestimonyListItem[]
}

function displayName(item: TestimonyListItem): string {
  const full = [item.firstName, item.lastName].filter(Boolean).join(' ')
  if (full) return full
  if (item.username) return `@${item.username}`
  return String(item.telegramId)
}

export function TestimoniesTable({ items }: Props) {
  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b bg-gray-50 text-left text-gray-500">
          <th className="px-4 py-2">User</th>
          <th className="px-4 py-2">Language</th>
          <th className="px-4 py-2">Date</th>
          <th className="px-4 py-2">Status</th>
        </tr>
      </thead>
      <tbody>
        {items.map(item => (
          <tr key={item.id} className="border-b hover:bg-gray-50">
            <td className="px-4 py-2">
              <Link href={`/admin/testimonies/${item.id}`} className="text-blue-600 hover:underline">
                <span data-testid="cell-telegram-id">{displayName(item)}</span>
              </Link>
              {(item.firstName || item.username) && (
                <span className="ml-2 text-xs text-gray-400">#{item.telegramId}</span>
              )}
            </td>
            <td className="px-4 py-2" data-testid="cell-language">{item.language}</td>
            <td className="px-4 py-2" data-testid="cell-date">
              {item.createdAt.toISOString()}
            </td>
            <td className="px-4 py-2" data-testid="cell-status">{item.status}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
