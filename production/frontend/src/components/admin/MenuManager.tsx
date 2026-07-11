import { useEffect, useState, type FormEvent } from 'react'

import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  useCreateMenuOption,
  useDeleteMenuOption,
  useMenuOptions,
  useUpdateMenuOption,
  type MenuOption,
} from '@/hooks/useMenu'
import { SettingsApiError, useSettings, useUpdateSettings } from '@/hooks/useSettings'

interface OptionFormState {
  name: string
  description: string
  is_vegetarian: boolean
  is_vegan: boolean
  is_gluten_free: boolean
}

const emptyOptionForm: OptionFormState = {
  name: '',
  description: '',
  is_vegetarian: false,
  is_vegan: false,
  is_gluten_free: false,
}

function formStateFromOption(option: MenuOption): OptionFormState {
  return {
    name: option.name,
    description: option.description ?? '',
    is_vegetarian: option.is_vegetarian,
    is_vegan: option.is_vegan,
    is_gluten_free: option.is_gluten_free,
  }
}

function errorText(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback
}

interface DietaryChecksProps {
  idPrefix: string
  form: OptionFormState
  onChange: (update: Partial<OptionFormState>) => void
}

function DietaryChecks({ idPrefix, form, onChange }: DietaryChecksProps) {
  const flags = [
    { key: 'is_vegetarian' as const, label: 'Vegetarian' },
    { key: 'is_vegan' as const, label: 'Vegan' },
    { key: 'is_gluten_free' as const, label: 'Gluten-free' },
  ]

  return (
    <div className="flex flex-wrap gap-4">
      {flags.map(({ key, label }) => (
        <label
          key={key}
          htmlFor={`${idPrefix}-${key}`}
          className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer"
        >
          <input
            id={`${idPrefix}-${key}`}
            type="checkbox"
            className="w-4 h-4"
            checked={form[key]}
            onChange={(event) => onChange({ [key]: event.target.checked })}
          />
          {label}
        </label>
      ))}
    </div>
  )
}

function DietaryChips({ option }: { option: MenuOption }) {
  return (
    <>
      {option.is_vegetarian && <Badge variant="success">Vegetarian</Badge>}
      {option.is_vegan && <Badge variant="success">Vegan</Badge>}
      {option.is_gluten_free && <Badge variant="info">Gluten-free</Badge>}
      {!option.active && <Badge variant="neutral">Hidden</Badge>}
    </>
  )
}

export function MenuManager() {
  const { data: options, isLoading, isError, error } = useMenuOptions()
  const { data: settings } = useSettings()
  const updateSettings = useUpdateSettings()
  const createOption = useCreateMenuOption()
  const updateOption = useUpdateMenuOption()
  const deleteOption = useDeleteMenuOption()

  const [addForm, setAddForm] = useState<OptionFormState>(emptyOptionForm)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<OptionFormState>(emptyOptionForm)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  // Optimistic mirror of the settings flag so the checkbox flips on click
  // instead of waiting for the settings refetch.
  const [mealSelectionOpen, setMealSelectionOpen] = useState(false)
  useEffect(() => {
    setMealSelectionOpen(settings?.meal_selection_open ?? false)
  }, [settings?.meal_selection_open])

  const busy =
    createOption.isPending ||
    updateOption.isPending ||
    deleteOption.isPending ||
    updateSettings.isPending

  const notify = (message: string) => {
    setFeedback(message)
    setActionError(null)
  }

  const fail = (err: unknown, fallback: string) => {
    setFeedback(null)
    setActionError(err instanceof SettingsApiError ? err.message : errorText(err, fallback))
  }

  const handleToggleMealSelection = async (open: boolean) => {
    setMealSelectionOpen(open)
    try {
      await updateSettings.mutateAsync({ meal_selection_open: open })
      notify(
        open
          ? 'Meal selection is now open — guests can pick meals in RSVP.'
          : 'Meal selection closed — RSVP is back to dietary notes only.',
      )
    } catch (err) {
      setMealSelectionOpen(!open)
      fail(err, 'Failed to update meal selection')
    }
  }

  const handleAdd = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const name = addForm.name.trim()
    if (!name) {
      setActionError('Option name is required.')
      return
    }
    try {
      await createOption.mutateAsync({
        name,
        description: addForm.description.trim() || null,
        is_vegetarian: addForm.is_vegetarian,
        is_vegan: addForm.is_vegan,
        is_gluten_free: addForm.is_gluten_free,
      })
      setAddForm(emptyOptionForm)
      notify('Menu option added.')
    } catch (err) {
      fail(err, 'Failed to add the menu option')
    }
  }

  const startEdit = (option: MenuOption) => {
    setEditingId(option.id)
    setEditForm(formStateFromOption(option))
  }

  const handleSaveEdit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (editingId === null) {
      return
    }
    const name = editForm.name.trim()
    if (!name) {
      setActionError('Option name is required.')
      return
    }
    try {
      await updateOption.mutateAsync({
        id: editingId,
        payload: {
          name,
          description: editForm.description.trim() || null,
          is_vegetarian: editForm.is_vegetarian,
          is_vegan: editForm.is_vegan,
          is_gluten_free: editForm.is_gluten_free,
        },
      })
      setEditingId(null)
      notify('Menu option updated.')
    } catch (err) {
      fail(err, 'Failed to update the menu option')
    }
  }

  const handleToggleActive = async (option: MenuOption) => {
    try {
      await updateOption.mutateAsync({
        id: option.id,
        payload: { active: !option.active },
      })
      notify(option.active ? 'Option hidden from guests.' : 'Option visible to guests.')
    } catch (err) {
      fail(err, 'Failed to update the menu option')
    }
  }

  const handleDelete = async (option: MenuOption) => {
    try {
      await deleteOption.mutateAsync(option.id)
      notify('Menu option removed from the guest menu.')
    } catch (err) {
      fail(err, 'Failed to remove the menu option')
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Menu</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4" aria-label="Menu builder">
          <p className="text-sm text-gray-600 m-0">
            Build the wedding menu here, then open meal selection when it is final —
            guests pick from these options on the RSVP page.
          </p>

          {feedback && (
            <Alert variant="success" role="status" aria-live="polite">
              {feedback}
            </Alert>
          )}
          {actionError && <Alert variant="destructive">{actionError}</Alert>}

          {/* Open/close switch */}
          <div className="rounded-md border border-gray-200 p-3 grid gap-1">
            <label
              htmlFor="meal-selection-open"
              className="flex items-center gap-2 text-sm font-medium text-gray-900 cursor-pointer"
            >
              <input
                id="meal-selection-open"
                type="checkbox"
                className="w-4 h-4"
                checked={mealSelectionOpen}
                disabled={busy || !settings}
                onChange={(event) => void handleToggleMealSelection(event.target.checked)}
              />
              Meal selection open
            </label>
            <p className="text-xs text-gray-500 m-0">
              While off, guests only leave dietary notes and see “menu opens nearer the
              day”. Switch it on once the menu is final to unlock meal choices (for
              guests and their plus ones) on the RSVP form.
            </p>
          </div>

          {/* Options list */}
          {isLoading && (
            <div role="status" className="text-sm text-gray-600">
              Loading menu...
            </div>
          )}
          {isError && !isLoading && (
            <Alert variant="destructive">
              {error instanceof Error ? error.message : 'Failed to load the menu'}
            </Alert>
          )}

          {!isLoading && !isError && (options ?? []).length === 0 && (
            <p className="text-sm text-gray-600 m-0">No menu options yet — add the first one below.</p>
          )}

          {!isLoading && !isError && (options ?? []).length > 0 && (
            <ul className="grid gap-2 m-0 p-0 list-none">
              {(options ?? []).map((option) =>
                editingId === option.id ? (
                  <li key={option.id} className="rounded-md border border-gray-200 p-3">
                    <form className="grid gap-3" onSubmit={handleSaveEdit} aria-label={`Edit ${option.name}`}>
                      <div className="grid gap-2">
                        <Label htmlFor={`menu-edit-name-${option.id}`}>Name</Label>
                        <Input
                          id={`menu-edit-name-${option.id}`}
                          value={editForm.name}
                          maxLength={100}
                          onChange={(event) =>
                            setEditForm((current) => ({ ...current, name: event.target.value }))
                          }
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor={`menu-edit-description-${option.id}`}>Description</Label>
                        <Input
                          id={`menu-edit-description-${option.id}`}
                          value={editForm.description}
                          onChange={(event) =>
                            setEditForm((current) => ({ ...current, description: event.target.value }))
                          }
                        />
                      </div>
                      <DietaryChecks
                        idPrefix={`menu-edit-${option.id}`}
                        form={editForm}
                        onChange={(update) => setEditForm((current) => ({ ...current, ...update }))}
                      />
                      <div className="flex gap-2">
                        <Button type="submit" size="sm" disabled={busy}>
                          Save option
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => setEditingId(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </form>
                  </li>
                ) : (
                  <li
                    key={option.id}
                    className="rounded-md border border-gray-200 p-3 flex flex-wrap items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 m-0">{option.name}</p>
                      {option.description && (
                        <p className="text-xs text-gray-600 m-0 mt-0.5">{option.description}</p>
                      )}
                      <div className="flex flex-wrap gap-1 mt-1">
                        <DietaryChips option={option} />
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        aria-label={`${option.active ? 'Hide' : 'Show'} ${option.name}`}
                        onClick={() => void handleToggleActive(option)}
                      >
                        {option.active ? 'Hide' : 'Show'}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        aria-label={`Edit ${option.name}`}
                        onClick={() => startEdit(option)}
                      >
                        Edit
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        aria-label={`Delete ${option.name}`}
                        onClick={() => void handleDelete(option)}
                      >
                        Delete
                      </Button>
                    </div>
                  </li>
                ),
              )}
            </ul>
          )}

          {/* Add form */}
          <form className="grid gap-3 border-t border-gray-200 pt-4" onSubmit={handleAdd} aria-label="Add menu option">
            <p className="text-sm font-medium text-gray-900 m-0">Add option</p>
            <div className="grid gap-2">
              <Label htmlFor="menu-new-name">Name</Label>
              <Input
                id="menu-new-name"
                value={addForm.name}
                maxLength={100}
                placeholder="e.g. Roast Chicken"
                onChange={(event) =>
                  setAddForm((current) => ({ ...current, name: event.target.value }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="menu-new-description">Description</Label>
              <Input
                id="menu-new-description"
                value={addForm.description}
                placeholder="Optional — shown to guests"
                onChange={(event) =>
                  setAddForm((current) => ({ ...current, description: event.target.value }))
                }
              />
            </div>
            <DietaryChecks
              idPrefix="menu-new"
              form={addForm}
              onChange={(update) => setAddForm((current) => ({ ...current, ...update }))}
            />
            <div>
              <Button type="submit" disabled={busy}>
                Add option
              </Button>
            </div>
          </form>
        </div>
      </CardContent>
    </Card>
  )
}
