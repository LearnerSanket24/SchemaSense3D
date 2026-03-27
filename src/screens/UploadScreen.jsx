import { useState, useRef } from "react"
import { bustSchemaCache, getSchema, uploadFile, clearDatabase } from "../api/api"
import { AlertCircle, CheckCircle, Sparkles } from "lucide-react"

export default function UploadScreen({ onContinue }) {
  const [fileName, setFileName] = useState("")
  const [fileCount, setFileCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [progress, setProgress] = useState(0)
  const fileInputRef = useRef(null)

  function handleSampleDataset(name) {
    setError("")
    setNotice("")
    setFileName(`${name} (Demo)`)
    setTimeout(() => onContinue(), 500)
  }

  async function handleFileUpload(files) {
    if (!files || files.length === 0) return

    try {
      setLoading(true)
      setError("")
      setNotice("")
      setFileCount(files.length)
      setProgress(0)

      // Option A: Clear previous database explicitly before parallel uploads begin to avoid race conditions.
      try {
        await clearDatabase()
      } catch (clearErr) {
        console.warn("Could not clear previous database prior to upload:", clearErr)
      }

      const fileList = Array.from(files)
      let uploadedCount = 0

      await Promise.all(
        fileList.map(async (file) => {
          await uploadFile(file)
          uploadedCount += 1
          setFileName(`${uploadedCount}/${fileList.length}: ${file.name}`)
          setProgress((uploadedCount / fileList.length) * 100)
        })
      )

      // Invalidate schema cache so dictionary/visualization pull fresh tables.
      bustSchemaCache()

      // Verify backend actually has the expected number of tables.
      let tableCount = 0
      try {
        const schemaRes = await getSchema()
        const schemaTables = Array.isArray(schemaRes?.data?.tables) ? schemaRes.data.tables : []
        tableCount = schemaTables.length
      } catch (schemaErr) {
        console.warn("Schema verification after upload failed", schemaErr)
      }

      let showNotice = false
      if (files.length > 1 && tableCount <= 1) {
        showNotice = true
        setNotice("Backend currently shows only 1 table after multi-file upload. Ask Member 1 to append files during ingest, or upload a single ZIP containing all CSVs.")
      } else if (tableCount > files.length + 3) {
        showNotice = true
        setNotice(`Note: Backend database now contains ${tableCount} tables. It appears previous datasets were not cleared. (Ask Member 1 to wipe the DB on new uploads if this is unintended).`)
      }

      // After all files uploaded, wait and continue
      setTimeout(() => {
        setFileCount(0)
        setProgress(0)
        onContinue()
      }, showNotice ? 4500 : 1200)

    } catch (err) {
      console.error(err)
      if (err?.code === "ERR_NETWORK" || (err?.message || "").includes("ERR_NGROK")) {
        setError("Backend is unreachable (ngrok offline). Please restart ngrok and FastAPI, then try again.")
      } else {
        setError(`Upload failed: ${err?.message || "Unknown error"}. Try again.`)
      }
    } finally {
      setLoading(false)
      // Reset file input so same file can be uploaded again
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] relative overflow-hidden flex flex-col justify-center items-center p-8">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-24 -left-24 w-80 h-80 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-28 -right-24 w-80 h-80 rounded-full bg-accent/10 blur-3xl" />
      </div>

      <div className="text-center max-w-2xl w-full">
        {/* Title with gradient */}
        <h1 className="text-5xl font-bold mb-3 bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent animate-fade-in glow-text">
          SchemaSense 3D
        </h1>
        <p className="text-muted-foreground text-lg mb-12 animate-slide-up">
          Upload your CSV dataset to generate an interactive 3D schema visualization
        </p>

        {/* Upload Box */}
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            handleFileUpload(e.dataTransfer.files)
          }}
          className={`
            max-w-md mx-auto mb-10 p-12 border-2 border-dashed border-primary/70 rounded-xl
            cursor-pointer transition-all duration-300 glass-panel hover:border-primary hover:scale-[1.01]
            ${loading ? "bg-card/90" : "bg-card/70"}
          `}
        >
          <div className="text-5xl mb-4">{loading ? "⏳" : "📁"}</div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".csv,.zip,.sqlite,.db"
            onChange={(e) => handleFileUpload(e.target.files)}
            style={{ display: "none" }}
            disabled={loading}
          />
          <p className="text-lg text-primary font-semibold mb-2">
            {fileName ? `${fileName}` : "Drag & drop files or click to browse"}
          </p>
          <p className="text-sm text-muted-foreground">
            Upload one or multiple CSV files, or a ZIP containing CSVs
          </p>
        </div>

        {/* Progress Bar */}
        {loading && fileCount > 0 && (
          <div className="mb-8 max-w-md mx-auto animate-slide-up">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-semibold">Uploading...</span>
              <span className="text-xs text-muted-foreground">{Math.round(progress)}%</span>
            </div>
            <div className="w-full h-2 bg-border rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-500 ease-out"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="max-w-md mx-auto mb-6 p-4 bg-red-500/10 border border-red-500/50 rounded-lg flex gap-3 animate-slide-up">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-500">{error}</p>
          </div>
        )}

        {/* Backend Notice */}
        {notice && (
          <div className="max-w-2xl mx-auto mb-6 p-4 bg-yellow-500/10 border border-yellow-500/40 rounded-lg flex gap-3 animate-slide-up text-left">
            <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-yellow-200">{notice}</p>
          </div>
        )}

        {/* Success Message */}
        {progress === 100 && !loading && (
          <div className="max-w-md mx-auto mb-6 p-4 bg-green-500/10 border border-green-500/50 rounded-lg flex gap-3 animate-slide-up">
            <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-green-500">Upload complete! Redirecting...</p>
          </div>
        )}

        {/* Sample Datasets */}
        <div className="max-w-2xl mx-auto mt-8 animate-fade-in">
          <div className="flex items-center justify-center gap-2 mb-3 text-muted-foreground">
            <Sparkles className="w-4 h-4" />
            <p className="text-sm">Or try a sample dataset instantly</p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => handleSampleDataset("Olist E-Commerce")}
              className="px-4 py-2 text-sm rounded-lg border border-primary/35 text-primary hover:bg-primary/10 transition-colors"
            >
              Olist E-Commerce
            </button>
            <button
              onClick={() => handleSampleDataset("Chinook Music")}
              className="px-4 py-2 text-sm rounded-lg border border-accent/35 text-accent hover:bg-accent/10 transition-colors"
            >
              Chinook Music
            </button>
            <button
              onClick={() => handleSampleDataset("Bike Store")}
              className="px-4 py-2 text-sm rounded-lg border border-green-500/40 text-green-400 hover:bg-green-500/10 transition-colors"
            >
              Bike Store
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}