import { useEffect, useState } from 'react'

import { AdminLayout } from '@/components/AdminLayout'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useSettings } from '@/hooks/useSettings'

interface SettingsFormState {
  weddingName: string
  weddingDate: string
  venue: string
}

export function Settings() {
  const { data: settings, isLoading, isError, error } = useSettings()

  const [form, setForm] = useState<SettingsFormState>({
    weddingName: '',
    weddingDate: '',
    venue: '',
  })

  useEffect(() => {
    if (settings) {
      setForm({
        weddingName: settings.wedding_name ?? '',
        weddingDate: settings.wedding_date ?? '',
        venue: settings.venue ?? '',
      })
    }
  }, [settings])

  const updateField = <K extends keyof SettingsFormState>(
    key: K,
    value: SettingsFormState[K],
  ) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  return (
    <AdminLayout
      title="Settings"
      breadcrumb={[{ label: 'Dashboard', href: '/admin' }, { label: 'Settings' }]}
    >
      <div className="grid gap-4">
        <section>
          <h2 className="text-xl font-semibold text-gray-900 m-0">Wedding Settings</h2>
          <p className="text-sm text-gray-600 m-0 mt-1">
            Manage the core details of the wedding.
          </p>
        </section>

        {isLoading && (
          <div role="status" className="text-sm text-gray-600 border border-gray-200 rounded-md p-4">
            Loading settings...
          </div>
        )}

        {isError && !isLoading && (
          <Alert variant="destructive">
            {error instanceof Error ? error.message : 'Failed to load settings'}
          </Alert>
        )}

        {!isLoading && !isError && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Details</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                className="grid gap-4"
                onSubmit={(event) => event.preventDefault()}
                aria-label="Wedding settings form"
              >
                <div className="grid gap-2">
                  <Label htmlFor="settings-wedding-name">Wedding Name</Label>
                  <Input
                    id="settings-wedding-name"
                    value={form.weddingName}
                    onChange={(event) => updateField('weddingName', event.target.value)}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="settings-wedding-date">Wedding Date</Label>
                  <Input
                    id="settings-wedding-date"
                    type="date"
                    value={form.weddingDate}
                    onChange={(event) => updateField('weddingDate', event.target.value)}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="settings-venue">Venue</Label>
                  <Input
                    id="settings-venue"
                    value={form.venue}
                    onChange={(event) => updateField('venue', event.target.value)}
                  />
                </div>

                <div>
                  <Button type="submit" disabled>
                    Save (coming soon)
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  )
}
