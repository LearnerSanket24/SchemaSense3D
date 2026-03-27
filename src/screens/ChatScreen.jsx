import { useEffect, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import API from "../api/api"
import { Send, AlertCircle, CheckCircle, Loader } from "lucide-react"
import { useVisualizationStore } from "../store/useVisualizationStore"

function normalizeUserQuestion(question) {
  const q = String(question || "").trim()
  const lower = q.toLowerCase()

  const sortIntent = /(sort|order\s*by|ascending|descending|asc\b|desc\b)/i.test(lower)
  const shortSortPattern = /^sort\s+(ascendingly|descendingly|asc|desc)?\s*(for|by)?\s+[a-zA-Z0-9_]+\s*$/i

  if (sortIntent && shortSortPattern.test(q)) {
    const colMatch = q.match(/([a-zA-Z_][a-zA-Z0-9_]*)\s*$/)
    const col = colMatch ? colMatch[1] : "id"
    const direction = /(desc|descending)/i.test(lower) ? "descending" : "ascending"
    return `Show top 20 rows sorted by ${col} in ${direction} order. Use a read-only SELECT query.`
  }

  return q
}

function shouldRetryWithClarifiedPrompt(body) {
  const explanation = String(body?.explanation || body?.message || "").toLowerCase()
  const executionError = String(body?.execution_error || "").toLowerCase()
  const sql = String(body?.sql || body?.query || "").trim().toLowerCase()

  const hasFallbackSignal =
    body?.used_fallback === true ||
    explanation.includes("empty sql generated") ||
    explanation.includes("self-correction") ||
    explanation.includes("returning fallback data") ||
    executionError.length > 0

  const sqlLooksInvalid = !sql || (!sql.startsWith("select") && !sql.startsWith("with"))
  return hasFallbackSignal && sqlLooksInvalid
}

function buildRetryPrompt(question) {
  return [
    "Rewrite the request into a single valid read-only SQL task.",
    "Use only SELECT/WITH SQL semantics.",
    "If sorting is requested, include ORDER BY with ASC/DESC.",
    `User request: ${question}`,
  ].join("\n")
}

function TypewriterText({ text, speed = 18, onDone }) {
  const [display, setDisplay] = useState("")
  const doneRef = useRef(false)

  useEffect(() => {
    doneRef.current = false
    setDisplay("")
    const fullText = String(text || "")
    if (!fullText) {
      if (!doneRef.current && onDone) {
        doneRef.current = true
        onDone()
      }
      return
    }

    let i = 0
    const timer = setInterval(() => {
      i += 1
      setDisplay(fullText.slice(0, i))
      if (i >= fullText.length) {
        clearInterval(timer)
        if (!doneRef.current && onDone) {
          doneRef.current = true
          onDone()
        }
      }
    }, speed)

    return () => clearInterval(timer)
  }, [text])

  return (
    <>
      {display}
      <span className="inline-block w-[6px] h-[1em] ml-0.5 align-middle bg-primary/80 animate-pulse" />
    </>
  )
}

function hasExecutionIssue(msg) {
  if (msg?.execution_ok === false && msg?.used_fallback !== true) return true

  const explanation = String(msg?.explanation || "").toLowerCase()
  const executionError = String(msg?.execution_error || "").trim()
  const issueWords = /(failed|error|fallback|self-correction|fix failed|syntax error)/

  if (executionError.length > 0) return true
  if (msg?.execution_ok === false) return true
  return issueWords.test(explanation)
}

function isFallbackWithData(msg) {
  if (msg?.used_fallback === true) return true

  const hasData = Array.isArray(msg?.results) && msg.results.length > 0
  const hasError = String(msg?.execution_error || "").trim().length > 0
  return hasData && hasError
}

export default function ChatScreen() {
  const [messages, setMessages] = useState([])
  const [revealedMessages, setRevealedMessages] = useState({})
  const [input, setInput] = useState("")
  const [isThinking, setIsThinking] = useState(false)
  const messageIdRef = useRef(0)
  const highlightQueriedTables = useVisualizationStore((s) => s.highlightQueriedTables)

  async function handleSend(questionOverride) {
    if (isThinking) return

    const questionValue =
      typeof questionOverride === "string" ? questionOverride : input

    if (!questionValue.trim()) return

    const normalizedQuestion = normalizeUserQuestion(questionValue)
    const userMsg = { id: ++messageIdRef.current, role: "user", text: questionValue }

    setMessages((prev) => [...prev, userMsg])
    setInput("")
    setIsThinking(true)

    try {
      // Backend contract expects `query`; sending extra keys can cause 422 on some deployments.
      let res = await API.post("/query", { query: normalizedQuestion })
      let body = res?.data || {}

      if (shouldRetryWithClarifiedPrompt(body)) {
        const retryPrompt = buildRetryPrompt(normalizedQuestion)
        res = await API.post("/query", { query: retryPrompt })
        body = res?.data || {}
      }

      console.log("Raw API response from /query:", body)
      const queriedTables = Array.isArray(body.queried_tables) ? body.queried_tables : []

      const results = Array.isArray(body.data) ? body.data : (Array.isArray(body.results) ? body.results : [])

      const aiMsg = {
        id: ++messageIdRef.current,
        role: "ai",
        kind: "result",
        sql: body.sql ?? body.query ?? "No SQL returned",
        explanation: body.explanation ?? body.message ?? "No explanation returned",
        results,
        execution_ok: body.execution_ok,
        execution_error: body.execution_error,
        used_fallback: body.used_fallback
      }

      setMessages((prev) => [...prev, aiMsg])

      if (queriedTables.length > 0) {
        highlightQueriedTables(queriedTables)
      }
    } catch (err) {
      console.error(err)
      setMessages((prev) => [
        ...prev,
        {
          role: "ai",
          id: ++messageIdRef.current,
          kind: "network_error",
          error: "Something went wrong. Please try again.",
          retryQuestion: questionValue
        }
      ])
    } finally {
      setIsThinking(false)
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] overflow-hidden">
      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.length === 0 && (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <div className="text-5xl mb-4">💬</div>
              <p className="text-muted text-lg">
                Ask something like "Show all orders"
              </p>
            </div>
          </div>
        )}

        <AnimatePresence>
          {messages.map((msg, i) => (
            <motion.div
              key={msg.id ?? i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
            >
              {msg.role === "user" && (
                <div className="flex justify-end mb-4">
                  <motion.div
                    initial={{ scale: 0.95 }}
                    animate={{ scale: 1 }}
                    className="inline-block max-w-xs lg:max-w-md px-4 py-3 bg-accent text-accent-foreground rounded-2xl shadow-lg"
                  >
                    {msg.text}
                  </motion.div>
                </div>
              )}

              {msg.role === "ai" && (
                <div className="flex justify-start mb-4">
                  <div className="max-w-2xl w-full">
                    {msg.kind === "network_error" ? (
                      <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4 flex gap-3">
                        <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-sm text-red-500 mb-3">{msg.error}</p>
                          <button
                            onClick={() => handleSend(msg.retryQuestion)}
                            className="px-3 py-1.5 bg-primary hover:bg-primary/90 text-white text-sm rounded-lg transition-colors"
                          >
                            Retry
                          </button>
                        </div>
                      </div>
                    ) : (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="glass-panel rounded-lg p-4 space-y-3"
                      >
                        {(() => {
                          const hasIssue = hasExecutionIssue(msg)
                          const fallbackData = isFallbackWithData(msg)
                          const isSuccess = msg.execution_ok === true && !hasIssue

                          return (
                            <>
                              {/* Execution warning when backend returns fallback rows */}
                              {fallbackData && (
                                <div className="flex gap-2 p-3 bg-yellow-500/10 rounded border border-yellow-500/50">
                                  <AlertCircle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                                  <p className="text-xs text-yellow-200">
                                    Backend returned fallback rows due to SQL guardrails. Results may not match your question exactly.
                                  </p>
                                </div>
                              )}

                              {/* Hard execution error when no valid rows are returned */}
                              {hasIssue && !fallbackData && (
                                <div className="flex gap-2 p-3 bg-red-500/10 rounded border border-red-500/50">
                                  <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                                  <p className="text-xs text-red-500">
                                    {msg.execution_error || "Query fallback/error detected in execution details."}
                                  </p>
                                </div>
                              )}

                              {/* Execution Success */}
                              {isSuccess && (
                                <div className="flex gap-2 p-3 bg-green-500/10 rounded border border-green-500/50">
                                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                                  <p className="text-xs text-green-500">Query executed successfully</p>
                                </div>
                              )}
                            </>
                          )
                        })()}

                        {/* SQL Query */}
                        <div className="bg-background/70 rounded p-3 border border-border/70">
                          <p className="text-xs font-semibold text-muted-foreground mb-2">SQL Query</p>
                          <pre className="text-sm text-primary font-mono whitespace-pre-wrap break-words overflow-hidden">
                            <TypewriterText text={msg.sql} speed={10} />
                          </pre>
                        </div>

                        {/* Explanation */}
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground mb-1">Explanation</p>
                          <p className="text-sm text-secondary-foreground leading-relaxed">
                            <TypewriterText
                              text={msg.explanation}
                              speed={15}
                              onDone={() => {
                                if (!revealedMessages[msg.id]) {
                                  setRevealedMessages((prev) => ({ ...prev, [msg.id]: true }))
                                }
                              }}
                            />
                          </p>
                        </div>

                        {/* Results Table */}
                        {revealedMessages[msg.id] && Array.isArray(msg.results) && msg.results.length > 0 ? (
                          <div className="overflow-x-auto">
                            <p className="text-xs font-semibold text-muted-foreground mb-2">Results</p>
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="border-b border-border">
                                  {Object.keys(msg.results[0] || {}).map((key) => (
                                    <th key={key} className="text-left py-2 px-2 text-muted-foreground font-semibold">
                                      {key}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {msg.results.slice(0, 10).map((row, idx) => (
                                  <tr key={idx} className="border-b border-border/50 hover:bg-muted/40">
                                    {Object.values(row).map((val, i) => (
                                      <td key={i} className="py-2 px-2 text-secondary-foreground">
                                        {String(val).substring(0, 50)}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            {msg.results.length > 10 && (
                              <p className="text-xs text-muted-foreground mt-2">
                                ... and {msg.results.length - 10} more rows
                              </p>
                            )}
                          </div>
                        ) : revealedMessages[msg.id] ? (
                          <p className="text-xs text-muted-foreground italic">No results returned</p>
                        ) : (
                          <p className="text-xs text-muted-foreground italic">Preparing result table...</p>
                        )}
                      </motion.div>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Thinking Indicator */}
        {isThinking && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-start"
          >
            <div className="flex items-center gap-2 px-4 py-3 glass-panel rounded-lg">
              <Loader className="w-4 h-4 text-primary animate-spin" />
              <span className="text-sm text-muted-foreground">AI is thinking...</span>
            </div>
          </motion.div>
        )}
      </div>

      {/* Input Area */}
      <div className="border-t border-border/70 p-4 md:p-6 bg-card/75 backdrop-blur-xl">
        <div className="max-w-4xl mx-auto flex gap-3">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === "Enter" && !isThinking) {
                handleSend()
              }
            }}
            placeholder="Ask something like 'Show all orders'"
            disabled={isThinking}
            className="flex-1 px-4 py-3 bg-background/80 border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={isThinking || !input.trim()}
            className="px-6 py-3 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2 glow-border"
          >
            {isThinking ? (
              <>
                <Loader className="w-4 h-4 animate-spin" />
                Thinking...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Send
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}