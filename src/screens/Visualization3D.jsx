import { useEffect, useState } from "react"
import { Layers3, BarChart3, RefreshCw, AlertTriangle, Network, Bug } from "lucide-react"     
import DBViz3D from "../components/DBViz3D"
import ERDiagram2D from "../components/ERDiagram2D"
import AnalyticsDashboard from "../components/AnalyticsDashboard"
import NodeDetailOverlay from "../components/NodeDetailOverlay"
import { useVisualizationStore } from "../store/useVisualizationStore"
import { getQuality, getRelationships } from "../api/api"

function inferGroupFromName(name) {
  const n = String(name || "").toLowerCase()
  if (n.includes("customer")) return "customer"
  if (n.includes("order")) return "order"
  if (n.includes("product")) return "product"
  if (n.includes("seller")) return "seller"
  if (n.includes("review")) return "review"
  if (n.includes("geo") || n.includes("location")) return "geo"
  if (n.includes("payment") || n.includes("finance")) return "finance"
  if (n.includes("inventory") || n.includes("stock")) return "inventory"
  if (n.includes("shipping") || n.includes("delivery")) return "shipping"
  return "default"
}

function normalizeGraphData(relationshipsPayload, qualityPayload) {
  const nodesRaw = Array.isArray(relationshipsPayload?.nodes) ? relationshipsPayload.nodes : []
  const edgesRaw = Array.isArray(relationshipsPayload?.edges) ? relationshipsPayload.edges : []

  const resolveId = (v) => {
    if (typeof v === "string") return v
    if (v && typeof v === "object") return v.id || v.name || v.table || v.table_name || ""
    return ""
  }

  const qualityItems = Array.isArray(qualityPayload?.items) ? qualityPayload.items : []
  const qualityMap = new Map()
  qualityItems.forEach((q) => {
    const k = String(q.table || q.table_name || "").toLowerCase()
    qualityMap.set(k, Number(q.health_score ?? 0))
  })

  const tables = nodesRaw.map((n) => {
    const id = String(n.id || n.name || n.table_name || "")
    const key = id.toLowerCase()
    return {
      id,
      name: n.display_name || n.label || n.name || id,
      rows: n.row_count || 0,
      columns: n.columns || [],
      qualityScore: Number(qualityMap.get(key) ?? 0),
      group: inferGroupFromName(id),
    }
  })

  // Normalize relationships/edges
  const relationships = edgesRaw
    .map((e) => {
      const source = resolveId(e.source)
      const target = resolveId(e.target)
      const fallbackSource = String(e.source_table || e.source_table_name || "")
      const fallbackTarget = String(e.target_table || e.target_table_name || "")
      const finalSource = source || fallbackSource
      const finalTarget = target || fallbackTarget
      if (!finalSource || !finalTarget) return null

      return {
        id: e.id,
        source: finalSource,
        target: finalTarget,
        sourceCol: e.source_col,
        targetCol: e.target_col,
        type: e.type || "explicit",
        cardinality: e.cardinality || "one_to_many",
        label: e.label || "",
        confidence: e.confidence,
        inferenceMethod: e.inference_method,
      }
    })
    .filter(Boolean)

  return { tables, relationships }
}

export default function Visualization3D() {
  const [showDebug, setShowDebug] = useState(false)
  const [debugInfo, setDebugInfo] = useState({ diagnostics: null, sampleEdges: [] })

  const {
    setGraphData,
    tables,
    relationships,
    loading,
    error,
    setLoading,
    setError,
    viewMode,
    setViewMode,
    visualMode,
    setVisualMode,
    queriedTables,
    resetVisualization,
  } = useVisualizationStore()

  const loadVisualizationData = async () => {
    setLoading(true)
    setError("")

    try {
      // Relationships are required to render links. Quality is optional enhancement.
      const [relationshipsResult, qualityResult] = await Promise.allSettled([
        getRelationships(),
        getQuality(),
      ])

      if (relationshipsResult.status !== "fulfilled") {
        throw new Error("/relationships request failed")
      }

      const relationshipsData = relationshipsResult.value?.data
      const qualityData = qualityResult.status === "fulfilled" ? qualityResult.value?.data : { items: [] }

      const { tables, relationships } = normalizeGraphData(relationshipsData, qualityData)
      setDebugInfo({
        diagnostics: relationshipsData?.diagnostics || null,
        sampleEdges: relationships.slice(0, 3),
      })

      if (tables.length > 0) {
        setGraphData({ tables, relationships })
        return
      }

      throw new Error("Graph payload missing nodes")
    } catch (err) {
      console.error("Visualization load error:", err)
      setError("Failed to load visualization data from backend.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadVisualizationData()
    return () => resetVisualization()
  }, [])

  return (
    <div className="relative h-[calc(100vh-4rem)] bg-dark overflow-hidden">
      <div className="absolute top-3 left-3 z-20 flex flex-wrap items-center gap-2">
        <button
          onClick={() => setViewMode("3d")}
          className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
            viewMode === "3d"
              ? "bg-primary text-white border-primary"
              : "bg-secondary/80 text-gray-300 border-border hover:bg-secondary"
          }`}
        >
          <span className="inline-flex items-center gap-1.5"><Layers3 className="w-4 h-4" /> 3D Graph</span>
        </button>

        <button
          onClick={() => setViewMode("2d")}
          className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
            viewMode === "2d"
              ? "bg-primary text-white border-primary"
              : "bg-secondary/80 text-gray-300 border-border hover:bg-secondary"
          }`}
        >
          <span className="inline-flex items-center gap-1.5"><Network className="w-4 h-4" /> 2D ER Diagram</span>
        </button>

        <button
          onClick={() => setViewMode("analytics")}
          className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
            viewMode === "analytics"
              ? "bg-primary text-white border-primary"
              : "bg-secondary/80 text-gray-300 border-border hover:bg-secondary"
          }`}
        >
          <span className="inline-flex items-center gap-1.5"><BarChart3 className="w-4 h-4" /> Analytics</span>
        </button>

        <button
          onClick={() => setVisualMode(visualMode === "quality" ? "default" : "quality")}
          className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
            visualMode === "quality"
              ? "bg-yellow-500/20 text-yellow-300 border-yellow-500/40"
              : "bg-secondary/80 text-gray-300 border-border hover:bg-secondary"
          }`}
        >
          {visualMode === "quality" ? "Quality Color On" : "Quality Color Off"}
        </button>

        <button
          onClick={loadVisualizationData}
          className="px-3 py-1.5 rounded-lg text-sm border bg-secondary/80 text-gray-300 border-border hover:bg-secondary transition-colors"
        >
          <span className="inline-flex items-center gap-1.5"><RefreshCw className="w-4 h-4" /> Reload</span>
        </button>

        <button
          onClick={() => setShowDebug((v) => !v)}
          className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
            showDebug
              ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40"
              : "bg-secondary/80 text-gray-300 border-border hover:bg-secondary"
          }`}
        >
          <span className="inline-flex items-center gap-1.5"><Bug className="w-4 h-4" /> Debug</span>
        </button>
      </div>

      <div className="absolute top-3 right-3 z-20 px-3 py-1.5 rounded-lg bg-secondary/90 border border-border text-xs text-muted">
        Highlighted from chat: {queriedTables.length}
      </div>

      <div className="absolute top-14 right-3 z-20 px-3 py-1.5 rounded-lg bg-secondary/90 border border-border text-xs text-muted">
        Tables: {tables.length} | Relationships: {relationships.length}
      </div>

      {!loading && !error && (tables.length <= 1 || relationships.length === 0) && (
        <div className="absolute top-14 left-3 z-20 max-w-xl rounded-lg border border-yellow-500/40 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-200">
          Graph has limited data from backend right now ({tables.length} table, {relationships.length} relationships). If you uploaded multiple CSVs, backend ingest is likely replacing instead of appending.
        </div>
      )}

      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-dark/80 backdrop-blur-sm">
          <div className="text-center">
            <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-muted">Loading graph data...</p>
          </div>
        </div>
      )}

      {error && !loading && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 max-w-xl rounded-xl border border-red-500/40 bg-red-500/10 p-2 text-center shadow-lg pointer-events-none">
          <p className="text-xs text-red-300 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-red-400" />{error}</p>
        </div>
      )}

      {showDebug && !loading && (
        <div className="absolute bottom-4 right-4 z-30 w-[360px] rounded-lg border border-cyan-500/30 bg-slate-950/90 p-3 text-xs text-cyan-100 shadow-xl">
          <p className="font-semibold text-cyan-300 mb-2">Visualization Debug</p>
          <p>Tables: {tables.length}</p>
          <p>Relationships: {relationships.length}</p>
          {debugInfo?.diagnostics?.generated_at ? <p>Generated At: {debugInfo.diagnostics.generated_at}</p> : null}
          {debugInfo?.diagnostics?.edge_count !== undefined ? <p>Diagnostics Edge Count: {debugInfo.diagnostics.edge_count}</p> : null}
          {debugInfo?.diagnostics ? (
            <div className="mt-2 rounded border border-cyan-500/20 bg-cyan-500/5 p-2">
              <p className="text-cyan-300 mb-1">Backend Diagnostics</p>
              <pre className="whitespace-pre-wrap break-words text-[11px] text-cyan-100/90">{JSON.stringify(debugInfo.diagnostics, null, 2)}</pre>
            </div>
          ) : null}
          <div className="mt-2 rounded border border-cyan-500/20 bg-cyan-500/5 p-2">
            <p className="text-cyan-300 mb-1">Sample Edges</p>
            {debugInfo.sampleEdges.length === 0 ? (
              <p className="text-cyan-100/80">No edges in payload</p>
            ) : (
              <pre className="whitespace-pre-wrap break-words text-[11px] text-cyan-100/90">{JSON.stringify(debugInfo.sampleEdges, null, 2)}</pre>
            )}
          </div>
        </div>
      )}

      {viewMode === "3d" ? <DBViz3D /> : viewMode === "2d" ? <ERDiagram2D /> : <AnalyticsDashboard />}
      <NodeDetailOverlay />
    </div>
  )
}
