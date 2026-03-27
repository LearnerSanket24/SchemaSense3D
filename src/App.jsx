import { useState, useEffect } from "react"
import { SignedIn, SignedOut, UserButton, useAuth } from "@clerk/clerk-react"
import { Routes, Route, Navigate, NavLink, useNavigate } from "react-router-dom"
import { setTokenGetter } from "./api/api"

import UploadScreen from "./screens/UploadScreen"
import DictionaryScreen from "./screens/DictionaryScreen"
import ChatScreen from "./screens/ChatScreen"
import QualityScreen from "./screens/QualityScreen"
import Visualization3D from "./screens/Visualization3D"
import SignInScreen from "./screens/SignInScreen"
import SignUpScreen from "./screens/SignUpScreen"
import { Database, Menu, X } from "lucide-react"

function NavItem({ label, to, onClick }) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) =>
        `px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
          isActive
            ? "bg-accent text-accent-foreground shadow-md"
            : "text-muted-foreground hover:bg-secondary hover:text-foreground"
        }`
      }
    >
      {label}
    </NavLink>
  )
}

function MainLayout({ children }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <div className="bg-background text-foreground min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-border/70 bg-card/75 backdrop-blur-xl sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center glow-border">
                <Database className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="text-lg font-bold hidden sm:flex items-center gap-2">
                  SchemaSense
                  <span className="text-xs font-mono font-normal text-primary bg-primary/10 px-2 py-0.5 rounded-full">3D</span>
                </h1>
                <span className="text-xs text-muted-foreground hidden lg:block">Interactive Data Visualization</span>
              </div>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-2">
              <NavItem label="Upload" to="/upload" />
              <NavItem label="Dictionary" to="/dictionary" />
              <NavItem label="Chat" to="/chat" />
              <NavItem label="Visualization" to="/visualization" />
              <NavItem label="Quality" to="/quality" />

              <NavLink
                to="/upload"
                className="ml-2 px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90 transition-colors glow-border"
              >
                + New Dataset
              </NavLink>

              {/* Authentication UI */}
              <div className="ml-4 flex items-center border-l border-border/70 pl-4 h-8">
                <UserButton 
                  appearance={{
                    elements: {
                      avatarBox: "w-8 h-8 rounded-lg border border-primary/40 shadow-sm"
                    }
                  }}
                />
              </div>
            </nav>

            {/* Mobile Menu Button */}
            <button
              className="md:hidden p-2 hover:bg-secondary rounded-lg"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </button>
          </div>

          {/* Mobile Navigation */}
          {mobileMenuOpen && (
            <div className="md:hidden border-t border-border/70 py-4 flex flex-col space-y-2">
              <NavItem label="Upload" to="/upload" onClick={() => setMobileMenuOpen(false)} />
              <NavItem label="Dictionary" to="/dictionary" onClick={() => setMobileMenuOpen(false)} />
              <NavItem label="Chat" to="/chat" onClick={() => setMobileMenuOpen(false)} />
              <NavItem label="Visualization" to="/visualization" onClick={() => setMobileMenuOpen(false)} />
              <NavItem label="Quality" to="/quality" onClick={() => setMobileMenuOpen(false)} />
              
              <NavLink
                to="/upload"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full text-center px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90 transition-colors"
              >
                + New Dataset
              </NavLink>

              <div className="pt-2 border-t border-border/70 mt-2 flex justify-center">
                <UserButton />
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="w-full flex-1">
        {children}
      </main>
    </div>
  )
}

function ProtectedRoute({ children }) {
  return (
    <>
      <SignedIn>
        <MainLayout>
          {children}
        </MainLayout>
      </SignedIn>
      <SignedOut>
        <Navigate to="/sign-in" replace />
      </SignedOut>
    </>
  )
}

export default function App() {
  const { getToken } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    // Pass the Clerk token getter to our Axios instance
    setTokenGetter(getToken)
  }, [getToken])

  return (
    <Routes>
      {/* Public Auth Routes */}
      <Route path="/sign-in/*" element={<SignInScreen />} />
      <Route path="/sign-up/*" element={<SignUpScreen />} />

      {/* Protected UI Routes */}
      <Route path="/upload" element={<ProtectedRoute><UploadScreen onContinue={() => navigate('/dictionary')} /></ProtectedRoute>} />
      <Route path="/dictionary" element={<ProtectedRoute><DictionaryScreen /></ProtectedRoute>} />
      <Route path="/chat" element={<ProtectedRoute><ChatScreen /></ProtectedRoute>} />
      <Route path="/visualization" element={<ProtectedRoute><Visualization3D /></ProtectedRoute>} />
      <Route path="/quality" element={<ProtectedRoute><QualityScreen /></ProtectedRoute>} />

      {/* Index Redirect */}
      <Route path="/" element={
        <>
          <SignedIn><Navigate to="/upload" replace /></SignedIn>
          <SignedOut><Navigate to="/sign-in" replace /></SignedOut>
        </>
      } />

      {/* 404 Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
