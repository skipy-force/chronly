import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import * as App from '../../wailsjs/go/main/App'
import type { tracker } from '../../wailsjs/go/models'
import { EventsOn } from '../../wailsjs/runtime/runtime'
import { queryKeys } from './queryClient'

export const api = {
  listProjects: () => App.ListProjects(),
  listArchivedProjects: () => App.ListArchivedProjects(),
  createProject: (p: tracker.Project) => App.CreateProject(p),
  updateProject: (p: tracker.Project) => App.UpdateProject(p),
  archiveProject: (id: number) => App.ArchiveProject(id),
  unarchiveProject: (id: number) => App.UnarchiveProject(id),

  listTasksByProject: (projectId: number) => App.ListTasksByProject(projectId),
  listDoneTasksByProject: (projectId: number) => App.ListDoneTasksByProject(projectId),
  listArchivedTasksByProject: (projectId: number) => App.ListArchivedTasksByProject(projectId),
  createTask: (t: tracker.Task) => App.CreateTask(t),
  updateTask: (t: tracker.Task) => App.UpdateTask(t),
  setTaskStatus: (id: number, status: string) => App.SetTaskStatus(id, status),

  getAppState: () => App.GetAppState(),
  setCurrentTask: (taskId: number | null) => App.SetCurrentTask(taskId),
  setTrackingPaused: (paused: boolean) => App.SetTrackingPaused(paused),

  listActivityBlocksForRange: (start: string, end: string) =>
    App.ListActivityBlocksForRange(start, end),
  updateActivityBlockAssignment: (id: number, taskId: number | null) =>
    App.UpdateActivityBlockAssignment(id, taskId),
  splitActivityBlock: (id: number, splitAt: string) => App.SplitActivityBlock(id, splitAt),

  listAssignmentRules: () => App.ListAssignmentRules(),
  createAssignmentRule: (r: tracker.Rule) => App.CreateAssignmentRule(r),
  updateAssignmentRule: (r: tracker.Rule) => App.UpdateAssignmentRule(r),
  deleteAssignmentRule: (id: number) => App.DeleteAssignmentRule(id),

  getIdleDetectorTier: () => App.GetIdleDetectorTier(),
}

export function useQueryEvents() {
  const queryClient = useQueryClient()

  useEffect(() => {
    const offBlockClosed = EventsOn('block:closed', () => {
      queryClient.invalidateQueries({ queryKey: ['activityBlocks'] })
    })
    const offStateChanged = EventsOn('state:changed', () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.appState })
    })
    return () => {
      offBlockClosed()
      offStateChanged()
    }
  }, [queryClient])
}
