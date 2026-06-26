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
        <div key={chunk.id} data-testid="chunk-item" className="rounded border bg-white p-3">
          <div className="flex items-baseline gap-3">
            <span
              data-testid="chunk-index"
              className="text-xs font-bold text-gray-400 w-6 shrink-0"
            >
              {i + 1}
            </span>
            <time
              data-testid="chunk-timestamp"
              dateTime={chunk.createdAt.toISOString()}
              className="text-xs text-gray-400 shrink-0"
            >
              {chunk.createdAt.toLocaleString('ru-RU')}
            </time>
            <p className="text-sm text-gray-800">{chunk.text}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
