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
}

const WIDTH = 640
const HEIGHT = 420

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

export function RulesGraph({ rules, projects, onDeleteRule }: RulesGraphProps) {
  const [nodes, setNodes] = useState<GraphNode[]>([])
  const [links, setLinks] = useState<GraphLink[]>([])
  const simulationRef = useRef<ReturnType<typeof forceSimulation<GraphNode>> | null>(null)
  const draggingId = useRef<string | null>(null)

  useEffect(() => {
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
    const graphLinks: GraphLink[] = rules.map((r) => ({
      source: `rule-${r.ID}`,
      target: `project-${r.ProjectID}`,
    }))

    const simulation = forceSimulation<GraphNode>(graphNodes)
      .force(
        'link',
        forceLink<GraphNode, GraphLink>(graphLinks)
          .id((d) => d.id)
          .distance(130),
      )
      .force('charge', forceManyBody().strength(-260))
      .force('center', forceCenter(WIDTH / 2, HEIGHT / 2))
      .force('collide', forceCollide(46))
      .on('tick', () => {
        setNodes([...graphNodes])
        setLinks([...graphLinks])
      })

    simulationRef.current = simulation
    return () => {
      simulation.stop()
    }
  }, [rules, projects])

  function onPointerDown(e: React.PointerEvent, node: GraphNode) {
    e.currentTarget.setPointerCapture(e.pointerId)
    draggingId.current = node.id
    simulationRef.current?.alphaTarget(0.3).restart()
  }

  function onPointerMove(e: React.PointerEvent, svgRef: SVGSVGElement | null) {
    if (!draggingId.current || !svgRef) return
    const rect = svgRef.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const node = nodes.find((n) => n.id === draggingId.current)
    if (node) {
      node.fx = x
      node.fy = y
    }
  }

  function onPointerUp() {
    draggingId.current = null
    simulationRef.current?.alphaTarget(0)
  }

  let svgEl: SVGSVGElement | null = null

  return (
    <svg
      ref={(el) => {
        svgEl = el
      }}
      width={WIDTH}
      height={HEIGHT}
      className="rounded-lg bg-surface-container select-none"
      onPointerMove={(e) => onPointerMove(e, svgEl)}
      onPointerUp={onPointerUp}
    >
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
          onPointerDown={(e) => onPointerDown(e, node)}
          className="cursor-grab active:cursor-grabbing"
        >
          <circle
            r={node.kind === 'project' ? 30 : 22}
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
            <text
              textAnchor="middle"
              y={38}
              className="cursor-pointer fill-error text-[10px]"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => onDeleteRule(node.ruleId as number)}
            >
              delete
            </text>
          )}
        </g>
      ))}
    </svg>
  )
}
