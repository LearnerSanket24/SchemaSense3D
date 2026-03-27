import { useEffect, useState } from "react"
import { getQuality, getTableQuality } from "../api/api"
import { SkeletonCard } from "../components/Skeletons"
import GlobalQualityReport from "../components/GlobalQualityReport"
import { CheckCircle, AlertTriangle, XCircle, ChevronDown, ChevronUp } from "lucide-react"

export default function QualityScreen() {
  const mockData = [
    { 
      table: "orders", 
      score: 78,
      completeness: 95,
      freshness: 42,
      freshness_latest_date: "2018-09-03",
      freshness_days_ago: 2763,
      consistency: 88,
      orphan_issues: [
        { col: "customer_id", parent: "customers", orphans: 12 }
      ],
      columns: [
        { name: "customer_id", type: "VARCHAR", null_percent: 0.0, uniqueness_percent: 99.5, is_fk: true },
        { name: "order_date", type: "TIMESTAMP", null_percent: 0.0, uniqueness_percent: 80.0, is_pk: false }
      ]
    },
    { 
      table: "customers", 
      score: 85,
      completeness: 100,
      freshness: null,
      freshness_latest_date: null,
      freshness_days_ago: null,
      consistency: 100,
      orphan_issues: [],
      columns: [
        { name: "customer_id", type: "VARCHAR", null_percent: 0.0, uniqueness_percent: 100, is_pk: true }
      ]
    }
  ]

  const [data, setData] = useState(mockData)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [expandedTables, setExpandedTables] = useState({})
  const [detailLoading, setDetailLoading] = useState({})

  const withTimeout = (promise, ms = 20000) =>
    Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error("Request Timed Out")), ms)),
    ])

  const normalizeItem = (it = {}) => ({
    table: it?.table,
    score: it?.health_score ?? it?.score ?? 0,
    completeness: it?.completeness ?? 0,
    freshness: it?.freshness ?? null,
    freshness_latest_date: it?.freshness_latest_date ?? null,
    freshness_days_ago: it?.freshness_days_ago ?? null,
    consistency: it?.consistency ?? 0,
    orphan_issues: it?.orphan_issues ?? [],
    columns: Array.isArray(it?.columns) ? it.columns : [],
  })

  const loadTableDetails = async (table) => {
    if (!table) return
    setDetailLoading((prev) => ({ ...prev, [table]: true }))
    try {
      const detailRes = await withTimeout(getTableQuality(table), 12000)
      const raw = detailRes?.data
      if (!raw) return
      const merged = normalizeItem({ table, ...raw })
      setData((prev) =>
        prev.map((row) => (row.table === table ? { ...row, ...merged } : row))
      )
    } catch (e) {
      console.error("Table detail fetch failed:", table, e)
    } finally {
      setDetailLoading((prev) => ({ ...prev, [table]: false }))
    }
  }

  const toggleDetails = (table) => {
    setExpandedTables((prev) => {
      const nextOpen = !prev[table]
      if (nextOpen) {
        const row = data.find((d) => d.table === table)
        if (row && (!Array.isArray(row.columns) || row.columns.length === 0)) {
          loadTableDetails(table)
        }
      }
      return { ...prev, [table]: nextOpen }
    })
  }

  async function fetchQuality() {
    try {
      setLoading(true)
      setError("")

      // Load summary fast first; table detail loads lazily on expand.
      const res = await withTimeout(getQuality(), 20000)
      console.log("API response payload from /quality:", res?.data)
      const resData = res?.data

      const items = Array.isArray(resData?.items) ? resData.items : []
      const normalizedItems = items.map((it) => normalizeItem(it))

      if (normalizedItems.length > 0) {
        setData(normalizedItems)
      } else {
        setError("No quality items returned from backend. Showing cached demo data.")
        setData(mockData)
      }
    } catch (err) {
      console.error(err)
      setError("Failed to load quality data from backend. Showing cached demo data.")
      setData(mockData)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchQuality()
  }, [])

  const getScoreColor = (score) => {
    if (score >= 85) return "text-green-500"
    if (score >= 60) return "text-yellow-500"
    return "text-red-500"
  }

  const getScoreBg = (score) => {
    if (score >= 85) return "bg-green-500/20"
    if (score >= 60) return "bg-yellow-500/20"
    return "bg-red-500/20"
  }

  const getScoreIcon = (score) => {
    if (score >= 85) return <CheckCircle className="w-5 h-5" />
    if (score >= 60) return <AlertTriangle className="w-5 h-5" />
    return <XCircle className="w-5 h-5" />
  }

  const getSubMetricColor = (score) => {
    if (score >= 80) return "bg-gradient-to-r from-green-500 to-green-400"
    if (score >= 65) return "bg-gradient-to-r from-yellow-500 to-yellow-400"
    return "bg-gradient-to-r from-red-500 to-red-400"
  }

  const getFreshnessLabel = (days) => {
    if (days == null) return null
    if (days < 30) return "Updated recently"
    if (days < 365) return `${days} days ago`
    const years = Math.floor(days / 365)
    const remainingDays = days % 365
    return `${years} ${years > 1 ? "years" : "year"} ${remainingDays} days ago`
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] relative overflow-hidden p-6 md:p-8">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-24 -left-24 w-80 h-80 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-28 right-10 w-80 h-80 rounded-full bg-accent/10 blur-3xl" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8 glass-panel p-6">
          <h1 className="text-4xl font-bold mb-2 glow-text">Data Quality Overview</h1>
          <p className="text-muted-foreground">Monitor the health and completeness of your datasets</p>
        </div>

        {!loading && !error && <GlobalQualityReport />}

        {/* Error State */}
        {error && (
          <div className="mb-8 p-4 bg-yellow-500/10 border border-yellow-500/50 rounded-lg">
            <p className="text-sm text-yellow-500">{error}</p>
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="grid gap-6">
            {[...Array(4)].map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : (
          <div className="grid gap-8">
            {data.map((item, idx) => (
              <div
                key={idx}
                className={`glass-panel p-6 rounded-xl border border-border animate-slide-up bg-background/50`}
                style={{ animationDelay: `${idx * 0.1}s` }}
              >
                {/* Table Context */}
                <div className={`p-4 rounded-lg mb-2 flex flex-col md:flex-row md:items-center justify-between gap-4 ${getScoreBg(item.score)} border border-border/50`}>
                  <div className="flex items-center gap-4">
                    <div className={`${getScoreColor(item.score)}`}>
                      {getScoreIcon(item.score)}
                    </div>
                    <div>
                      <h3 className="text-xl font-bold capitalize">
                        {item.table?.replace(/_/g, " ")}
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Table Health Score: <span className={`font-semibold ${getScoreColor(item.score)}`}>{item.score}/100</span>
                      </p>
                    </div>
                  </div>
                  
                  <div className="w-full md:w-1/3 h-2 bg-muted/40 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ease-out ${
                        item.score >= 85
                          ? "bg-gradient-to-r from-green-500 to-green-400"
                          : item.score >= 60
                          ? "bg-gradient-to-r from-yellow-500 to-yellow-400"
                          : "bg-gradient-to-r from-red-500 to-red-400"
                      }`}
                      style={{
                        width: `${item.score}%`,
                        animation: `slideUp 0.6s cubic-bezier(0.22, 1, 0.36, 1) forwards`,
                      }}
                    />
                  </div>
                </div>

                {/* Details Toggle Button */}
                <button
                  onClick={() => toggleDetails(item.table)}
                  className="flex items-center justify-center w-full py-2 mb-4 text-sm text-muted-foreground hover:text-foreground transition-colors bg-background/50 border border-border/50 rounded-lg"
                >
                  {expandedTables[item.table] ? (
                    <>Hide Details <ChevronUp className="ml-1 w-4 h-4" /></>
                  ) : (
                    <>Details <ChevronDown className="ml-1 w-4 h-4" /></>
                  )}
                </button>

                {expandedTables[item.table] && (
                  <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                    {detailLoading[item.table] && (
                      <div className="mb-4 text-xs text-muted-foreground">Loading detailed metrics...</div>
                    )}
                    {/* 3 Mini Sub-Metric Rows */}
                    <div className="grid gap-4 mb-6 p-4 rounded-lg bg-background/30 border border-border/40">
                      
                      {/* COMPLETENESS */}
                      <div>
                        <div className="flex justify-between items-center text-sm mb-1">
                          <span className="font-semibold text-muted-foreground">Completeness [{item.completeness}%]</span>
                        </div>
                        <div className="w-full h-[6px] bg-muted/40 rounded-full overflow-hidden mb-1">
                          <div
                            className={`h-full rounded-full transition-all duration-700 ease-out ${getSubMetricColor(item.completeness)}`}
                            style={{ width: `${item.completeness}%` }}
                          />
                        </div>
                      </div>

                      {/* FRESHNESS */}
                      <div>
                        <div className="flex justify-between items-center text-sm mb-1">
                          <span className="font-semibold text-muted-foreground">
                            Freshness {item.freshness !== null ? `[${item.freshness}%]` : ""}
                          </span>
                        </div>
                        {item.freshness !== null ? (
                          <>
                            <div className="w-full h-[6px] bg-muted/40 rounded-full overflow-hidden mb-1">
                              <div
                                className={`h-full rounded-full transition-all duration-700 ease-out ${getSubMetricColor(item.freshness)}`}
                                style={{ width: `${item.freshness}%` }}
                              />
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {getFreshnessLabel(item.freshness_days_ago)}
                            </div>
                          </>
                        ) : (
                          <div className="text-xs text-muted-foreground italic">No date columns detected</div>
                        )}
                      </div>

                      {/* CONSISTENCY */}
                      <div>
                        <div className="flex justify-between items-center text-sm mb-1">
                          <span className="font-semibold text-muted-foreground">Consistency [{item.consistency}%]</span>
                        </div>
                        <div className="w-full h-[6px] bg-muted/40 rounded-full overflow-hidden mb-1">
                          <div
                            className={`h-full rounded-full transition-all duration-700 ease-out ${getSubMetricColor(item.consistency)}`}
                            style={{ width: `${item.consistency}%` }}
                          />
                        </div>
                        <div className="mt-1">
                          {item.orphan_issues && item.orphan_issues.length > 0 && item.orphan_issues.some(o => o.orphans > 0) ? (
                            item.orphan_issues.filter(o => o.orphans > 0).map((issue, idx) => (
                              <div key={idx} className="text-xs text-red-400 flex items-center mt-1">
                                <AlertTriangle className="w-3 h-3 mr-1" />
                                ⚠ {issue.col} → {issue.parent}: {issue.orphans} orphaned rows
                              </div>
                            ))
                          ) : (
                            <div className="text-xs text-green-500 flex items-center mt-1">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              ✓ No referential integrity violations
                            </div>
                          )}
                        </div>
                      </div>
                      
                    </div>

                    {/* Columns Table */}
                {item.columns && item.columns.length > 0 ? (
                  <div className="overflow-x-auto rounded-lg border border-border/50 bg-background/80">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-muted/30 text-muted-foreground border-b border-border/50">
                        <tr>
                          <th className="px-4 py-3 font-semibold whitespace-nowrap">Column Name</th>
                          <th className="px-4 py-3 font-semibold whitespace-nowrap">Type</th>
                          <th className="px-4 py-3 font-semibold whitespace-nowrap">Null %</th>
                          <th className="px-4 py-3 font-semibold whitespace-nowrap">Uniqueness</th>
                          <th className="px-4 py-3 font-semibold whitespace-nowrap">Flags</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/20">
                        {item.columns.map((col, colIdx) => {
                          const rawNull = parseFloat((col.null_percent ?? col.null_percentage ?? 0).toString().replace('%','') || 0)
                          const isPk = Boolean(col.is_pk || col.is_primary_key)
                          const isFk = Boolean(col.is_fk || col.is_foreign_key)
                          return (
                            <tr key={colIdx} className="hover:bg-muted/10 transition-colors">
                              <td className="px-4 py-3 font-medium text-foreground">{col.name}</td>
                              <td className="px-4 py-3 text-muted-foreground">{col.type || 'VARCHAR'}</td>
                              <td className="px-4 py-3" style={{
                                color: rawNull > 20 ? '#ef4444' : rawNull > 5 ? '#f59e0b' : '#22c55e'
                              }}>
                                {rawNull}%
                              </td>
                              <td className="px-4 py-3">{col.uniqueness_percent ?? col.uniqueness ?? '100'}%</td>
                              <td className="px-4 py-3 space-x-2">
                                {isPk && <span className="px-2 py-0.5 rounded text-xs bg-primary/20 text-primary border border-primary/30">PK</span>}
                                {isFk && <span className="px-2 py-0.5 rounded text-xs bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">FK</span>}
                                {!isPk && !isFk && <span className="text-muted-foreground">-</span>}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground italic p-4 text-center border border-border/30 rounded-lg">
                    No column metrics available for this table.
                  </div>
                )}
                </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Summary Stats */}
        {!loading && (
          <div className="mt-8 p-6 glass-panel rounded-xl">
            <h3 className="font-bold mb-4">Overall Summary</h3>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-3xl font-bold text-green-500">
                  {data.filter((d) => d.score >= 85).length}
                </p>
                <p className="text-xs text-muted-foreground">Excellent</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-yellow-500">
                  {data.filter((d) => d.score >= 60 && d.score < 85).length}
                </p>
                <p className="text-xs text-muted-foreground">Warning</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-red-500">
                  {data.filter((d) => d.score < 60).length}
                </p>
                <p className="text-xs text-muted-foreground">Critical</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}