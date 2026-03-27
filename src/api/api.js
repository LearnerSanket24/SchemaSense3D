import axios from "axios"

const API = axios.create({
  baseURL: "https://olivaceous-shaunte-indeterminedly.ngrok-free.dev",
})

// 🔥 IMPORTANT FIX FOR NGROK
API.defaults.headers["ngrok-skip-browser-warning"] = "true"

export default API

let authGetter = null
export const setTokenGetter = (getter) => {
  authGetter = getter
}

API.interceptors.request.use(async (config) => {
  if (authGetter) {
    try {
      const token = await authGetter()
      if (token) {
        config.headers.Authorization = `Bearer ${token}`
      }
    } catch (err) {
      console.warn("Failed to retrieve Clerk token for API request", err)
    }
  }
  return config
})

let schemaCache = null
let schemaCacheTime = 0
const SCHEMA_CACHE_TTL_MS = 60_000

// API FUNCTIONS
export const getSchema = () => API.get(`/schema?t=${Date.now()}`)
export const getSchemaWithCache = async ({ force = false } = {}) => {
  const age = Date.now() - schemaCacheTime
  if (!force && schemaCache && age < SCHEMA_CACHE_TTL_MS) {
    return schemaCache
  }

  const res = await API.get(`/schema?t=${Date.now()}`)
  schemaCache = res
  schemaCacheTime = Date.now()
  return res
}

export const bustSchemaCache = () => {
  schemaCache = null
  schemaCacheTime = 0
}

export const getQuality = () => API.get(`/quality?t=${Date.now()}`)
export const getTableQuality = (tableName) => API.get(`/quality/${tableName}?t=${Date.now()}`)
export const getRelationships = () => API.get(`/relationships?t=${Date.now()}`)
export const getGraphData = (payload = {}) => API.post("/graph-data", payload)
export const postQuery = (query) => API.post("/query", { query })
export const analyzeTableWithAI = (prompt) => API.post("/query", { query: prompt })
export const clearDatabase = () => API.post("/ingest/clear")

export const uploadFile = async (file) => {
  const formData = new FormData()
  formData.append("file", file)

  try {
    const res = await API.post("/ingest/file", formData)
    return res
  } catch (err) {
    throw err
  }
}