import Link from 'next/link'
import { TestimonyListItem } from '@/domain/entities/Testimony'

interface Props {
  items: TestimonyListItem[]
}

export function TestimoniesTable({ items }: Props) {
  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b bg-gray-50 text-left text-gray-500">
          <th className="px-4 py-2">Telegram ID</th>
          <th className="px-4 py-2">Язык</th>
          <th className="px-4 py-2">Дата</th>
          <th className="px-4 py-2">Статус</th>
        </tr>
      </thead>
      <tbody>
        {items.map(item => (
          <tr key={item.id} className="border-b hover:bg-gray-50">
            <td className="px-4 py-2">
              <Link href={`/admin/testimonies/${item.id}`} className="text-blue-600 hover:underline">
                <span data-testid="cell-telegram-id">{item.telegramId}</span>
              </Link>
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
