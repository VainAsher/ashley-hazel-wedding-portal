import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { Music2, Users } from 'lucide-react'

import { ProfileAvatar, ProfileCard } from '../components/profiles/ProfileCard'
import { Alert } from '../components/ui/alert'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { usePageTitle } from '../hooks/usePageTitle'
import {
  ProfilesApiError,
  useMyProfile,
  useProfileDirectory,
  useUpdateMyProfile,
  useUploadMyProfilePhoto,
  type ProfileDirectoryEntry,
} from '../hooks/useProfiles'

const PARTY_HEADINGS: Record<'stag' | 'hen', string> = {
  stag: 'Stag Do',
  hen: 'Hen Do',
}

function WeddingPartyDirectory() {
  const { data: entries, isLoading, isError, error } = useProfileDirectory()

  if (isLoading) {
    return (
      <div role="status" className="text-sm text-gray-600">
        Loading the wedding party...
      </div>
    )
  }

  if (isError) {
    return (
      <Alert variant="destructive">
        {error instanceof Error ? error.message : 'Unable to load the wedding party.'}
      </Alert>
    )
  }

  const grouped = (entries ?? []).reduce<Record<string, ProfileDirectoryEntry[]>>(
    (acc, entry) => {
      const bucket = acc[entry.party] ?? []
      bucket.push(entry)
      acc[entry.party] = bucket
      return acc
    },
    {},
  )

  const parties = (['stag', 'hen'] as const).filter((party) => grouped[party]?.length)

  if (parties.length === 0) {
    return (
      <Card className="flex flex-col items-center justify-center gap-3 p-10 text-center">
        <Users className="h-10 w-10 text-gray-400" aria-hidden="true" />
        <div>
          <h3 className="m-0 text-base font-semibold text-gray-900">No wedding party yet</h3>
          <p className="m-0 mt-1 text-sm text-gray-600">
            Check back once the Stag and Hen parties have been set up.
          </p>
        </div>
      </Card>
    )
  }

  return (
    <div className="grid gap-8">
      {parties.map((party) => (
        <section key={party} aria-label={PARTY_HEADINGS[party]}>
          <h2 className="mb-3 font-display text-2xl text-plum">{PARTY_HEADINGS[party]}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {grouped[party].map((entry) => (
              <ProfileCard key={entry.invite_id} entry={entry} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

function MyProfileEditor() {
  const { data: profile, isLoading } = useMyProfile()
  const updateMutation = useUpdateMyProfile()
  const uploadPhotoMutation = useUploadMyProfilePhoto()

  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [displayName, setDisplayName] = useState('')
  const [roleTitle, setRoleTitle] = useState('')
  const [about, setAbout] = useState('')
  const [bestKnownFor, setBestKnownFor] = useState('')
  const [favouriteSong, setFavouriteSong] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name ?? '')
      setRoleTitle(profile.role_title ?? '')
      setAbout(profile.about ?? '')
      setBestKnownFor(profile.best_known_for ?? '')
      setFavouriteSong(profile.favourite_song ?? '')
    }
  }, [profile])

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div role="status" className="text-sm text-gray-600">
            Loading your profile...
          </div>
        </CardContent>
      </Card>
    )
  }

  // null means the invite has no `party` flag (not eligible for a profile
  // at all); undefined only happens if the query errored with no cached
  // value. Either way, there's nothing to show here.
  if (!profile) {
    return null
  }

  const isEmpty = !profile.display_name && !profile.about && !profile.best_known_for

  const handlePhotoChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }
    setFormError(null)
    setFeedback(null)
    try {
      await uploadPhotoMutation.mutateAsync(file)
      setFeedback('Photo updated.')
    } catch (err) {
      setFormError(err instanceof ProfilesApiError ? err.message : 'Unable to upload photo.')
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFormError(null)
    setFeedback(null)
    try {
      await updateMutation.mutateAsync({
        display_name: displayName,
        role_title: roleTitle,
        about,
        best_known_for: bestKnownFor,
        favourite_song: favouriteSong,
      })
      setFeedback('Your profile has been saved.')
    } catch (err) {
      setFormError(err instanceof ProfilesApiError ? err.message : 'Unable to save your profile.')
    }
  }

  const isSaving = updateMutation.isPending
  const isUploadingPhoto = uploadPhotoMutation.isPending

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">My profile</CardTitle>
        <CardDescription>
          {isEmpty
            ? "You haven't filled this in yet — everyone can currently see just your name and role. Add a bit about yourself below."
            : 'Update your details any time — guests see this on the Wedding Party page.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form noValidate onSubmit={handleSubmit} className="grid gap-4">
          {formError && <Alert variant="destructive">{formError}</Alert>}
          {feedback && (
            <Alert variant="success" role="status" aria-live="polite">
              {feedback}
            </Alert>
          )}

          <div className="flex items-center gap-4">
            <ProfileAvatar name={displayName || 'Me'} photoUrl={profile.photo_url} />
            <div className="grid gap-2">
              <Label htmlFor="profile-photo">Photo</Label>
              <Input
                ref={fileInputRef}
                id="profile-photo"
                type="file"
                accept="image/*"
                onChange={handlePhotoChange}
                disabled={isUploadingPhoto}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="profile-display-name">Display name</Label>
              <Input
                id="profile-display-name"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                maxLength={100}
                placeholder="How should guests see your name?"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="profile-role-title">Role title</Label>
              <Input
                id="profile-role-title"
                value={roleTitle}
                onChange={(event) => setRoleTitle(event.target.value)}
                maxLength={100}
                placeholder="e.g. Best Man, Bridesmaid"
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="profile-about">About</Label>
            <textarea
              id="profile-about"
              value={about}
              onChange={(event) => setAbout(event.target.value)}
              rows={4}
              maxLength={1000}
              placeholder="A little about you..."
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-base resize-vertical focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="profile-best-known-for">Best known for</Label>
              <Input
                id="profile-best-known-for"
                value={bestKnownFor}
                onChange={(event) => setBestKnownFor(event.target.value)}
                maxLength={200}
                placeholder="What are you famous for?"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="profile-favourite-song">
                <span className="inline-flex items-center gap-1">
                  <Music2 className="h-3.5 w-3.5" aria-hidden="true" />
                  Favourite song
                </span>
              </Label>
              <Input
                id="profile-favourite-song"
                value={favouriteSong}
                onChange={(event) => setFavouriteSong(event.target.value)}
                maxLength={200}
                placeholder="What gets you on the dancefloor?"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

// The actual page content, no GuestLayout wrapper -- App.tsx routes directly
// to this (both in scroll mode, via the shared PagedGuestLayoutRoute's
// <Outlet/>, and in paged mode, mounted inside PagedGuestDeck). See
// docs/specs/VIEWPORT_PAGING_PHASE1.md.
export function WeddingPartyContent() {
  usePageTitle('Wedding Party')

  return (
      <div className="max-w-5xl mx-auto w-full grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Meet the wedding party</CardTitle>
            <CardDescription>
              The Stag and Hen crews making sure the big day goes off properly.
            </CardDescription>
          </CardHeader>
        </Card>

        <MyProfileEditor />

        <WeddingPartyDirectory />
      </div>
  )
}
