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
import type { Block } from '../lib/api'

interface GraphNode extends SimulationNodeDatum {
  id: string
  index: number
  label: string
  duration: string
  unsorted: boolean
}

interface GraphLink extends SimulationLinkDatum<GraphNode> {}

interface TimelineGraphProps {
  blocks: Block[]
  durationLabel: (block: Block) => string
  onSelect: (index: number) => void
}

const WIDTH = 720
const HEIGHT = 460

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

export function TimelineGraph({ blocks, durationLabel, onSelect }: TimelineGraphProps) {
  const [nodes, setNodes] = useState<GraphNode[]>([])
  const [links, setLinks] = useState<GraphLink[]>([])
  const simulationRef = useRef<ReturnType<typeof forceSimulation<GraphNode>> | null>(null)
  const draggingId = useRef<string | null>(null)

  useEffect(() => {
    const graphNodes: GraphNode[] = blocks.map((b, i) => ({
      id: `block-${i}`,
      index: i,
      label: b.AppName || 'Unknown',
      duration: durationLabel(b),
      unsorted: b.ProjectID == null,
    }))

    const graphLinks: GraphLink[] = []
    for (let i = 0; i < graphNodes.length - 1; i++) {
      graphLinks.push({ source: `block-${i}`, target: `block-${i + 1}` })
    }

    const simulation = forceSimulation<GraphNode>(graphNodes)
      .force(
        'link',
        forceLink<GraphNode, GraphLink>(graphLinks)
          .id((d) => d.id)
          .distance(110),
      )
      .force('charge', forceManyBody().strength(-220))
      .force('center', forceCenter(WIDTH / 2, HEIGHT / 2))
      .force('collide', forceCollide(42))
      .on('tick', () => {
        setNodes([...graphNodes])
        setLinks([...graphLinks])
      })

    simulationRef.current = simulation
    return () => {
      simulation.stop()
    }
  }, [blocks, durationLabel])

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
            strokeDasharray="4 5"
          />
        )
      })}

      {nodes.map((node) => (
        <g
          key={node.id}
          transform={`translate(${node.x ?? 0}, ${node.y ?? 0})`}
          onPointerDown={(e) => onPointerDown(e, node)}
          onClick={() => onSelect(node.index)}
          className="cursor-grab active:cursor-grabbing"
        >
          <circle
            r={30}
            className={node.unsorted ? 'fill-error/15 stroke-error' : 'fill-surface-container-high stroke-outline'}
            strokeWidth={1}
          />
          <text textAnchor="middle" dy="-2" className="pointer-events-none fill-on-surface text-[10px] font-medium">
            {node.label.length > 10 ? node.label.slice(0, 9) + '…' : node.label}
          </text>
          <text textAnchor="middle" dy="12" className="pointer-events-none fill-on-surface-variant text-[9px] font-mono">
            {node.duration}
          </text>
        </g>
      ))}
    </svg>
  )
}
