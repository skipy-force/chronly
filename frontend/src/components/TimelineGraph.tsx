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

function nodeRadiusFor(count: number): number {
  if (count > 150) return 8
  if (count > 80) return 12
  if (count > 40) return 18
  return 30
}

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
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [size, setSize] = useState({ width: 800, height: 560 })
  const [nodes, setNodes] = useState<GraphNode[]>([])
  const [links, setLinks] = useState<GraphLink[]>([])
  const simulationRef = useRef<ReturnType<typeof forceSimulation<GraphNode>> | null>(null)
  const draggingId = useRef<string | null>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      if (width > 0 && height > 0) setSize({ width, height })
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const radius = nodeRadiusFor(blocks.length)

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

    const chargeStrength = -(60 + radius * 8)

    const simulation = forceSimulation<GraphNode>(graphNodes)
      .force(
        'link',
        forceLink<GraphNode, GraphLink>(graphLinks)
          .id((d) => d.id)
          .distance(radius * 3.5),
      )
      .force('charge', forceManyBody().strength(chargeStrength).distanceMax(300))
      .force('center', forceCenter(size.width / 2, size.height / 2))
      .force('collide', forceCollide(radius + 4))
      .on('tick', () => {
        setNodes([...graphNodes])
        setLinks([...graphLinks])
      })

    simulationRef.current = simulation
    return () => {
      simulation.stop()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocks, durationLabel, size.width, size.height])

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
  const radius = nodeRadiusFor(blocks.length)
  const showLabels = radius >= 18

  return (
    <div ref={containerRef} className="h-full w-full overflow-hidden rounded-lg bg-surface-container">
      <svg
        ref={(el) => {
          svgEl = el
        }}
        width={size.width}
        height={size.height}
        className="select-none"
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
              className="fill-none stroke-outline/40"
              strokeWidth="1"
              strokeDasharray="3 4"
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
            <title>
              {node.label} · {node.duration}
              {node.unsorted ? ' · unsorted' : ''}
            </title>
            <circle
              r={radius}
              className={node.unsorted ? 'fill-error/15 stroke-error' : 'fill-surface-container-high stroke-outline'}
              strokeWidth={1}
            />
            {showLabels && (
              <>
                <text
                  textAnchor="middle"
                  dy="-2"
                  className="pointer-events-none fill-on-surface text-[10px] font-medium"
                >
                  {node.label.length > 10 ? node.label.slice(0, 9) + '…' : node.label}
                </text>
                <text
                  textAnchor="middle"
                  dy="12"
                  className="pointer-events-none fill-on-surface-variant text-[9px] font-mono"
                >
                  {node.duration}
                </text>
              </>
            )}
          </g>
        ))}
      </svg>
    </div>
  )
}
