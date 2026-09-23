import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
})

export const queryKeys = {
  appState: ['appState'] as const,
  projects: ['projects'] as const,
  tasksByProject: (projectId: number) => ['tasks', projectId] as const,
  activityBlocks: (start: string, end: string) => ['activityBlocks', start, end] as const,
  assignmentRules: ['assignmentRules'] as const,
}
