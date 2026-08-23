import React from 'react'
import { Sankey } from 'react-sankey'

interface SankeyNode {
  name: string
  group: string
}

interface SankeyLink {
  source: number
  target: number
  value: number
}

interface SankeyDiagramProps {
  nodes: SankeyNode[]
  links: SankeyLink[]
  height?: number
}

export function SankeyDiagram({ nodes, links, height = 400 }: SankeyDiagramProps) {
  const colors = ['#4A90D9', '#50C878', '#FF6B6B', '#9B59B6', '#F39C12']
  
  return (
    <div className="w-full overflow-x-auto">
      <Sankey
        data={{ nodes, links }}
        nodePadding={20}
        nodeWidth={15}
        height={height}
        nodeColor={(node: any) => colors[node.group % colors.length]}
        margin={{ top: 20, right: 50, bottom: 20, left: 50 }}
      />
    </div>
  )
}
