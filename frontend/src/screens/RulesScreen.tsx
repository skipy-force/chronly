import { useState } from 'react'
import { motion } from 'framer-motion'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { queryKeys } from '../lib/queryClient'
import { RulesGraph } from '../components/RulesGraph'
import { Select } from '../components/Select'
import { fadeInVariants, staggerContainer } from '../lib/motion'
import { useT } from '../lib/i18n'
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
  const t = useT()
  const [appNamePattern, setAppNamePattern] = useState(rule.AppNamePattern ?? '')
  const [windowTitlePattern, setWindowTitlePattern] = useState(rule.WindowTitlePattern ?? '')
  const [projectId, setProjectId] = useState<number>(rule.ProjectID)
  const [priority, setPriority] = useState(rule.Priority)
  const queryClient = useQueryClient()

  const canSave = appNamePattern.trim() !== '' || windowTitlePattern.trim() !== ''

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
        <p className="mb-3 text-sm font-semibold">{t('editRule.title')}</p>
        <div className="flex flex-col gap-2">
          <div>
            <label className="text-xs text-on-surface-variant">{t('rules.appNamePattern')}</label>
            <input
              autoFocus
              value={appNamePattern}
              onChange={(e) => setAppNamePattern(e.target.value)}
              className="w-full rounded-md bg-surface-container px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label className="text-xs text-on-surface-variant">{t('rules.windowTitlePattern')}</label>
            <input
              value={windowTitlePattern}
              onChange={(e) => setWindowTitlePattern(e.target.value)}
              className="w-full rounded-md bg-surface-container px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <p className="text-[11px] text-on-surface-variant">{t('rules.conditionsHint')}</p>
          <div>
            <label className="text-xs text-on-surface-variant">{t('rules.project')}</label>
            <Select
              value={String(projectId)}
              onChange={(v) => setProjectId(Number(v))}
              options={projects.map((p) => ({ value: String(p.ID), label: p.Name }))}
              placeholder={t('select.placeholder')}
              className="w-full"
            />
          </div>
          <div>
            <label className="text-xs text-on-surface-variant">{t('rules.priority')}</label>
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
            disabled={!canSave}
            onClick={() => {
              if (!canSave) return
              updateMutation.mutate({
                ...rule,
                AppNamePattern: appNamePattern.trim() || undefined,
                WindowTitlePattern: windowTitlePattern.trim() || undefined,
                ProjectID: projectId,
                Priority: priority,
              } as tracker.Rule)
            }}
            className="flex-1 rounded-pill bg-primary px-3 py-1.5 text-sm text-surface disabled:opacity-40"
          >
            {t('common.save')}
          </button>
          <button onClick={onClose} className="rounded-pill bg-surface-container px-3 py-1.5 text-sm">
            {t('common.cancel')}
          </button>
        </div>
      </div>
    </div>
  )
}

export function RulesScreen() {
  const t = useT()
  const queryClient = useQueryClient()
  const { data: rules = [] } = useQuery({
    queryKey: queryKeys.assignmentRules,
    queryFn: api.listAssignmentRules,
  })
  const { data: projects = [] } = useQuery({
    queryKey: queryKeys.projects,
    queryFn: api.listProjects,
  })

  const [appNamePattern, setAppNamePattern] = useState('')
  const [windowTitlePattern, setWindowTitlePattern] = useState('')
  const [projectId, setProjectId] = useState<number | null>(null)
  const [priority, setPriority] = useState(0)
  const [editingRuleId, setEditingRuleId] = useState<number | null>(null)

  const invalidate = () => queryClient.invalidateQueries({ queryKey: queryKeys.assignmentRules })

  const createMutation = useMutation({
    mutationFn: api.createAssignmentRule,
    onSuccess: () => {
      invalidate()
      setAppNamePattern('')
      setWindowTitlePattern('')
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

      <motion.div variants={sectionVariants} className="flex flex-col gap-2 rounded-lg bg-surface-container p-3">
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <label className="text-xs text-on-surface-variant">{t('rules.appNamePattern')}</label>
            <input
              value={appNamePattern}
              onChange={(e) => setAppNamePattern(e.target.value)}
              className="w-full rounded-pill bg-surface-container-high px-3 py-1.5 text-sm"
            />
          </div>
          <div className="flex-1">
            <label className="text-xs text-on-surface-variant">{t('rules.windowTitlePattern')}</label>
            <input
              value={windowTitlePattern}
              onChange={(e) => setWindowTitlePattern(e.target.value)}
              className="w-full rounded-pill bg-surface-container-high px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-on-surface-variant">{t('rules.project')}</label>
            <Select
              value={projectId !== null ? String(projectId) : null}
              onChange={(v) => setProjectId(Number(v))}
              options={projects.map((p) => ({ value: String(p.ID), label: p.Name }))}
              placeholder={t('select.placeholder')}
            />
          </div>
          <div>
            <label className="text-xs text-on-surface-variant">{t('rules.priority')}</label>
            <input
              type="number"
              value={priority}
              onChange={(e) => setPriority(Number(e.target.value))}
              className="w-20 rounded-pill bg-surface-container-high px-3 py-1.5 text-sm outline-none [appearance:textfield] focus:ring-1 focus:ring-primary [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
          </div>
          <button
            disabled={(!appNamePattern.trim() && !windowTitlePattern.trim()) || projectId === null}
            onClick={() =>
              createMutation.mutate({
                ID: 0,
                AppNamePattern: appNamePattern.trim() || undefined,
                WindowTitlePattern: windowTitlePattern.trim() || undefined,
                ProjectID: projectId as number,
                Priority: priority,
              } as tracker.Rule)
            }
            className="rounded-pill bg-primary px-4 py-1.5 text-sm text-surface disabled:opacity-40"
          >
            {t('rules.addRule')}
          </button>
        </div>
        <p className="text-[11px] text-on-surface-variant">{t('rules.conditionsHint')}</p>
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
