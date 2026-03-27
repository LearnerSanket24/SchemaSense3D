import { useEffect, useMemo, useRef, useState } from "react"
import { analyzeTableWithAI, getSchemaWithCache } from "../api/api"
import { SkeletonTable } from "../components/Skeletons"
import { RefreshCw, AlertCircle, Database, Columns, Rows, Search, Sparkles } from "lucide-react"

const SCHEMA_CACHE_TTL_MS = 60_000

function getColumnName(col, idx) {
  if (typeof col === "string") return col
  return col?.display_name || col?.name || `column_${idx + 1}`
}

function getColumnType(col) {
  if (typeof col === "string") return "Unknown"
  return col?.type || "Unknown"
}

function isColumnPk(col) {
  if (typeof col === "string") return false
  return Boolean(col?.is_primary_key || col?.is_pk || col?.primary_key)
}

function isColumnNullable(col) {
  if (typeof col === "string") return null
  if (col?.null_percentage !== undefined) return col.null_percentage > 0
  if (typeof col?.nullable === "boolean") return col.nullable
  return null
}

function getColumnFk(col) {
  if (typeof col === "string") return "—"
  
  // SAFE DEMO MODE: Prevent Primary Keys from incorrectly showing as Foreign Keys
  if (isColumnPk(col)) return "—"

  if (col?.references && typeof col.references === "string") return col.references
  if (col?.foreign_key && typeof col.foreign_key === "string") return String(col.foreign_key)
  if (col?.fk_table || (col?.references && typeof col.references !== "string")) {
    const target = col.fk_table || col.references
    const targetCol = col.fk_column || col.references_column || "id"
    if (typeof target === 'string') return `${target}.${targetCol}`
  }
  if (col?.is_foreign_key || col?.is_fk) return "Yes"
  return "—"
}

function getColumnDefault(col) {
  if (typeof col === "string") return "—"
  return col?.default_value ?? col?.default ?? "—"
}

function getColumnSample(col) {
  if (typeof col === "string") return "—"
  const sample = col?.sample_value ?? col?.sample ?? col?.example
  if (sample === undefined || sample === null || sample === "") return "—"
  return String(sample)
}

function getColumnRawName(col, idx) {
  if (typeof col === "string") return col
  return col?.name || col?.display_name || `column_${idx + 1}`
}

function looksLikeSqlExecutionMessage(text) {
  const t = String(text || "").toLowerCase()
  return (
    t.includes("sql execution failed") ||
    t.includes("only read-only select") ||
    t.includes("execution_error") ||
    t.includes("returning fallback data") ||
    t.includes("failed even after self-correction")
  )
}

function buildLocalReasoning(table) {
  if (!table) return "No table selected."

  const columns = Array.isArray(table.columns) ? table.columns : []
  const name = String(table.display_name || table.name || "this table")

  const pkCols = columns
    .filter((c) => isColumnPk(c))
    .map((c, idx) => getColumnRawName(c, idx))

  const fkCols = columns
    .filter((c) => getColumnFk(c) !== "—")
    .map((c, idx) => `${getColumnRawName(c, idx)} -> ${getColumnFk(c)}`)

  const nullableCount = columns.filter((c) => isColumnNullable(c) !== false).length
  const totalRows = Number(table.row_count ?? table.rowCount ?? 0)

  const keyCandidates = columns
    .map((c, idx) => getColumnRawName(c, idx))
    .filter((n) => /(^id$|_id$|date|time|status|amount|price|qty|count)/i.test(n))
    .slice(0, 6)

  const risks = []
  if (nullableCount > 0) {
    risks.push(`${nullableCount} nullable columns may create missing-value issues in analytics.`)
  }
  if (!pkCols.length) {
    risks.push("No explicit primary key metadata detected; duplicates may be harder to control.")
  }
  if (!fkCols.length) {
    risks.push("No explicit foreign key metadata detected; joins may rely on naming conventions.")
  }
  if (totalRows === 0) {
    risks.push("Table currently reports 0 rows, so quality checks may be incomplete.")
  }

  return [
    `1) What this table stores`,
    `${name} appears to store domain records with ${columns.length} columns and ${totalRows.toLocaleString()} rows.`,
    "",
    `2) Key columns and likely meaning`,
    keyCandidates.length ? `Likely key/business columns: ${keyCandidates.join(", ")}.` : "Column names do not expose obvious business keys.",
    pkCols.length ? `Primary key columns: ${pkCols.join(", ")}.` : "Primary key metadata not explicitly available.",
    "",
    `3) Potential joins/relationships`,
    fkCols.length ? `Detected join hints: ${fkCols.slice(0, 6).join("; ")}.` : "No explicit FK links returned by backend for this table.",
    "",
    `4) Data quality risks`,
    risks.length ? risks.map((r) => `- ${r}`).join("\n") : "- No obvious risks detected from available metadata.",
  ].join("\n")
}

export default function DictionaryScreen() {
  const [tables, setTables] = useState([])
  const [activeTable, setActiveTable] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [tableSearch, setTableSearch] = useState("")
  const [columnSearch, setColumnSearch] = useState("")

  const [aiReasoning, setAiReasoning] = useState("")
  const [aiDisplay, setAiDisplay] = useState("")
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState("")
  const [summaryRole, setSummaryRole] = useState("business")
  const [summaryRefreshTick, setSummaryRefreshTick] = useState(0)
  const reasoningRunRef = useRef(0)

  const getBusinessSummary = (table) =>
    table?.business_summary || table?.businessSummary || table?.summaries?.business || ""

  const getDeveloperSummary = (table) =>
    table?.developer_summary || table?.developerSummary || table?.summaries?.developer || ""

  async function fetchSchema(forceFresh = false) {
    try {
      setLoading(true)
      setError("")

      const selectedName = activeTable?.name

      const res = await getSchemaWithCache({ force: forceFresh })
      console.log("Schema response:", res.data)

      const nextTables = Array.isArray(res?.data?.tables) ? res.data.tables : []
      setTables(nextTables)

      if (!selectedName && nextTables.length > 0) {
        setActiveTable(nextTables[0])
      } else if (selectedName) {
        const found = nextTables.find((t) => t.name === selectedName)
        setActiveTable(found || nextTables[0] || null)
      }

    } catch (err) {
      console.error(err)
      setError("Failed to load schema. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSchema()
  }, [])

  useEffect(() => {
    if (!activeTable) {
      setAiReasoning("")
      setAiDisplay("")
      return
    }

    let cancelled = false
    const runId = ++reasoningRunRef.current

    async function analyzeTable() {
      setAiLoading(true)
      setAiError("")
      setAiReasoning("")
      setAiDisplay("")

      const roleSummary =
        summaryRole === "business"
          ? getBusinessSummary(activeTable)
          : getDeveloperSummary(activeTable)

      if (roleSummary) {
        setAiReasoning(String(roleSummary))
        setAiLoading(false)
        return
      }

      const columnSummary = (activeTable.columns || [])
        .map((c, i) => `${getColumnName(c, i)} (${getColumnType(c)})`)
        .slice(0, 80)
        .join(", ")

      const prompt = [
        "Analyze this database table for a data dictionary UI.",
        "Return a concise explanation with:",
        "1) What the table stores",
        "2) Key columns and likely meaning",
        "3) Potential joins/relationships",
        "4) Data quality risks",
        `Role preference: ${summaryRole === "business" ? "Business Analyst" : "Backend Developer"}`,
        `Table: ${activeTable.name}`,
        `Columns: ${columnSummary}`,
      ].join("\n")

      try {
        const res = await analyzeTableWithAI(prompt)
        if (cancelled || runId !== reasoningRunRef.current) return

        const body = res?.data || {}
        const explanationRaw =
          body?.explanation ||
          body?.message ||
          ""

        if (!explanationRaw || looksLikeSqlExecutionMessage(explanationRaw)) {
          setAiReasoning(buildLocalReasoning(activeTable))
          return
        }

        setAiReasoning(String(explanationRaw))
      } catch (err) {
        if (cancelled || runId !== reasoningRunRef.current) return
        console.error("AI reasoning failed:", err)
        setAiError("Backend reasoning unavailable, using schema-based reasoning.")
        setAiReasoning(buildLocalReasoning(activeTable))
      } finally {
        if (!cancelled && runId === reasoningRunRef.current) {
          setAiLoading(false)
        }
      }
    }

    analyzeTable()

    return () => {
      cancelled = true
    }
  }, [activeTable?.name, summaryRole, summaryRefreshTick])

  useEffect(() => {
    const text = String(aiReasoning || "")
    setAiDisplay("")

    if (!text) return

    let idx = 0
    const timer = setInterval(() => {
      idx += 1
      setAiDisplay(text.slice(0, idx))
      if (idx >= text.length) {
        clearInterval(timer)
      }
    }, 12)

    return () => clearInterval(timer)
  }, [aiReasoning])

  const activeColumns = Array.isArray(activeTable?.columns) ? activeTable.columns : []
  const filteredTables = useMemo(() => {
    const q = tableSearch.trim().toLowerCase()
    if (!q) return tables
    return tables.filter((t) =>
      String(t.display_name || t.name || "").toLowerCase().includes(q)
    )
  }, [tables, tableSearch])

  const filteredColumns = useMemo(() => {
    const q = columnSearch.trim().toLowerCase()
    if (!q) return activeColumns
    return activeColumns.filter((c, i) => {
      const n = getColumnName(c, i).toLowerCase()
      const t = getColumnType(c).toLowerCase()
      return n.includes(q) || t.includes(q)
    })
  }, [activeColumns, columnSearch])

  const stats = useMemo(() => {
    const totalRows = Number(activeTable?.row_count ?? activeTable?.rowCount ?? 0)
    const totalColumns = activeColumns.length
    const nullableColumns = activeColumns.filter((c) => isColumnNullable(c) !== false).length
    return { totalRows, totalColumns, nullableColumns }
  }, [activeTable, activeColumns])

  return (
    <div className="h-[calc(100vh-4rem)] relative overflow-hidden flex">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-24 right-8 w-72 h-72 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-32 left-12 w-80 h-80 rounded-full bg-accent/10 blur-3xl" />
      </div>

      {/* Sidebar */}
      <div className="relative z-10 w-72 m-4 mr-0 glass-panel p-5 overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-bold">Data Dictionary</h3>
            <p className="text-xs text-muted-foreground">{tables.length} tables discovered</p>
          </div>
          <button
            onClick={() => fetchSchema(true)}
            disabled={loading}
            className="p-2 hover:bg-secondary rounded-lg transition-colors disabled:opacity-50"
            title="Refresh schema"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        <div className="mb-4 relative">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={tableSearch}
            onChange={(e) => setTableSearch(e.target.value)}
            placeholder="Search tables..."
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-background/70 border border-border/60 text-sm focus:outline-none focus:border-primary"
          />
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/50 rounded-lg flex gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-red-500">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-10 bg-border/80 rounded animate-skeleton"></div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredTables.map((table) => (
              <button
                key={table.id || table.name}
                onClick={() => setActiveTable(table)}
                className={`w-full text-left px-3 py-2 rounded-lg border transition-all duration-200 ${
                  activeTable?.name === table.name
                    ? "bg-primary/20 border-primary/40 text-primary"
                    : "border-border/40 text-muted-foreground hover:bg-secondary/70 hover:border-border"
                }`}
              >
                <p className="font-medium truncate">{table.display_name || table.name}</p>
                <p className="text-[11px] opacity-70">{Number(table.row_count ?? table.rowCount ?? 0).toLocaleString()} rows</p>
              </button>
            ))}
            {filteredTables.length === 0 && (
              <p className="text-xs text-muted-foreground px-2 py-2">No table matches your search.</p>
            )}
          </div>
        )}
      </div>

      {/* Main Panel */}
      <div className="relative z-10 flex-1 p-4 pl-5 overflow-y-auto">
        {!activeTable ? (
          <div className="glass-panel p-8 text-center">
            <Database className="w-10 h-10 mx-auto mb-3 text-primary" />
            <p className="text-muted-foreground">Select a table to view columns and metadata</p>
          </div>
        ) : (
          <div className="animate-fade-in space-y-4">
            <div className="glass-panel p-5">
              <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <h2 className="text-2xl font-bold mb-1">
                    {activeTable.display_name || activeTable.name}
                  </h2>
                  <p className="text-muted-foreground">
                    Table schema details and inferred column metadata
                  </p>
                </div>
                <div className="inline-flex rounded-lg border border-border/60 bg-background/70 p-1">
                  <button
                    onClick={() => setSummaryRole("business")}
                    className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                      summaryRole === "business"
                        ? "bg-primary/20 text-primary"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Business
                  </button>
                  <button
                    onClick={() => setSummaryRole("developer")}
                    className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                      summaryRole === "developer"
                        ? "bg-primary/20 text-primary"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Developer
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-lg bg-background/70 border border-border/60 p-3">
                  <p className="text-[11px] text-muted-foreground mb-1 inline-flex items-center gap-1"><Rows className="w-3.5 h-3.5" />Rows</p>
                  <p className="font-semibold">{stats.totalRows.toLocaleString()}</p>
                </div>
                <div className="rounded-lg bg-background/70 border border-border/60 p-3">
                  <p className="text-[11px] text-muted-foreground mb-1 inline-flex items-center gap-1"><Columns className="w-3.5 h-3.5" />Columns</p>
                  <p className="font-semibold">{stats.totalColumns}</p>
                </div>
                <div className="rounded-lg bg-background/70 border border-border/60 p-3">
                  <p className="text-[11px] text-muted-foreground mb-1">Nullable</p>
                  <p className="font-semibold">{stats.nullableColumns}</p>
                </div>
              </div>
            </div>

            {loading ? (
              <SkeletonTable />
            ) : (
              <div className="overflow-x-auto glass-panel p-4">
                <div className="mb-3 relative max-w-sm">
                  <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    value={columnSearch}
                    onChange={(e) => setColumnSearch(e.target.value)}
                    placeholder="Search columns..."
                    className="w-full pl-9 pr-3 py-2 rounded-lg bg-background/70 border border-border/60 text-sm focus:outline-none focus:border-primary"
                  />
                </div>

                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Column</th>
                      <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Type</th>
                      <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Primary Key</th>
                        <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Nulls</th>
                      <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Foreign Key</th>
                      <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Default</th>
                      <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Sample</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredColumns.map((col, idx) => (
                      <tr key={idx} className="border-b border-border/50 hover:bg-secondary/40 transition-colors">
                        <td className="py-3 px-4 font-mono text-primary">{getColumnName(col, idx)}</td>
                        <td className="py-3 px-4 text-muted-foreground">{getColumnType(col)}</td>
                        <td className="py-3 px-4">
                          {isColumnPk(col) ? (
                            <span className="text-xs px-2 py-1 rounded bg-primary/15 text-primary">Yes</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">No</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                            {col?.null_percentage !== undefined ? (
                              <span className={`text-xs px-2 py-1 rounded ${
                                col.null_percentage === 0 ? "bg-green-500/10 text-green-500" : "bg-yellow-500/10 text-yellow-500"
                              }`}>
                                {col.null_percentage === 0 ? "0%" : `${col.null_percentage}% null`}
                              </span>
                            ) : isColumnNullable(col) === null ? (
                            <span className="text-xs text-muted-foreground">—</span>
                          ) : (
                            <span className={`text-xs px-2 py-1 rounded ${
                              isColumnNullable(col) === false ? "bg-green-500/10 text-green-500" : "bg-yellow-500/10 text-yellow-500"
                            }`}>
                              {isColumnNullable(col) === false ? "No" : "Yes"}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {(() => {
                            const fkVal = getColumnFk(col)
                            if (fkVal === "—") return <span className="text-xs text-muted-foreground">—</span>
                            if (fkVal === "Yes") return <span className="text-xs px-2 py-1 rounded bg-indigo-500/15 text-indigo-400">Yes</span>
                            return <span className="text-xs px-2 py-1 rounded border border-indigo-500/30 bg-indigo-500/10 text-indigo-400 font-mono tracking-tight">{fkVal}</span>
                          })()}
                        </td>
                        <td className="py-3 px-4 text-muted-foreground font-mono text-xs">{getColumnDefault(col)}</td>
                        <td className="py-3 px-4 text-muted-foreground text-xs">{getColumnSample(col)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {filteredColumns.length === 0 && (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    No columns found for your search.
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* AI Reasoning Panel */}
      <div className="relative z-10 w-[360px] m-4 ml-0 glass-panel p-5 overflow-y-auto hidden lg:block">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold inline-flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            {summaryRole === "business" ? "Business Summary" : "Developer Summary"}
          </h3>
          {activeTable && (
            <button
              onClick={() => {
                if (activeTable) {
                  const next = tables.find((t) => t.name === activeTable.name)
                  if (next) setActiveTable({ ...next })
                }
                setSummaryRefreshTick((v) => v + 1)
              }}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Refresh
            </button>
          )}
        </div>

        {!activeTable ? (
          <p className="text-sm text-muted-foreground">Select a table to generate reasoning.</p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground mb-3">
              Table: <span className="text-foreground font-medium">{activeTable.name}</span>
            </p>

            {aiLoading && (
              <div className="mb-3 inline-flex items-center gap-2 text-xs text-muted-foreground">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Generating insights...
              </div>
            )}

            {aiError && (
              <div className="mb-3 p-2 rounded border border-yellow-500/40 bg-yellow-500/10 text-yellow-200 text-xs">
                {aiError}
              </div>
            )}

            <div className="rounded-lg bg-background/60 border border-border/60 p-3 min-h-[220px]">
              <p className="text-sm leading-relaxed whitespace-pre-wrap text-secondary-foreground">
                {aiDisplay || "Waiting for analysis..."}
                {(aiLoading || (aiDisplay && aiDisplay.length < aiReasoning.length)) && (
                  <span className="inline-block w-[6px] h-[1em] ml-0.5 align-middle bg-primary/80 animate-pulse" />
                )}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}