'use client'

import { useState } from 'react'
import { AiSummaryPanel } from './AiSummaryPanel'
import { EditPublishPanel } from './EditPublishPanel'

interface Props {
  testimonyId:          string
  initialSummary:       string | null
  initialStatus:        string
  initialSummarizedAt:  string | null
  initialEditedVersion: string | null
  initialPublishedAt:   string | null
  initialPublishedBy:   string | null
}

export function TestimonyDetailClient({
  testimonyId,
  initialSummary,
  initialStatus,
  initialSummarizedAt,
  initialEditedVersion,
  initialPublishedAt,
  initialPublishedBy,
}: Props) {
  const [sharedStatus, setSharedStatus] = useState(initialStatus)

  return (
    <>
      <AiSummaryPanel
        testimonyId={testimonyId}
        initialSummary={initialSummary}
        initialStatus={initialStatus}
        initialSummarizedAt={initialSummarizedAt}
        onStatusChange={setSharedStatus}
        externalStatus={sharedStatus}
      />

      <EditPublishPanel
        testimonyId={testimonyId}
        initialEditedVersion={initialEditedVersion}
        initialAiSummary={initialSummary}
        initialStatus={initialStatus}
        initialPublishedAt={initialPublishedAt}
        initialPublishedBy={initialPublishedBy}
        onStatusChange={setSharedStatus}
      />
    </>
  )
}
