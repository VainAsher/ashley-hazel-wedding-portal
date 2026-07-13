import { PagedDeck, type PagedDeckPage } from '../components/PagedDeck'
import { usePageTitle } from '../hooks/usePageTitle'
import { Blessings } from './Blessings'
import { Dashboard } from './Dashboard'
import { RSVP } from './RSVP'
import { Schedule } from './Schedule'

// Phase 0 spike (Wave 4 item 17, docs/specs/VIEWPORT_PAGING_SPIKE.md).
//
// A throwaway prototype, deliberately isolated from the live guest
// experience: a brand-new admin-gated route rendering the same 4 guest
// pages (unmodified, real data) inside a horizontal swipeable deck instead
// of the normal scrolling GuestLayout flow. If the couple says "no-go",
// this file, PagedDeck.tsx, and the /preview route can be deleted with zero
// impact on anything else in the app.
const PREVIEW_PAGES: PagedDeckPage[] = [
  { id: 'dashboard', label: 'Dashboard', content: <Dashboard /> },
  { id: 'rsvp', label: 'RSVP', content: <RSVP /> },
  { id: 'schedule', label: 'Schedule', content: <Schedule /> },
  { id: 'blessings', label: 'Blessings', content: <Blessings /> },
]

export function PreviewPaged() {
  usePageTitle('Preview (prototype)')

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden">
      {/* Fixed (not absolute) so it stays pinned above every slide's own
          content, including each guest page's own sticky header, no matter
          how far the guest scrolls a slide's internal content. */}
      <div
        role="status"
        className="fixed inset-x-0 top-0 z-[60] bg-yellow-300 px-3 py-1 text-center text-xs font-semibold uppercase tracking-wide text-black"
      >
        Prototype — internal review only
      </div>

      <PagedDeck pages={PREVIEW_PAGES} />
    </div>
  )
}
