# Video upload (Wave 4 item 19)

## Decision (couple, 2026-07-13)
Direct `.mp4` upload, not external links. Guests and the couple can both upload,
matching current gallery permissions exactly (guest → pending/moderated,
coordinator/couple → auto-approved). Size cap **150MB**. No transcoding — the
file is served back exactly as uploaded (desktop-exported H.264 `.mp4` is the
supported case; anything a browser's `<video>` tag can't play is the uploader's
problem, same as an unsupported image format today).

## Schema
**No migration.** `gallery_items.content_type` is already a free-form
`String(100)` with no CHECK constraint restricting it to images — storing
`"video/mp4"` is schema-safe today. `file_size` (Integer) already exists.

## Backend (`app/api/gallery.py`)
- `save_upload()`: extend the content-type gate from `startswith("image/")` to
  also accept the exact value `"video/mp4"`. Reject every other `video/*`
  (`.mov`, `.webm`, etc.) with the existing 400, same message shape as today's
  image-only rejection, but mention video is mp4-only.
- Add an explicit size check in `save_upload()` — read `Content-Length` (FastAPI/
  Starlette exposes it via `request.headers` or, simplest, check `len(data)`
  after `await file.read()`) and raise `413 Payload Too Large` above
  `150 * 1024 * 1024` bytes. This is a real gap today (nginx is the only size
  gate currently) and matters more once uploads can be 6x larger.
- `generate_thumbnail()`: already gracefully returns `None` for any
  `content_type` not in `THUMBNAIL_SOURCE_TYPES` (which stays image-only — no
  video frame extraction, no new dependency). Videos simply get `thumb_path =
  None`, exactly like an unsupported image format does today.
- `upload_gallery_item` / `submit_gallery_item`: no change beyond what
  `save_upload` already does — both already call it generically.

## nginx (`production/frontend/nginx.conf`)
Add a **dedicated location block for `/api/gallery`** (nginx matches the more
specific prefix over the general `/api/` block) with
`client_max_body_size 160m` — headroom above the 150MB app-level cap so nginx
never clips a request the backend would otherwise reject with a clean 413.
Leave the general `/api/` block at `25m` unchanged (no reason to raise the
body-size ceiling on every other endpoint).

## Frontend
- `src/pages/Gallery.tsx` upload form: `accept="image/*,video/mp4"`, hint text
  updated ("Photos or short videos (MP4), up to 150 MB.").
- `GalleryGrid`: branch on `photo.content_type?.startsWith('video/')` — since
  there's no thumbnail for video, render a fixed dark tile with a centered
  `Play` icon (lucide-react, already a dependency) instead of attempting
  `<img src={photo.thumb_url ?? photo.url}>` against a video file (which would
  fail to load). Clicking still opens the lightbox as normal.
- `Lightbox`: branch the same way — `<video controls className="...">` in
  place of `<img>` when the content type is video. Keep `autoPlay={false}`
  (respect the user tapping play) and drop the slideshow-advance behavior for
  video slides specifically (don't auto-advance mid-playback — pause the
  slideshow timer while the current slide is a video).
- `src/pages/admin/Gallery.tsx` moderation grid: same video-tile treatment as
  the guest grid so coordinators can tell what they're approving without
  guessing from the filename.
- `src/api/gallery.ts` / `useGallery.ts` types: no shape change — `content_type`
  is already on `GalleryItem`, just newly meaningful.

## Tests
- Backend: `save_upload` accepts `video/mp4` up to the cap, rejects
  `video/quicktime` (and other non-mp4 video types) with 400, rejects an
  over-cap payload with 413, confirms `thumb_path` stays `None` for a video
  row and the row is otherwise identical in shape to an image row. Guest
  submit → pending; coordinator upload → approved (mirrors the existing image
  test pattern, just with a tiny generated `.mp4` fixture instead of a tiny
  generated image).
- Frontend (Playwright): upload a small video fixture as a guest → appears
  pending in admin; approve it → shows as a play-tile in the guest grid;
  opening the lightbox renders a `<video>` element with the correct `src`.

## Out of scope
No transcoding, no HEVC/mobile-codec normalization, no server-side thumbnail
frame extraction, no upload progress bar (existing photo upload has none
either — same UX, just may take longer for a 150MB file on a slow connection).
