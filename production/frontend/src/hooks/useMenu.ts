import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  createMenuOption,
  deleteMenuOption,
  fetchMenuOptions,
  updateMenuOption,
  type MenuOption,
  type MenuOptionCreatePayload,
  type MenuOptionUpdatePayload,
} from '@/api/menu'

export type { MenuOption, MenuOptionCreatePayload, MenuOptionUpdatePayload } from '@/api/menu'
export { MenuApiError } from '@/api/menu'

export const MENU_QUERY_KEY = ['menu-options'] as const

export function useMenuOptions() {
  return useQuery<MenuOption[]>({
    queryKey: MENU_QUERY_KEY,
    queryFn: () => fetchMenuOptions(),
  })
}

function useInvalidateMenu() {
  const queryClient = useQueryClient()
  return () => void queryClient.invalidateQueries({ queryKey: MENU_QUERY_KEY })
}

export function useCreateMenuOption() {
  const invalidate = useInvalidateMenu()
  return useMutation({
    mutationFn: (payload: MenuOptionCreatePayload) => createMenuOption(payload),
    onSuccess: invalidate,
  })
}

export function useUpdateMenuOption() {
  const invalidate = useInvalidateMenu()
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: MenuOptionUpdatePayload }) =>
      updateMenuOption(id, payload),
    onSuccess: invalidate,
  })
}

export function useDeleteMenuOption() {
  const invalidate = useInvalidateMenu()
  return useMutation({
    mutationFn: (id: number) => deleteMenuOption(id),
    onSuccess: invalidate,
  })
}
