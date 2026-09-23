import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { api } from '../lib/api'
import { queryKeys } from '../lib/queryClient'
import { TimelineList } from '../components/TimelineList'
import { TimelineByApp } from '../components/TimelineByApp'
import { DatePicker } from '../components/DatePicker'
import { AppIconBadge } from '../lib/appIcons'
import { prettyAppName } from '../lib/appNames'
import { localDateKey, formatHoursMinutes, formatClockTime } from '../lib/dates'
import { useUiStore, type TimelineView } from '../store/uiStore'
import { fadeInVariants, staggerContainer } from '../lib/motion'
import { useT } from '../lib/i18n'

const sectionVariants = fadeInVariants()

function addDays(dateStr: string, delta: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + delta)
  return localDateKey(d)
}

export function TimelineScreen() {
  const t = useT()
  const [date, setDate] = useState(() => localDateKey(new Date()))
  const { timelineView: view, setTimelineView: setView } = useUiStore()
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

  const assignTaskMutation = useMutation({
    mutationFn: ({ id, taskId }: { id: number; taskId: number }) => api.updateActivityBlockAssignment(id, taskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activityBlocks'] })
      setAssigningIndex(null)
    },
  })
  const assignProjectMutation = useMutation({
    mutationFn: ({ id, projectId }: { id: number; projectId: number }) =>
      api.updateActivityBlockProjectOnly(id, projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activityBlocks'] })
      setAssigningIndex(null)
    },
  })

  const totalMinutes = blocks.reduce(
    (sum, b) => sum + (new Date(b.EndTime).getTime() - new Date(b.StartTime).getTime()) / 60000,
    0,
  )

  return (
    <motion.div
      className="flex h-full flex-col gap-4 p-6"
      initial="hidden"
      animate="show"
      variants={staggerContainer()}
    >
      <motion.div variants={sectionVariants} className="flex items-center justify-between">
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
        <p className="text-sm text-on-surface-variant">
          {t('timeline.total')} <span className="font-semibold text-on-surface">{formatHoursMinutes(totalMinutes)}</span>
        </p>
      </motion.div>

      <motion.div variants={sectionVariants} className="flex items-center justify-between">
        <p className="text-xs text-on-surface-variant">
          {view === 'time' ? t('timeline.descByTime') : t('timeline.descByApp')}
        </p>
        <div className="flex shrink-0 gap-1 rounded-pill bg-surface-container p-1">
          {(['time', 'app'] as TimelineView[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`relative rounded-pill px-3 py-1 text-xs ${
                view === v ? 'text-surface' : 'text-on-surface-variant'
              }`}
            >
              {view === v && (
                <motion.div
                  layoutId="timeline-view-pill"
                  className="absolute inset-0 rounded-pill bg-primary"
                  transition={{ type: 'spring', bounce: 0.25, duration: 0.4 }}
                />
              )}
              <span className="relative">{v === 'time' ? t('timeline.byTime') : t('timeline.byApp')}</span>
            </button>
          ))}
        </div>
      </motion.div>

      <motion.div variants={sectionVariants} className="min-h-0 flex-1">
        <AnimatePresence mode="wait">
          <motion.div
            key={`${date}-${view}`}
            className="h-full"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } }}
            exit={{ opacity: 0, y: -10, transition: { duration: 0.2, ease: 'easeIn' } }}
          >
            {view === 'time' ? (
              <TimelineList blocks={blocks} onSelect={(index) => setAssigningIndex(index)} />
            ) : (
              <TimelineByApp blocks={blocks} />
            )}
          </motion.div>
        </AnimatePresence>
      </motion.div>

      {assigningIndex !== null && (
        <div
          className="fixed inset-0 flex items-center justify-center bg-black/50"
          onClick={() => setAssigningIndex(null)}
        >
          <div
            className="flex max-h-[70vh] w-96 flex-col rounded-lg bg-surface-container-high p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold">{t('timeline.assignToProject')}</p>
              <button
                onClick={() => setAssigningIndex(null)}
                className="rounded-pill p-1 text-on-surface-variant hover:bg-surface-container"
              >
                <X size={14} />
              </button>
            </div>

            {(() => {
              const block = blocks[assigningIndex]
              return (
                <div className="mb-3 flex items-center gap-3 rounded-lg bg-surface-container p-3">
                  <AppIconBadge appName={block.AppName || ''} size={32} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{prettyAppName(block.AppName)}</p>
                    <p className="text-xs text-on-surface-variant">
                      {formatClockTime(new Date(block.StartTime))} – {formatClockTime(new Date(block.EndTime))}
                    </p>
                  </div>
                </div>
              )
            })()}

            <div className="flex flex-col gap-2 overflow-y-auto">
              {projects.map((p) => (
                <ProjectOption
                  key={p.ID}
                  project={p}
                  onPickTask={(taskId) => {
                    const block = blocks[assigningIndex]
                    assignTaskMutation.mutate({ id: block.ID, taskId })
                  }}
                  onPickProjectOnly={() => {
                    const block = blocks[assigningIndex]
                    assignProjectMutation.mutate({ id: block.ID, projectId: p.ID })
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </motion.div>
  )
}

function ProjectOption({
  project,
  onPickTask,
  onPickProjectOnly,
}: {
  project: { ID: number; Name: string; Color: string }
  onPickTask: (taskId: number) => void
  onPickProjectOnly: () => void
}) {
  const t = useT()
  const [expanded, setExpanded] = useState(false)
  const { data: tasks = [] } = useQuery({
    queryKey: queryKeys.tasksByProject(project.ID),
    queryFn: () => api.listTasksByProject(project.ID),
    enabled: expanded,
  })

  return (
    <div className="overflow-hidden rounded-lg bg-surface-container">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-2 p-3 hover:bg-surface-container-high"
      >
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: project.Color || 'var(--color-primary)' }}
        />
        <span className="flex-1 truncate text-left text-sm font-medium">{project.Name}</span>
        <ChevronDown size={14} className={`text-on-surface-variant transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>

      {expanded && (
        <div className="flex flex-col gap-1 border-t border-outline/10 p-2">
          <button
            onClick={onPickProjectOnly}
            className="rounded-md px-2 py-1.5 text-left text-xs text-on-surface-variant hover:bg-surface-container-high"
          >
            {t('timeline.assignProjectOnly')}
          </button>
          {tasks.length === 0 ? (
            <p className="px-2 py-1 text-xs text-on-surface-variant/60">{t('timeline.noTasks')}</p>
          ) : (
            tasks.map((task) => (
              <button
                key={task.ID}
                onClick={() => onPickTask(task.ID)}
                className="rounded-md px-2 py-1.5 text-left text-sm hover:bg-surface-container-high"
              >
                {task.Name}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
