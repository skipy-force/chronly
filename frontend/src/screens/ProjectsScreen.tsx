import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { queryKeys } from '../lib/queryClient'

const ALL_TIME_KEY = ['activityBlocks', 'all-time'] as const

function useActualMinutesForProject(projectId: number): number {
  const { data: blocks = [] } = useQuery({
    queryKey: ALL_TIME_KEY,
    queryFn: () => api.listActivityBlocksForRange(new Date(0).toISOString(), new Date().toISOString()),
  })
  return blocks
    .filter((b) => b.ProjectID === projectId)
    .reduce((sum, b) => sum + (new Date(b.EndTime).getTime() - new Date(b.StartTime).getTime()) / 60000, 0)
}

function ProjectCard({ project }: { project: { ID: number; Name: string; EstimateMinutes?: number } }) {
  const actual = useActualMinutesForProject(project.ID)
  const estimate = project.EstimateMinutes ?? 0
  const ratio = estimate > 0 ? actual / estimate : 0
  const pct = Math.min(100, Math.round(ratio * 100))
  const overBudget = ratio > 1

  return (
    <div className="rounded-lg bg-surface-container p-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="font-medium">{project.Name}</p>
        <p className="text-sm text-on-surface-variant">
          {Math.round(actual)}m{estimate > 0 ? ` / ${estimate}m` : ''}
        </p>
      </div>
      {estimate > 0 && (
        <div className="h-2 overflow-hidden rounded-pill bg-surface-container-high">
          <div
            className={`h-full rounded-pill ${overBudget ? 'bg-error' : 'bg-primary'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  )
}

export function ProjectsScreen() {
  const { data: projects = [] } = useQuery({
    queryKey: queryKeys.projects,
    queryFn: api.listProjects,
  })
  const [selected, setSelected] = useState<number | null>(null)
  const { data: tasks = [] } = useQuery({
    queryKey: queryKeys.tasksByProject(selected ?? -1),
    queryFn: () => api.listTasksByProject(selected as number),
    enabled: selected !== null,
  })

  return (
    <div className="flex h-full gap-4 p-6">
      <div className="flex w-80 flex-col gap-2 overflow-auto">
        {projects.map((p) => (
          <div key={p.ID} onClick={() => setSelected(p.ID)} className="cursor-pointer">
            <ProjectCard project={p} />
          </div>
        ))}
      </div>
      {selected !== null && (
        <div className="flex-1 overflow-auto">
          <p className="mb-2 text-sm text-on-surface-variant">Tasks</p>
          <div className="flex flex-col gap-2">
            {tasks.map((t) => (
              <div key={t.ID} className="rounded-lg bg-surface-container p-3 text-sm">
                {t.Name}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
