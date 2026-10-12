import { useState, useEffect, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Eye, EyeOff, ShieldCheck, AlertCircle, KeyRound } from 'lucide-react'
import { useAuthStore } from '@/hooks/useAuth'
import { sanitizeRedirect } from '@/lib/security'

export default function Login() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const nextPath = sanitizeRedirect(searchParams.get('next'))

  const { login, isLoading, error } = useAuthStore()

  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('Admin@12345')
  const [showPassword, setShowPassword] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const [rateLimitTimer, setRateLimitTimer] = useState<number>(0)
  const [showDemoHint, setShowDemoHint] = useState(false)

  const showDemoBox = import.meta.env.VITE_SHOW_DEMO_HINT === 'true' || true

  // Countdown timer for 429 rate limit
  useEffect(() => {
    if (rateLimitTimer <= 0) return
    const timer = window.setInterval(() => {
      setRateLimitTimer((t) => Math.max(t - 1, 0))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [rateLimitTimer])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (rateLimitTimer > 0) return

    setLocalError(null)
    try {
      await login(username, password)
      navigate(nextPath, { replace: true })
    } catch (err: any) {
      if (err?.status === 429) {
        setRateLimitTimer(60)
        setLocalError('Too many attempts. Please wait 60 seconds.')
      } else {
        setLocalError(err?.message || 'Invalid username or password.')
      }
    }
  }

  const fillDemo = (user: string, pass: string) => {
    setUsername(user)
    setPassword(pass)
    setLocalError(null)
  }

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2 bg-background text-foreground select-none">
      {/* Left Minimalist Canvas */}
      <div className="hidden lg:flex flex-col justify-between p-12 bg-surface border-r border-border relative overflow-hidden">
        {/* Subtle geometric line art */}
        <div className="absolute inset-0 pointer-events-none opacity-10">
          <svg className="w-full h-full" viewBox="0 0 800 600" fill="none" stroke="currentColor">
            <line x1="100" y1="0" x2="100" y2="600" strokeWidth="1" strokeDasharray="4 8" />
            <line x1="300" y1="0" x2="300" y2="600" strokeWidth="1" strokeDasharray="4 8" />
            <line x1="500" y1="0" x2="500" y2="600" strokeWidth="1" strokeDasharray="4 8" />
            <line x1="700" y1="0" x2="700" y2="600" strokeWidth="1" strokeDasharray="4 8" />
            <path
              d="M0,420 Q200,260 400,340 T800,200"
              stroke="hsl(var(--primary))"
              strokeWidth="2"
              fill="none"
            />
          </svg>
        </div>

        {/* Brand */}
        <div className="flex items-center gap-2.5 relative z-10">
          <div className="w-8 h-8 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
            <svg
              className="w-4.5 h-4.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="m9 12 2 2 4-4" />
            </svg>
          </div>
          <span className="font-semibold text-base tracking-tight text-foreground font-mono">
            CostGuard
          </span>
        </div>

        {/* Value Proposition */}
        <div className="max-w-md relative z-10 space-y-3">
          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-muted/60 border border-border text-muted-foreground text-xs font-mono">
            <span>Project P75 Autonomous Detection</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground leading-snug">
            Precision FinOps & Autonomous Cloud Spend Anomaly Forensics
          </h1>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Real-time statistical detection using online Welford statistics, percentage jumps, and EWMA drift monitoring across distributed cloud resources.
          </p>
        </div>

        {/* Feature Badges */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground relative z-10 font-mono">
          <span>Blue/Green Active</span>
          <span className="text-border-strong">•</span>
          <span>Single-Origin Gateway</span>
          <span className="text-border-strong">•</span>
          <span>Prometheus Native</span>
        </div>
      </div>

      {/* Right Login Form */}
      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm space-y-6">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold tracking-tight text-foreground">Sign in to CostGuard</h2>
            <p className="text-xs text-muted-foreground">
              Enter your credentials to access the telemetry console.
            </p>
          </div>

          {(localError || error) && (
            <div className="p-3 rounded-md bg-danger/10 border border-danger/20 text-danger text-xs flex items-center gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{localError || error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                Username
              </label>
              <input
                id="login-username"
                type="text"
                required
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                className="w-full px-3 py-1.5 rounded-md bg-surface border border-border text-foreground text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring focus:border-ring transition-colors shadow-xs"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="login-password" className="text-xs font-medium text-foreground">
                  Password
                </label>
              </div>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-1.5 pr-8 rounded-md bg-surface border border-border text-foreground text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring focus:border-ring transition-colors font-mono shadow-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-2 text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                  title={showPassword ? 'Hide password' : 'Show password'}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || rateLimitTimer > 0}
              className="w-full py-2 px-3 rounded-md bg-primary text-primary-foreground font-medium text-xs hover:bg-primary/90 transition-colors disabled:opacity-50 shadow-xs flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  <span>Signing in...</span>
                </>
              ) : rateLimitTimer > 0 ? (
                <span>Rate limited ({rateLimitTimer}s)</span>
              ) : (
                <>
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Authenticate Session</span>
                </>
              )}
            </button>
          </form>

          {/* Demo Credentials Box */}
          {showDemoBox && (
            <div className="pt-3 border-t border-border">
              <button
                type="button"
                onClick={() => setShowDemoHint(!showDemoHint)}
                className="w-full text-xs text-muted-foreground hover:text-foreground flex items-center justify-between py-1 transition-colors"
              >
                <span className="flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>Demo Credentials Quick Fill</span>
                </span>
                <span className="text-[10px] uppercase font-mono text-muted-foreground">{showDemoHint ? 'Hide' : 'Show'}</span>
              </button>

              {showDemoHint && (
                <div className="mt-2 p-2.5 rounded-md bg-surface border border-border text-xs space-y-2 animate-in fade-in shadow-xs">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium text-foreground">admin</span>
                      <span className="text-[11px] text-muted-foreground ml-2">(Full access)</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => fillDemo('admin', 'Admin@12345')}
                      className="px-2 py-0.5 rounded border border-border text-foreground hover:bg-muted text-[11px] font-medium transition-colors"
                    >
                      Fill Admin
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium text-foreground">analyst</span>
                      <span className="text-[11px] text-muted-foreground ml-2">(Read/ack access)</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => fillDemo('analyst', 'Analyst@12345')}
                      className="px-2 py-0.5 rounded border border-border text-foreground hover:bg-muted text-[11px] font-medium transition-colors"
                    >
                      Fill Analyst
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
