import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronDown } from 'lucide-react'
import { api } from '../lib/api'
import { queryKeys } from '../lib/queryClient'
import { RulesGraph } from '../components/RulesGraph'

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
    <div className="flex h-full flex-col gap-4 p-6">
      <div className="flex justify-center overflow-auto">
        <RulesGraph rules={rules} projects={projects} onDeleteRule={(id) => deleteMutation.mutate(id)} />
      </div>

      <div className="flex items-end gap-2 rounded-lg bg-surface-container p-3">
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
          <div className="relative">
            <select
              value={projectId ?? ''}
              onChange={(e) => setProjectId(Number(e.target.value))}
              className="appearance-none rounded-pill bg-surface-container-high py-1.5 pl-3 pr-8 text-sm outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="" disabled>
                Select
              </option>
              {projects.map((p) => (
                <option key={p.ID} value={p.ID}>
                  {p.Name}
                </option>
              ))}
            </select>
            <ChevronDown
              size={14}
              className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant"
            />
          </div>
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
      </div>
    </div>
  )
}
