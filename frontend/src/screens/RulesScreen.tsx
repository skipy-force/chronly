import { useState } from 'react'
import { motion } from 'framer-motion'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { queryKeys } from '../lib/queryClient'
import { RulesGraph } from '../components/RulesGraph'
import { Select } from '../components/Select'
import { fadeInVariants, staggerContainer } from '../lib/motion'
import type { tracker } from '../../wailsjs/go/models'

const sectionVariants = fadeInVariants(0.35, 10)

function EditRulePanel({
  rule,
  projects,
  onClose,
}: {
  rule: tracker.Rule
  projects: tracker.Project[]
  onClose: () => void
}) {
  const [pattern, setPattern] = useState(rule.Pattern)
  const [projectId, setProjectId] = useState<number>(rule.ProjectID)
  const [priority, setPriority] = useState(rule.Priority)
  const queryClient = useQueryClient()

  const updateMutation = useMutation({
    mutationFn: (r: tracker.Rule) => api.updateAssignmentRule(r),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.assignmentRules })
      onClose()
    },
  })

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="w-80 rounded-lg bg-surface-container-high p-4" onClick={(e) => e.stopPropagation()}>
        <p className="mb-3 text-sm font-semibold">Edit rule</p>
        <div className="flex flex-col gap-2">
          <div>
            <label className="text-xs text-on-surface-variant">Pattern</label>
            <input
              autoFocus
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              className="w-full rounded-md bg-surface-container px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label className="text-xs text-on-surface-variant">Project</label>
            <Select
              value={String(projectId)}
              onChange={(v) => setProjectId(Number(v))}
              options={projects.map((p) => ({ value: String(p.ID), label: p.Name }))}
              className="w-full"
            />
          </div>
          <div>
            <label className="text-xs text-on-surface-variant">Priority</label>
            <input
              type="number"
              value={priority}
              onChange={(e) => setPriority(Number(e.target.value))}
              className="w-full rounded-md bg-surface-container px-3 py-1.5 text-sm outline-none [appearance:textfield] focus:ring-1 focus:ring-primary [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => {
              if (!pattern.trim()) return
              updateMutation.mutate({
                ...rule,
                Pattern: pattern.trim(),
                ProjectID: projectId,
                Priority: priority,
              } as tracker.Rule)
            }}
            className="flex-1 rounded-pill bg-primary px-3 py-1.5 text-sm text-surface"
          >
            Save
          </button>
          <button onClick={onClose} className="rounded-pill bg-surface-container px-3 py-1.5 text-sm">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

export function RulesScreen() {
  const queryClient = useQueryClient()
  const { data: rules = [] } = useQuery({
    queryKey: queryKeys.assignmentRules,
    queryFn: api.listAssignmentRules,
  })
  const { data: projects = [] } = useQuery({
    queryKey: queryKeys.projects,
    queryFn: api.listProjects,
  })

  const [pattern, setPattern] = useState('')
  const [projectId, setProjectId] = useState<number | null>(null)
  const [priority, setPriority] = useState(0)
  const [editingRuleId, setEditingRuleId] = useState<number | null>(null)

  const invalidate = () => queryClient.invalidateQueries({ queryKey: queryKeys.assignmentRules })

  const createMutation = useMutation({
    mutationFn: api.createAssignmentRule,
    onSuccess: () => {
      invalidate()
      setPattern('')
    },
  })
  const deleteMutation = useMutation({
    mutationFn: api.deleteAssignmentRule,
    onSuccess: invalidate,
  })

  return (
    <motion.div
      className="flex h-full flex-col gap-4 p-6"
      initial="hidden"
      animate="show"
      variants={staggerContainer()}
    >
      <motion.div variants={sectionVariants} className="min-h-0 flex-1 overflow-hidden rounded-lg bg-surface-container">
        <RulesGraph
          rules={rules}
          projects={projects}
          onDeleteRule={(id) => deleteMutation.mutate(id)}
          onEditRule={(id) => setEditingRuleId(id)}
        />
      </motion.div>

      <motion.div variants={sectionVariants} className="flex items-end gap-2 rounded-lg bg-surface-container p-3">
        <div className="flex-1">
          <label className="text-xs text-on-surface-variant">Pattern (app name substring)</label>
          <input
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            className="w-full rounded-pill bg-surface-container-high px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="text-xs text-on-surface-variant">Project</label>
          <Select
            value={projectId !== null ? String(projectId) : null}
            onChange={(v) => setProjectId(Number(v))}
            options={projects.map((p) => ({ value: String(p.ID), label: p.Name }))}
          />
        </div>
        <div>
          <label className="text-xs text-on-surface-variant">Priority</label>
          <input
            type="number"
            value={priority}
            onChange={(e) => setPriority(Number(e.target.value))}
            className="w-20 rounded-pill bg-surface-container-high px-3 py-1.5 text-sm outline-none [appearance:textfield] focus:ring-1 focus:ring-primary [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
        </div>
        <button
          disabled={!pattern || projectId === null}
          onClick={() =>
            createMutation.mutate({
              ID: 0,
              PatternType: 'app_name',
              Pattern: pattern,
              ProjectID: projectId as number,
              Priority: priority,
            })
          }
          className="rounded-pill bg-primary px-4 py-1.5 text-sm text-surface disabled:opacity-40"
        >
          Add rule
        </button>
      </motion.div>

      {editingRuleId !== null &&
        (() => {
          const rule = rules.find((r) => r.ID === editingRuleId)
          if (!rule) return null
          return <EditRulePanel rule={rule} projects={projects} onClose={() => setEditingRuleId(null)} />
        })()}
    </motion.div>
  )
}
