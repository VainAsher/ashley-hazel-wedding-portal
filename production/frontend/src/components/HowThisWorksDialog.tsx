import { HelpCircle } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

/**
 * Friendly condensed guest guide (rewritten from docs/guides/GUEST_GUIDE.md),
 * opened from a small "How this works" trigger in the GuestLayout footer.
 */

const PAGES: { name: string; blurb: string }[] = [
  {
    name: 'Dashboard',
    blurb: 'Your home page — the countdown, the key details, and quick links to everything.',
  },
  {
    name: 'RSVP',
    blurb: 'Tell Ashley & Hazel if you can make it, note any dietary needs, and add your plus-one.',
  },
  {
    name: 'Schedule',
    blurb: 'The plan for the day — every event with its time and place, in order.',
  },
  {
    name: 'Celebrate',
    blurb:
      'Leave a blessing, request a song for the dancefloor, and browse (or share) photos — each opens right where you are.',
  },
]

export function HowThisWorksDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-full border border-gold/50 bg-transparent px-3 py-1 text-xs font-medium text-cream/90 transition-colors hover:border-gold hover:text-gold"
        >
          <HelpCircle className="h-3.5 w-3.5" aria-hidden="true" />
          How this works
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] w-[calc(100vw-2rem)] max-w-lg overflow-y-auto rounded-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl text-plum">How this works</DialogTitle>
          <DialogDescription>
            Welcome in! Everything lives in the menu at the top — here's what each page is for.
          </DialogDescription>
        </DialogHeader>
        <dl className="m-0 grid gap-3">
          {PAGES.map((page) => (
            <div key={page.name}>
              <dt className="text-sm font-semibold text-plum">{page.name}</dt>
              <dd className="m-0 text-sm text-muted-foreground">{page.blurb}</dd>
            </div>
          ))}
        </dl>
        <p className="m-0 rounded-xl border border-gold/40 bg-cream/60 px-3 py-2 text-xs leading-relaxed text-plum">
          A small heads-up: RSVP and song requests open when Ashley &amp; Hazel flip the site
          live — if you see a "not open yet" note, check back a little closer to the day.
          Meal choices appear on RSVP once the menu's finalised, too.
        </p>
        <p className="m-0 text-xs text-muted-foreground">
          The <strong>bell icon</strong> up top lights up when the couple send you a
          message, and the <strong>💬 Feedback</strong> button in the corner is there
          any time something's not working or you've got an idea.
        </p>
        <p className="m-0 text-xs text-muted-foreground">
          If you're part of the wedding party, keep an eye out for a <strong>Stag Do</strong>
          or <strong>Hen Do</strong> link too — a private space just for that group.
        </p>
        <p className="m-0 text-xs text-muted-foreground">
          Your RSVP details are only ever visible to the couple and their coordinators.
        </p>
      </DialogContent>
    </Dialog>
  )
}
