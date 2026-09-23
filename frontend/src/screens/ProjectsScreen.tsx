import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { api } from '../lib/api'
import { queryKeys } from '../lib/queryClient'
import type { tracker } from '../../wailsjs/go/models'

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

function NewProjectForm({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState('')
  const [estimate, setEstimate] = useState('')
  const queryClient = useQueryClient()

  const createMutation = useMutation({
    mutationFn: (p: tracker.Project) => api.createProject(p),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects })
      onDone()
    },
  })

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (!name.trim()) return
        const est = Number(estimate)
        createMutation.mutate({
          ID: 0,
          Name: name.trim(),
          Color: '',
          EstimateMinutes: Number.isFinite(est) && est > 0 ? est : undefined,
          Archived: false,
        } as tracker.Project)
      }}
      className="flex flex-col gap-2 rounded-lg bg-surface-container p-3"
    >
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Project name"
        className="rounded-md bg-surface-container-high px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary"
      />
      <input
        type="number"
        min={1}
        value={estimate}
        onChange={(e) => setEstimate(e.target.value)}
        placeholder="Estimate, minutes (optional)"
        className="rounded-md bg-surface-container-high px-3 py-1.5 text-sm outline-none [appearance:textfield] focus:ring-1 focus:ring-primary [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <div className="flex gap-2">
        <button type="submit" className="flex-1 rounded-pill bg-primary px-3 py-1.5 text-sm text-surface">
          Create
        </button>
        <button
          type="button"
          onClick={onDone}
          className="rounded-pill bg-surface-container-high px-3 py-1.5 text-sm"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

function NewTaskForm({ projectId, onDone }: { projectId: number; onDone: () => void }) {
  const [name, setName] = useState('')
  const [estimate, setEstimate] = useState('')
  const queryClient = useQueryClient()

  const createMutation = useMutation({
    mutationFn: (t: tracker.Task) => api.createTask(t),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasksByProject(projectId) })
      onDone()
    },
  })

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (!name.trim()) return
        const est = Number(estimate)
        createMutation.mutate({
          ID: 0,
          ProjectID: projectId,
          Name: name.trim(),
          EstimateMinutes: Number.isFinite(est) && est > 0 ? est : undefined,
          Status: 'open',
        } as tracker.Task)
      }}
      className="flex flex-col gap-2 rounded-lg bg-surface-container p-3"
    >
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Task name"
        className="rounded-md bg-surface-container-high px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary"
      />
      <input
        type="number"
        min={1}
        value={estimate}
        onChange={(e) => setEstimate(e.target.value)}
        placeholder="Estimate, minutes (optional)"
        className="rounded-md bg-surface-container-high px-3 py-1.5 text-sm outline-none [appearance:textfield] focus:ring-1 focus:ring-primary [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <div className="flex gap-2">
        <button type="submit" className="flex-1 rounded-pill bg-primary px-3 py-1.5 text-sm text-surface">
          Create
        </button>
        <button
          type="button"
          onClick={onDone}
          className="rounded-pill bg-surface-container-high px-3 py-1.5 text-sm"
        >
          Cancel
        </button>
      </div>
    </form>
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

  const [addingProject, setAddingProject] = useState(false)
  const [addingTask, setAddingTask] = useState(false)

  return (
    <div className="flex h-full gap-4 p-6">
      <div className="flex w-80 flex-col gap-2 overflow-auto">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold uppercase text-on-surface-variant">Projects</p>
          <button
            onClick={() => setAddingProject((v) => !v)}
            className="flex items-center gap-1 rounded-pill bg-surface-container px-2.5 py-1 text-xs hover:bg-surface-container-high"
          >
            <Plus size={14} />
            New
          </button>
        </div>
        {addingProject && <NewProjectForm onDone={() => setAddingProject(false)} />}
        {projects.map((p) => (
          <div key={p.ID} onClick={() => setSelected(p.ID)} className="cursor-pointer">
            <ProjectCard project={p} />
          </div>
        ))}
      </div>
      {selected !== null && (
        <div className="flex-1 overflow-auto">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm text-on-surface-variant">Tasks</p>
            <button
              onClick={() => setAddingTask((v) => !v)}
              className="flex items-center gap-1 rounded-pill bg-surface-container px-2.5 py-1 text-xs hover:bg-surface-container-high"
            >
              <Plus size={14} />
              New
            </button>
          </div>
          <div className="flex flex-col gap-2">
            {addingTask && <NewTaskForm projectId={selected} onDone={() => setAddingTask(false)} />}
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
