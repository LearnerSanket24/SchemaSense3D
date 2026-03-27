import { useState } from "react";
import { AlertCircle, AlertTriangle, Calculator, ListChecks, ShieldCheck, ChevronDown, ChevronUp } from "lucide-react";

export default function GlobalQualityReport({ report = null }) {
  const [expanded, setExpanded] = useState({
    critical: true,
    warnings: true,
    math: true,
    actions: true,
    verdict: true,
  });

  const toggleSection = (key) => setExpanded(prev => ({ ...prev, [key]: !prev[key] }));

  // Fallback default structure if backend doesn't send yet
  const data = report || {
    critical: ["No explicitly defined foreign key constraints in schema", "Table 'order_payments' lacks primary key detection"],
    warnings: ["Nullable columns found in critical paths (e.g., zip_code_prefix)", "Low freshness on 'products' table data"],
    math_summary: "Processed 9 tables, 52 total columns. Database average completeness score: 87%. Total detected relationships: 12.",
    actions: [
      "Explicitly define Composite Primary Keys on junction tables",
      "Set ON DELETE CASCADE rules for order_items",
      "Remove orphan rows in geolocation table"
    ],
    verdict: "Data schema is moderately healthy but relational constraints must be strictly enforced before production use."
  };

  return (
    <div className="mb-8 p-6 rounded-xl border border-border/60 bg-secondary/30 backdrop-blur-md">
      <div className="flex items-center gap-3 mb-6">
        <ShieldCheck className="w-6 h-6 text-primary" />
        <h2 className="text-xl font-bold">AI Database Health Assessment</h2>
      </div>

      <div className="space-y-4">
        {/* Critical */}
        {data.critical?.length > 0 && (
          <div className="border border-red-500/20 rounded-lg bg-red-500/5 overflow-hidden">
            <button onClick={() => toggleSection('critical')} className="w-full px-4 py-3 flex justify-between items-center bg-red-500/10 hover:bg-red-500/20 transition-colors">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-500" />
                <span className="font-semibold text-red-400">Critical Issues ({data.critical.length})</span>
              </div>
              {expanded.critical ? <ChevronUp className="w-4 h-4 text-red-400" /> : <ChevronDown className="w-4 h-4 text-red-400" />}
            </button>
            {expanded.critical && (
              <div className="p-4">
                <ul className="list-disc pl-5 space-y-1 text-sm text-red-200/80">
                  {data.critical.map((item, i) => <li key={i}>{item}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Warnings */}
        {data.warnings?.length > 0 && (
          <div className="border border-yellow-500/20 rounded-lg bg-yellow-500/5 overflow-hidden">
            <button onClick={() => toggleSection('warnings')} className="w-full px-4 py-3 flex justify-between items-center bg-yellow-500/10 hover:bg-yellow-500/20 transition-colors">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-yellow-500" />
                <span className="font-semibold text-yellow-400">Warnings ({data.warnings.length})</span>
              </div>
              {expanded.warnings ? <ChevronUp className="w-4 h-4 text-yellow-400" /> : <ChevronDown className="w-4 h-4 text-yellow-400" />}
            </button>
            {expanded.warnings && (
              <div className="p-4">
                <ul className="list-disc pl-5 space-y-1 text-sm text-yellow-200/80">
                  {data.warnings.map((item, i) => <li key={i}>{item}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Math Summary */}
        <div className="border border-blue-500/20 rounded-lg bg-blue-500/5 overflow-hidden">
          <button onClick={() => toggleSection('math')} className="w-full px-4 py-3 flex justify-between items-center bg-blue-500/10 hover:bg-blue-500/20 transition-colors">
            <div className="flex items-center gap-2">
              <Calculator className="w-4 h-4 text-blue-500" />
              <span className="font-semibold text-blue-400">Math Summary</span>
            </div>
            {expanded.math ? <ChevronUp className="w-4 h-4 text-blue-400" /> : <ChevronDown className="w-4 h-4 text-blue-400" />}
          </button>
          {expanded.math && (
            <div className="p-4 text-sm text-blue-200/80">
              {data.math_summary}
            </div>
          )}
        </div>

        {/* Actions */}
        {data.actions?.length > 0 && (
          <div className="border border-emerald-500/20 rounded-lg bg-emerald-500/5 overflow-hidden">
            <button onClick={() => toggleSection('actions')} className="w-full px-4 py-3 flex justify-between items-center bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors">
              <div className="flex items-center gap-2">
                <ListChecks className="w-4 h-4 text-emerald-500" />
                <span className="font-semibold text-emerald-400">Recommended Actions</span>
              </div>
              {expanded.actions ? <ChevronUp className="w-4 h-4 text-emerald-400" /> : <ChevronDown className="w-4 h-4 text-emerald-400" />}
            </button>
            {expanded.actions && (
              <div className="p-4">
                <div className="space-y-2">
                  {data.actions.map((item, i) => (
                    <label key={i} className="flex items-start gap-3 cursor-pointer group">
                      <input type="checkbox" className="mt-1 bg-dark border-emerald-500/30 rounded text-emerald-500 focus:ring-emerald-500/20 outline-none" />
                      <span className="text-sm text-emerald-200/80 group-hover:text-emerald-100 transition-colors">{item}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Verdict */}
        <div className="border border-primary/20 rounded-lg bg-primary/5 overflow-hidden">
          <button onClick={() => toggleSection('verdict')} className="w-full px-4 py-3 flex justify-between items-center bg-primary/10 hover:bg-primary/20 transition-colors">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-primary" />
              <span className="font-semibold text-primary">Final Verdict</span>
            </div>
            {expanded.verdict ? <ChevronUp className="w-4 h-4 text-primary" /> : <ChevronDown className="w-4 h-4 text-primary" />}
          </button>
          {expanded.verdict && (
            <div className="p-4">
              <p className="text-sm font-medium text-foreground">{data.verdict}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
