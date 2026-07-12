import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  fetchMyProfile,
  fetchProfileDirectory,
  updateMyProfile,
  uploadMyProfilePhoto,
  type MemberProfile,
  type MemberProfileUpdateInput,
  type ProfileDirectoryEntry,
} from '@/api/profiles'

export type { MemberProfile, MemberProfileUpdateInput, ProfileDirectoryEntry } from '@/api/profiles'
export { ProfilesApiError } from '@/api/profiles'

export const MY_PROFILE_QUERY_KEY = ['profiles', 'me'] as const
export const PROFILE_DIRECTORY_QUERY_KEY = ['profiles', 'directory'] as const

export function useMyProfile() {
  return useQuery<MemberProfile | null>({
    queryKey: MY_PROFILE_QUERY_KEY,
    queryFn: () => fetchMyProfile(),
  })
}

export function useProfileDirectory() {
  return useQuery<ProfileDirectoryEntry[]>({
    queryKey: PROFILE_DIRECTORY_QUERY_KEY,
    queryFn: () => fetchProfileDirectory(),
  })
}

export function useUpdateMyProfile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: MemberProfileUpdateInput) => updateMyProfile(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: MY_PROFILE_QUERY_KEY })
      void queryClient.invalidateQueries({ queryKey: PROFILE_DIRECTORY_QUERY_KEY })
    },
  })
}

export function useUploadMyProfilePhoto() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (file: File) => uploadMyProfilePhoto(file),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: MY_PROFILE_QUERY_KEY })
      void queryClient.invalidateQueries({ queryKey: PROFILE_DIRECTORY_QUERY_KEY })
    },
  })
}
