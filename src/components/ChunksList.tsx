import { Chunk } from '@/domain/entities/Testimony'

interface Props {
  chunks: Chunk[]
}

export function ChunksList({ chunks }: Props) {
  return (
    <div data-testid="chunks-list" className="space-y-2">
      {chunks.length === 0 && (
        <p className="text-gray-400 italic">Нет сообщений</p>
      )}
      {chunks.map((chunk, i) => (
        <div key={chunk.id} data-testid="chunk-item" className="rounded border bg-white p-4">
          <p className="text-sm text-gray-900 whitespace-pre-wrap">{chunk.text}</p>
          <div className="flex gap-3 mt-2">
            <span data-testid="chunk-index" className="text-xs text-gray-400">{i + 1}</span>
            <time data-testid="chunk-timestamp" dateTime={chunk.createdAt.toISOString()} className="text-xs text-gray-400">
              {chunk.createdAt.toLocaleString('ru-RU')}
            </time>
          </div>
        </div>
      ))}
    </div>
  )
}
