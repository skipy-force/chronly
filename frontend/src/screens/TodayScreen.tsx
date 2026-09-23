import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { queryKeys } from '../lib/queryClient'
import { RadialHub, type Satellite } from '../components/RadialHub'
import { useElapsedSince } from '../lib/useTicker'

function startOfToday(): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

function endOfToday(): string {
  const d = new Date()
  d.setHours(23, 59, 59, 999)
  return d.toISOString()
}

export function TodayScreen() {
  const queryClient = useQueryClient()
  const { data: appState } = useQuery({
    queryKey: queryKeys.appState,
    queryFn: api.getAppState,
  })
  const { data: blocks = [] } = useQuery({
    queryKey: queryKeys.activityBlocks(startOfToday(), endOfToday()),
    queryFn: () => api.listActivityBlocksForRange(startOfToday(), endOfToday()),
  })

  const pauseMutation = useMutation({
    mutationFn: (paused: boolean) => api.setTrackingPaused(paused),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.appState }),
  })

  const lastBlock = blocks[blocks.length - 1]
  const elapsed = useElapsedSince(lastBlock ? lastBlock.StartTime : null)

  const totalMinutesToday = blocks.reduce((sum, b) => {
    const start = new Date(b.StartTime).getTime()
    const end = new Date(b.EndTime).getTime()
    return sum + (end - start) / 60000
  }, 0)

  const unsortedCount = blocks.filter((b) => b.TaskID == null).length

  const satellites: Satellite[] = [
    { id: 'total', label: 'Today', value: `${Math.round(totalMinutesToday)}m`, angleDeg: -90 },
    { id: 'paused', label: 'Status', value: appState?.TrackingPaused ? 'Paused' : 'Tracking', angleDeg: 0 },
    { id: 'unsorted', label: 'Unsorted', value: String(unsortedCount), angleDeg: 90 },
    { id: 'blocks', label: 'Blocks', value: String(blocks.length), angleDeg: 180 },
  ]

  return (
    <div className="flex h-full flex-col items-center justify-center gap-8 p-6">
      <RadialHub
        centerLabel={lastBlock ? lastBlock.AppName : 'No activity yet'}
        centerValue={elapsed}
        satellites={satellites}
        onCenterClick={() => pauseMutation.mutate(!appState?.TrackingPaused)}
      />
    </div>
  )
}
