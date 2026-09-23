import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { api } from '../lib/api'
import { queryKeys } from '../lib/queryClient'
import { TimelineBar } from '../components/TimelineBar'
import { DatePicker } from '../components/DatePicker'
import { localDateKey } from '../lib/dates'

function addDays(dateStr: string, delta: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + delta)
  return localDateKey(d)
}

export function TimelineScreen() {
  const [date, setDate] = useState(() => localDateKey(new Date()))
  const queryClient = useQueryClient()

  const start = new Date(date + 'T00:00:00').toISOString()
  const end = new Date(date + 'T23:59:59.999').toISOString()

  const { data: blocks = [] } = useQuery({
    queryKey: queryKeys.activityBlocks(start, end),
    queryFn: () => api.listActivityBlocksForRange(start, end),
  })
  const { data: projects = [] } = useQuery({
    queryKey: queryKeys.projects,
    queryFn: api.listProjects,
  })

  const [assigningIndex, setAssigningIndex] = useState<number | null>(null)

  const assignMutation = useMutation({
    mutationFn: ({ id, taskId }: { id: number; taskId: number | null }) =>
      api.updateActivityBlockAssignment(id, taskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activityBlocks'] })
      setAssigningIndex(null)
    },
  })

  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setDate((d) => addDays(d, -1))}
            className="rounded-pill p-1.5 text-on-surface-variant hover:bg-surface-container"
          >
            <ChevronLeft size={16} />
          </button>
          <DatePicker dateKey={date} onChange={setDate} />
          <button
            onClick={() => setDate((d) => addDays(d, 1))}
            className="rounded-pill p-1.5 text-on-surface-variant hover:bg-surface-container"
          >
            <ChevronRight size={16} />
          </button>
        </div>
        <p className="mt-2 text-xs text-on-surface-variant">
          Each bar is one tracked activity block, positioned by actual time of day. Click a bar to assign it to a
          project — red bars aren't assigned yet.
        </p>
      </div>

      <TimelineBar blocks={blocks} dayStartIso={start} onSelect={(index) => setAssigningIndex(index)} />

      {assigningIndex !== null && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50">
          <div className="w-80 rounded-lg bg-surface-container-high p-4">
            <p className="mb-2 text-sm text-on-surface-variant">Assign to project</p>
            {projects.map((p) => (
              <TaskPicker
                key={p.ID}
                projectId={p.ID}
                projectName={p.Name}
                onPick={(taskId) => {
                  const block = blocks[assigningIndex]
                  assignMutation.mutate({ id: block.ID, taskId })
                }}
              />
            ))}
            <button
              onClick={() => setAssigningIndex(null)}
              className="mt-2 w-full rounded-pill bg-surface-container px-3 py-1.5 text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function TaskPicker({
  projectId,
  projectName,
  onPick,
}: {
  projectId: number
  projectName: string
  onPick: (taskId: number) => void
}) {
  const { data: tasks = [] } = useQuery({
    queryKey: queryKeys.tasksByProject(projectId),
    queryFn: () => api.listTasksByProject(projectId),
  })
  return (
    <div className="mb-2">
      <p className="text-xs font-semibold uppercase text-on-surface-variant">{projectName}</p>
      {tasks.map((t) => (
        <button
          key={t.ID}
          onClick={() => onPick(t.ID)}
          className="block w-full rounded-md px-2 py-1 text-left text-sm hover:bg-surface-container"
        >
          {t.Name}
        </button>
      ))}
    </div>
  )
}
