import { Link } from 'react-router-dom'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { NotificationItem } from '@/hooks/useNotifications'
import { formatRelativeTime } from '@/lib/relativeTime'

interface NotificationDetailDialogProps {
  item: NotificationItem | null
  onOpenChange: (open: boolean) => void
}

/**
 * Full-message view shared by the dashboard Messages card and the header
 * bell -- both lists show only an 80-character snippet, so anything past
 * that needs somewhere to actually be read in full.
 */
export function NotificationDetailDialog({ item, onOpenChange }: NotificationDetailDialogProps) {
  return (
    <Dialog open={item !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        {item && (
          <>
            <DialogHeader>
              <DialogTitle>{item.title}</DialogTitle>
              <DialogDescription>{formatRelativeTime(item.created_at)}</DialogDescription>
            </DialogHeader>
            {item.body && (
              <p className="m-0 whitespace-pre-wrap text-sm text-gray-700">{item.body}</p>
            )}
            {item.link_path && (
              <Link
                to={item.link_path}
                onClick={() => onOpenChange(false)}
                className="text-sm font-medium text-plum underline hover:text-plum/80"
              >
                Go to this page
              </Link>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
