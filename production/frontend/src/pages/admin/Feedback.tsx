import { useMemo, useState } from 'react'

import { AdminLayout } from '@/components/AdminLayout'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  FeedbackApiError,
  useFeedbackQueue,
  useUpdateFeedback,
  type FeedbackItem,
  type FeedbackStatus,
} from '@/hooks/useFeedback'

type StatusFilter = 'all' | FeedbackStatus

const FILTER_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'new', label: 'New' },
  { value: 'triaged', label: 'Triaged' },
  { value: 'done', label: 'Done' },
]

const STATUS_VARIANT: Record<FeedbackStatus, 'warning' | 'info' | 'success'> = {
  new: 'warning',
  triaged: 'info',
  done: 'success',
}

const STATUS_FEEDBACK: Record<FeedbackStatus, string> = {
  new: 'reopened.',
  triaged: 'marked as triaged.',
  done: 'marked as done.',
}

function itemLabel(item: FeedbackItem): string {
  return `${item.type} from ${item.submitted_by}`
}

function formatWhen(value: string): string {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '—'
  return parsed.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function contextLine(item: FeedbackItem): string {
  return [item.page, item.role, item.viewport, formatWhen(item.created_at)]
    .filter(Boolean)
    .join(' · ')
}

export function Feedback() {
  const { data: items, isLoading, isError, error } = useFeedbackQueue()
  const updateMutation = useUpdateFeedback()

  const [filter, setFilter] = useState<StatusFilter>('new')
  const [feedback, setFeedback] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const itemList = items ?? []

  const counts = useMemo(() => {
    const base = { all: itemList.length, new: 0, triaged: 0, done: 0 }
    for (const item of itemList) {
      base[item.status] += 1
    }
    return base
  }, [itemList])

  const visibleItems = useMemo(
    () => (filter === 'all' ? itemList : itemList.filter((item) => item.status === filter)),
    [itemList, filter],
  )

  const changeStatus = async (item: FeedbackItem, status: FeedbackStatus) => {
    setFeedback(null)
    setActionError(null)

    try {
      await updateMutation.mutateAsync({ id: item.id, status })
      setFeedback(`Feedback from ${item.submitted_by} ${STATUS_FEEDBACK[status]}`)
    } catch (err) {
      setActionError(
        err instanceof FeedbackApiError ? err.message : 'Failed to update feedback',
      )
    }
  }

  return (
    <AdminLayout
      title="Feedback"
      breadcrumb={[{ label: 'Dashboard', href: '/admin' }, { label: 'Feedback' }]}
    >
      <div className="grid gap-6">
        {feedback && (
          <Alert variant="success" role="status" aria-live="polite">
            {feedback}
          </Alert>
        )}

        {actionError && <Alert variant="destructive">{actionError}</Alert>}

        {isLoading && (
          <div
            role="status"
            className="text-sm text-gray-600 border border-gray-200 rounded-md p-4"
          >
            Loading feedback...
          </div>
        )}

        {isError && !isLoading && (
          <Alert variant="destructive">
            {error instanceof Error ? error.message : 'Unable to load feedback.'}
          </Alert>
        )}

        {!isLoading && !isError && (
          <section aria-label="Feedback queue" className="grid gap-3">
            <div className="flex flex-wrap gap-2">
              {FILTER_OPTIONS.map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  size="sm"
                  variant={filter === option.value ? 'default' : 'outline'}
                  aria-pressed={filter === option.value}
                  onClick={() => setFilter(option.value)}
                >
                  {option.label} ({counts[option.value]})
                </Button>
              ))}
            </div>

            {visibleItems.length === 0 && (
              <div className="text-sm text-gray-600 border border-gray-200 rounded-md p-4">
                {filter === 'all'
                  ? 'No feedback yet — when guests spot something, it lands here.'
                  : `No ${filter} feedback.`}
              </div>
            )}

            {visibleItems.map((item) => (
              <Card
                key={item.id}
                className="flex flex-wrap items-start justify-between gap-3 p-4"
              >
                <div className="grid gap-1.5 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant={item.type === 'bug' ? 'danger' : 'info'}
                      className="capitalize"
                    >
                      {item.type === 'bug' ? '🐞 bug' : '💡 idea'}
                    </Badge>
                    <Badge variant={STATUS_VARIANT[item.status]} className="capitalize">
                      {item.status}
                    </Badge>
                    <span className="text-sm text-gray-600">
                      from {item.submitted_by}
                    </span>
                  </div>
                  <p className="m-0 text-sm text-gray-900 whitespace-pre-wrap">
                    {item.message}
                  </p>
                  <p className="m-0 text-xs text-gray-500">{contextLine(item)}</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {item.status === 'new' && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      aria-label={`Triage ${itemLabel(item)}`}
                      disabled={updateMutation.isPending}
                      onClick={() => void changeStatus(item, 'triaged')}
                    >
                      Triage
                    </Button>
                  )}
                  {item.status !== 'done' && (
                    <Button
                      type="button"
                      variant="default"
                      size="sm"
                      aria-label={`Mark ${itemLabel(item)} done`}
                      disabled={updateMutation.isPending}
                      onClick={() => void changeStatus(item, 'done')}
                    >
                      Done
                    </Button>
                  )}
                  {item.status === 'done' && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      aria-label={`Reopen ${itemLabel(item)}`}
                      disabled={updateMutation.isPending}
                      onClick={() => void changeStatus(item, 'new')}
                    >
                      Reopen
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </section>
        )}
      </div>
    </AdminLayout>
  )
}
