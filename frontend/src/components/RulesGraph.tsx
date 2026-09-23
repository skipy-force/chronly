import { useEffect, useRef, useState } from 'react'
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  type SimulationNodeDatum,
  type SimulationLinkDatum,
} from 'd3-force'
import { Maximize2 } from 'lucide-react'
import { useT } from '../lib/i18n'
import type { tracker } from '../../wailsjs/go/models'

interface GraphNode extends SimulationNodeDatum {
  id: string
  kind: 'project' | 'rule'
  label: string
  ruleId?: number
}

interface GraphLink extends SimulationLinkDatum<GraphNode> {}

interface RulesGraphProps {
  rules: tracker.Rule[]
  projects: tracker.Project[]
  onDeleteRule: (id: number) => void
  onEditRule: (id: number) => void
}

const VIRTUAL_WIDTH = 1600
const VIRTUAL_HEIGHT = 1000
const MIN_ZOOM = 0.3
const MAX_ZOOM = 2.5

function curvedPath(x1: number, y1: number, x2: number, y2: number): string {
  const midX = (x1 + x2) / 2
  const midY = (y1 + y2) / 2
  const dx = x2 - x1
  const dy = y2 - y1
  const offset = 0.15
  const controlX = midX - dy * offset
  const controlY = midY + dx * offset
  return `M ${x1} ${y1} Q ${controlX} ${controlY} ${x2} ${y2}`
}

export function RulesGraph({ rules, projects, onDeleteRule, onEditRule }: RulesGraphProps) {
  const t = useT()
  const [nodes, setNodes] = useState<GraphNode[]>([])
  const [links, setLinks] = useState<GraphLink[]>([])
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const simulationRef = useRef<ReturnType<typeof forceSimulation<GraphNode>> | null>(null)
  const draggingId = useRef<string | null>(null)
  const panState = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)

  useEffect(() => {
    const projectIds = new Set(projects.map((p) => p.ID))

    const projectNodes: GraphNode[] = projects
      .filter((p) => rules.some((r) => r.ProjectID === p.ID))
      .map((p) => ({ id: `project-${p.ID}`, kind: 'project', label: p.Name }))

    const ruleNodes: GraphNode[] = rules.map((r) => ({
      id: `rule-${r.ID}`,
      kind: 'rule',
      label: r.Pattern,
      ruleId: r.ID,
    }))

    const graphNodes = [...projectNodes, ...ruleNodes]
    const graphLinks: GraphLink[] = rules
      .filter((r) => projectIds.has(r.ProjectID))
      .map((r) => ({
        source: `rule-${r.ID}`,
        target: `project-${r.ProjectID}`,
      }))

    const simulation = forceSimulation<GraphNode>(graphNodes)
      .force(
        'link',
        forceLink<GraphNode, GraphLink>(graphLinks)
          .id((d) => d.id)
          .distance(150),
      )
      .force('charge', forceManyBody().strength(-320))
      .force('center', forceCenter(VIRTUAL_WIDTH / 2, VIRTUAL_HEIGHT / 2))
      .force('collide', forceCollide(50))
      .on('tick', () => {
        setNodes([...graphNodes])
        setLinks([...graphLinks])
      })

    simulationRef.current = simulation
    return () => {
      simulation.stop()
    }
  }, [rules, projects])

  function onNodePointerDown(e: React.PointerEvent, node: GraphNode) {
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    draggingId.current = node.id
    simulationRef.current?.alphaTarget(0.3).restart()
  }

  function toVirtualPoint(clientX: number, clientY: number) {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    return {
      x: (clientX - rect.left - pan.x) / zoom,
      y: (clientY - rect.top - pan.y) / zoom,
    }
  }

  function onSvgPointerDown(e: React.PointerEvent<SVGSVGElement>) {
    if (e.target !== e.currentTarget) return
    panState.current = { startX: e.clientX, startY: e.clientY, originX: pan.x, originY: pan.y }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function onSvgPointerMove(e: React.PointerEvent<SVGSVGElement>) {
    if (panState.current) {
      const dx = e.clientX - panState.current.startX
      const dy = e.clientY - panState.current.startY
      setPan({ x: panState.current.originX + dx, y: panState.current.originY + dy })
      return
    }
    if (!draggingId.current) return
    const { x, y } = toVirtualPoint(e.clientX, e.clientY)
    const node = nodes.find((n) => n.id === draggingId.current)
    if (node) {
      node.fx = x
      node.fy = y
    }
  }

  function onSvgPointerUp() {
    panState.current = null
    draggingId.current = null
    simulationRef.current?.alphaTarget(0)
  }

  function onWheel(e: React.WheelEvent<SVGSVGElement>) {
    e.preventDefault()
    setZoom((z) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z - e.deltaY * 0.001)))
  }

  function centerView() {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return
    setPan({ x: rect.width / 2 - VIRTUAL_WIDTH / 2, y: rect.height / 2 - VIRTUAL_HEIGHT / 2 })
    setZoom(1)
  }

  useEffect(() => {
    centerView()
  }, [])

  return (
    <div className="relative h-full w-full">
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        className="cursor-grab select-none touch-none active:cursor-grabbing"
        onPointerDown={onSvgPointerDown}
        onPointerMove={onSvgPointerMove}
        onPointerUp={onSvgPointerUp}
        onWheel={onWheel}
      >
        <defs>
          <filter id="node-glow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
          {links.map((l, i) => {
            const source = l.source as GraphNode
            const target = l.target as GraphNode
            if (typeof source === 'string' || typeof target === 'string') return null
            return (
              <path
                key={i}
                d={curvedPath(source.x ?? 0, source.y ?? 0, target.x ?? 0, target.y ?? 0)}
                className="fill-none stroke-outline/50"
                strokeWidth="1.5"
              />
            )
          })}

          {nodes.map((node) => (
            <g
              key={node.id}
              transform={`translate(${node.x ?? 0}, ${node.y ?? 0})`}
              onPointerDown={(e) => onNodePointerDown(e, node)}
              className="cursor-grab active:cursor-grabbing"
            >
              <circle
                r={node.kind === 'project' ? 30 : 22}
                filter="url(#node-glow)"
                className={node.kind === 'project' ? 'fill-primary' : 'fill-surface-container-high stroke-outline'}
                strokeWidth={node.kind === 'rule' ? 1 : 0}
              />
              <text
                textAnchor="middle"
                dy="4"
                className={`pointer-events-none text-[10px] font-medium ${
                  node.kind === 'project' ? 'fill-surface' : 'fill-on-surface'
                }`}
              >
                {node.label.length > 12 ? node.label.slice(0, 11) + '…' : node.label}
              </text>
              {node.kind === 'rule' && node.ruleId !== undefined && (
                <>
                  <text
                    textAnchor="middle"
                    x={-14}
                    y={38}
                    className="cursor-pointer fill-primary text-[10px]"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => onEditRule(node.ruleId as number)}
                  >
                    {t('rulesGraph.edit')}
                  </text>
                  <text
                    textAnchor="middle"
                    x={14}
                    y={38}
                    className="cursor-pointer fill-error text-[10px]"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => onDeleteRule(node.ruleId as number)}
                  >
                    {t('rulesGraph.delete')}
                  </text>
                </>
              )}
            </g>
          ))}
        </g>
      </svg>

      <button
        onClick={centerView}
        title={t('rulesGraph.resetView')}
        className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-pill bg-surface-container-high px-3 py-1.5 text-xs text-on-surface-variant hover:bg-outline/20"
      >
        <Maximize2 size={12} />
        {t('rulesGraph.resetView')}
      </button>
    </div>
  )
}
