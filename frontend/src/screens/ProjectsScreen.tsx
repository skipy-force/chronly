import { useState } from 'react'
import { motion } from 'framer-motion'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Archive, ArchiveRestore, Pencil, Plus } from 'lucide-react'
import { api } from '../lib/api'
import { queryKeys } from '../lib/queryClient'
import { fadeInVariants, staggerContainer } from '../lib/motion'
import type { tracker } from '../../wailsjs/go/models'

const sectionVariants = fadeInVariants(0.35, 10)

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

function ProjectCard({ project, onEdit }: { project: tracker.Project; onEdit: () => void }) {
  const actual = useActualMinutesForProject(project.ID)
  const estimate = project.EstimateMinutes ?? 0
  const ratio = estimate > 0 ? actual / estimate : 0
  const pct = Math.min(100, Math.round(ratio * 100))
  const overBudget = ratio > 1

  return (
    <div className="group rounded-lg bg-surface-container p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          {project.Color && (
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: project.Color }} />
          )}
          <p className="truncate font-medium">{project.Name}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <p className="text-sm text-on-surface-variant">
            {Math.round(actual)}m{estimate > 0 ? ` / ${estimate}m` : ''}
          </p>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onEdit()
            }}
            className="rounded-pill p-1 text-on-surface-variant opacity-0 hover:bg-surface-container-high group-hover:opacity-100"
          >
            <Pencil size={13} />
          </button>
        </div>
      </div>
      {estimate > 0 && (
        <div className="h-2 overflow-hidden rounded-pill bg-surface-container-high">
          <motion.div
            className={`h-full rounded-pill ${overBudget ? 'bg-error' : 'bg-primary'}`}
            initial={{ width: '0%' }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        </div>
      )}
    </div>
  )
}

function EditProjectPanel({ project, onClose }: { project: tracker.Project; onClose: () => void }) {
  const [name, setName] = useState(project.Name)
  const [color, setColor] = useState(project.Color || '#c4b5fd')
  const [estimate, setEstimate] = useState(project.EstimateMinutes ? String(project.EstimateMinutes) : '')
  const queryClient = useQueryClient()

  const invalidate = () => queryClient.invalidateQueries({ queryKey: queryKeys.projects })

  const updateMutation = useMutation({
    mutationFn: (p: tracker.Project) => api.updateProject(p),
    onSuccess: () => {
      invalidate()
      onClose()
    },
  })
  const archiveMutation = useMutation({
    mutationFn: () => (project.Archived ? api.unarchiveProject(project.ID) : api.archiveProject(project.ID)),
    onSuccess: () => {
      invalidate()
      onClose()
    },
  })

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="w-80 rounded-lg bg-surface-container-high p-4" onClick={(e) => e.stopPropagation()}>
        <p className="mb-3 text-sm font-semibold">Edit project</p>
        <div className="flex flex-col gap-2">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-md bg-surface-container px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary"
          />
          <div className="flex items-center gap-2">
            <label className="text-xs text-on-surface-variant">Color</label>
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-8 w-8 cursor-pointer rounded border border-outline bg-transparent"
            />
          </div>
          <input
            type="number"
            min={1}
            value={estimate}
            onChange={(e) => setEstimate(e.target.value)}
            placeholder="Estimate, minutes (optional)"
            className="rounded-md bg-surface-container px-3 py-1.5 text-sm outline-none [appearance:textfield] focus:ring-1 focus:ring-primary [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
        </div>
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => {
              if (!name.trim()) return
              const est = Number(estimate)
              updateMutation.mutate({
                ...project,
                Name: name.trim(),
                Color: color,
                EstimateMinutes: Number.isFinite(est) && est > 0 ? est : undefined,
              } as tracker.Project)
            }}
            className="flex-1 rounded-pill bg-primary px-3 py-1.5 text-sm text-surface"
          >
            Save
          </button>
          <button onClick={onClose} className="rounded-pill bg-surface-container px-3 py-1.5 text-sm">
            Cancel
          </button>
        </div>
        <button
          onClick={() => archiveMutation.mutate()}
          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-pill bg-error/15 px-3 py-1.5 text-sm text-error"
        >
          {project.Archived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
          {project.Archived ? 'Unarchive' : 'Archive'}
        </button>
      </div>
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
  const [editingProject, setEditingProject] = useState<tracker.Project | null>(null)

  return (
    <motion.div className="flex h-full gap-4 p-6" initial="hidden" animate="show" variants={staggerContainer()}>
      <motion.div variants={sectionVariants} className="flex w-80 flex-col gap-2 overflow-auto">
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
            <ProjectCard project={p} onEdit={() => setEditingProject(p)} />
          </div>
        ))}
      </motion.div>
      {selected !== null && (
        <motion.div variants={sectionVariants} className="flex-1 overflow-auto">
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
        </motion.div>
      )}

      {editingProject && <EditProjectPanel project={editingProject} onClose={() => setEditingProject(null)} />}
    </motion.div>
  )
}
