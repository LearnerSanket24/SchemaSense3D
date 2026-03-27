import { useMemo, useRef, useEffect } from "react"
import ForceGraph3D from "react-force-graph-3d"
import { useVisualizationStore } from "../store/useVisualizationStore"

function getTableColor(tableName) {
  const colors = [
      '#3b82f6', '#8b5cf6', '#10b981',
      '#f59e0b', '#ef4444', '#06b6d4',
      '#84cc16', '#d946ef', '#14b8a6',
      '#f43f5e', '#6366f1'
  ]
  const idx = String(tableName || '').charCodeAt(0) % colors.length
  return colors[idx >= 0 ? idx : 0]
}

function getQualityColor(score) {
  if (score >= 85) return "#22c55e"
  if (score >= 60) return "#f59e0b"
  return "#ef4444"
}

export default function DBViz3D() {
  const fgRef = useRef(null)
  const { tables, relationships, setSelectedNode, visualMode, queriedTables } = useVisualizationStore()

  const graphData = useMemo(() => {
    const nodes = (tables || []).map((t, idx) => ({
      id: t.id,
      name: t.name,
      rows: t.rows,
      columns: t.columns,
      qualityScore: t.qualityScore,
      group: t.group,
      val: Math.max(Math.cbrt(t.rows || 1) * 0.5, 2),
      idx,
    }))

    const links = (relationships || []).map((r) => ({
      source: r.source,
      target: r.target,
      type: r.type || 'explicit',
      label: r.sourceCol + ' -> ' + r.targetCol,
    }))

    return { nodes, links }
  }, [tables, relationships])

  useEffect(() => {
    if (!fgRef.current) return
    const timer = setTimeout(() => {
      fgRef.current?.d3Force("charge")?.strength(-180)
      fgRef.current?.d3Force("link")?.distance(110)
    }, 10)
    
    return () => {
      clearTimeout(timer)
    }
  }, [graphData])

  const nodeColor = (node) => {
    const nodeId = String(node.id || "").toLowerCase()
    const queried = queriedTables.includes(nodeId)

    if (visualMode === "quality") return getQualityColor(node.qualityScore || 0)
    if (visualMode === "ai-query" && queried) return "#f59e0b"

    return getTableColor(node.name)
  }

  return (
    <div className="absolute inset-0">
      <ForceGraph3D
        ref={fgRef}
        graphData={graphData}
        backgroundColor="rgba(0,0,0,0)"
        nodeColor={nodeColor}
        nodeVal={(n) => {
          const queried = queriedTables.includes(String(n.id || "").toLowerCase())
          return queried && visualMode === "ai-query" ? n.val * 1.5 : n.val     
        }}
        nodeResolution={32}
        nodeOpacity={0.95}
        nodeLabel={(node) => {
          const quality = Math.round(node.qualityScore || 0)
          return "<div style=\"padding:8px;background:#0e0f13;border:1px solid #1e2028;border-radius:8px;color:white\"><b>" + node.name + "</b><br/>Rows: " + (node.rows || 0).toLocaleString() + "<br/>Quality: " + quality + "%</div>"
        }}
        linkColor={(link) => 
            link.type === 'implicit' 
            ? 'rgba(150, 150, 150, 0.2)' 
            : 'rgba(255, 80, 80, 0.4)'
        }
        linkWidth={(link) => (link.type === 'implicit' ? 0.5 : 1.5)}
        linkDirectionalParticles={(link) => (link.type === 'implicit' ? 2 : 5)} 
        linkDirectionalParticleWidth={(link) => (link.type === 'implicit' ? 1.5 : 3.5)}
        linkDirectionalParticleResolution={16}
        linkDirectionalParticleSpeed={(link) => (link.type === 'implicit' ? 0.002 : 0.008)}
        linkDirectionalParticleColor={(link) => 
            link.type === 'implicit' ? 'rgba(200, 200, 200, 0.5)' : '#ff2a5f'
        }
        onNodeClick={(node) => {
          const picked = tables.find((t) => t.id === node.id)
          if (picked) setSelectedNode(picked)

          const distance = 130
          const distRatio = 1 + distance / Math.hypot(node.x || 1, node.y || 1, node.z || 1)
          fgRef.current?.cameraPosition(
            { x: (node.x || 0) * distRatio, y: (node.y || 0) * distRatio, z: (node.z || 0) * distRatio },
            node,
            800
          )
        }}
      />
    </div>
  )
}
