import { useMemo } from "react"
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, PieChart, Pie } from "recharts"
import { Database, Rows, Columns, Activity } from "lucide-react"
import { useVisualizationStore } from "../store/useVisualizationStore"

const COLORS = ["#00d4ff", "#7c5cfc", "#ff6b9d", "#fbbf24", "#34d399", "#38bdf8"]

function StatCard({ icon: Icon, label, value, sub }) {
  return (
    <div className="rounded-xl border border-border bg-secondary/80 p-4">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-9 h-9 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center">
          <Icon className="w-4 h-4 text-primary" />
        </div>
        <p className="text-xs text-muted">{label}</p>
      </div>
      <p className="text-2xl font-bold">{typeof value === "number" ? value.toLocaleString() : value}</p>
      {sub ? <p className="text-[11px] text-muted mt-1">{sub}</p> : null}
    </div>
  )
}

export default function AnalyticsDashboard() {
  const { tables, relationships } = useVisualizationStore()

  const stats = useMemo(() => {
    const totalRows = tables.reduce((s, t) => s + Number(t.rows || 0), 0)
    const totalCols = tables.reduce((s, t) => s + (t.columns || []).length, 0)
    const avgQuality = tables.length
      ? Math.round(tables.reduce((s, t) => s + Number(t.qualityScore || 0), 0) / tables.length)
      : 0
    return { totalRows, totalCols, avgQuality }
  }, [tables])

  const rowsByTable = useMemo(
    () => tables
      .map((t) => ({ name: t.name.replace(/^olist_/, "").replace(/_/g, " "), rows: Number(t.rows || 0) }))
      .sort((a, b) => b.rows - a.rows)
      .slice(0, 10),
    [tables]
  )

  const qualityDist = useMemo(() => {
    const excellent = tables.filter((t) => Number(t.qualityScore || 0) >= 85).length
    const warning = tables.filter((t) => Number(t.qualityScore || 0) >= 60 && Number(t.qualityScore || 0) < 85).length
    const critical = tables.filter((t) => Number(t.qualityScore || 0) < 60).length
    return [
      { name: "Excellent", value: excellent, color: "#22c55e" },
      { name: "Warning", value: warning, color: "#f59e0b" },
      { name: "Critical", value: critical, color: "#ef4444" },
    ]
  }, [tables])

  return (
    <div className="absolute inset-0 z-10 overflow-auto p-4 pt-16 md:p-6 md:pt-20 lg:p-8 lg:pt-20">     
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard icon={Database} label="Tables" value={tables.length} />
          <StatCard icon={Rows} label="Total Rows" value={stats.totalRows} />
          <StatCard icon={Columns} label="Total Columns" value={stats.totalCols} />
          <StatCard icon={Activity} label="Avg Quality" value={`${stats.avgQuality}%`} sub={`${relationships.length} relationships`} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-xl border border-border bg-secondary/80 p-4 h-[360px]">
            <p className="text-sm font-semibold mb-4">Rows per Table (Top 10)</p>
            <ResponsiveContainer width="100%" height="92%">
              <BarChart data={rowsByTable} layout="vertical" margin={{ left: 12, right: 12 }}>
                <XAxis type="number" tick={{ fill: "#9ca3af", fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={110} tick={{ fill: "#9ca3af", fontSize: 11 }} />
                <Tooltip cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                <Bar dataKey="rows" radius={[0, 6, 6, 0]}>
                  {rowsByTable.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="rounded-xl border border-border bg-secondary/80 p-4 h-[360px]">
            <p className="text-sm font-semibold mb-4">Quality Distribution</p>
            <ResponsiveContainer width="100%" height="92%">
              <PieChart>
                <Pie data={qualityDist} dataKey="value" nameKey="name" innerRadius={65} outerRadius={115} paddingAngle={2}>
                  {qualityDist.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  )
}
