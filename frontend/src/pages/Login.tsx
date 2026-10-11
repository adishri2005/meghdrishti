import { useState, useEffect, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Eye, EyeOff, ShieldCheck, AlertCircle, Sparkles, KeyRound } from 'lucide-react'
import { useAuthStore } from '@/hooks/useAuth'

export default function Login() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const nextPath = searchParams.get('next') || '/'

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
      if (err.status === 429) {
        setRateLimitTimer(60)
        setLocalError('Too many attempts. Please wait 60 seconds.')
      } else {
        setLocalError(err.message || 'Invalid username or password.')
      }
    }
  }

  const fillDemo = (user: string, pass: string) => {
    setUsername(user)
    setPassword(pass)
    setLocalError(null)
  }

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2 bg-background text-foreground overflow-hidden">
      {/* Left Hero Section with Abstract Sparkline SVG Canvas */}
      <div className="hidden lg:flex flex-col justify-between p-12 bg-gradient-to-br from-surface to-background border-r border-border relative overflow-hidden select-none">
        {/* Animated Background Graphic */}
        <div className="absolute inset-0 pointer-events-none opacity-20">
          <svg className="w-full h-full" viewBox="0 0 800 600" preserveAspectRatio="none">
            <defs>
              <linearGradient id="grid-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#2DD4BF" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#60A5FA" stopOpacity="0.1" />
              </linearGradient>
            </defs>
            <path
              d="M0,450 C150,300 250,550 400,320 C550,120 650,400 800,220 L800,600 L0,600 Z"
              fill="url(#grid-grad)"
            />
            <path
              d="M0,450 C150,300 250,550 400,320 C550,120 650,400 800,220"
              fill="none"
              stroke="#2DD4BF"
              strokeWidth="2"
            />
            <path
              d="M0,480 C180,360 300,510 450,280 C600,160 700,320 800,180"
              fill="none"
              stroke="#60A5FA"
              strokeWidth="1.5"
              strokeDasharray="4 4"
            />
          </svg>
        </div>

        {/* Brand */}
        <div className="flex items-center gap-3 relative z-10">
          <svg
            className="w-9 h-9 text-primary"
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
          <span className="font-mono text-2xl font-bold tracking-tight text-foreground">
            CostGuard
          </span>
        </div>

        {/* Value Proposition */}
        <div className="max-w-md relative z-10 space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Project P75 Autonomous Detection</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground leading-tight">
            Mission Control for Cloud Spend & Anomaly Forensics
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Real-time statistical detection using online Welford statistics, percentage jumps, and EWMA drift across hundreds of cloud resources.
          </p>
        </div>

        {/* Feature Badges */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground relative z-10 font-mono">
          <span>• Blue/Green Active</span>
          <span>• Single-Origin Gateway</span>
          <span>• Prometheus Native</span>
        </div>
      </div>

      {/* Right Login Form */}
      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center lg:text-left space-y-1">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Sign In</h2>
            <p className="text-xs text-muted-foreground">
              Enter your credentials to access the CostGuard operations console.
            </p>
          </div>

          {(localError || error) && (
            <div className="p-3 rounded-lg bg-danger/10 border border-danger/20 text-danger text-xs flex items-center gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{localError || error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Username
              </label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. admin or analyst"
                className="w-full px-3 py-2 rounded-lg bg-surface border border-border text-foreground text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-shadow"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Password
                </label>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 pr-9 rounded-lg bg-surface border border-border text-foreground text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-shadow font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground transition-colors"
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || rateLimitTimer > 0}
              className="w-full py-2.5 px-4 rounded-lg bg-primary text-primary-foreground font-semibold text-xs hover:opacity-90 transition-opacity disabled:opacity-50 shadow-md flex items-center justify-center gap-2"
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
                  <ShieldCheck className="w-4 h-4" />
                  <span>Authenticate Session</span>
                </>
              )}
            </button>
          </form>

          {/* Demo Credentials Box */}
          {showDemoBox && (
            <div className="pt-2 border-t border-border/80">
              <button
                type="button"
                onClick={() => setShowDemoHint(!showDemoHint)}
                className="w-full text-xs text-muted-foreground hover:text-foreground flex items-center justify-between py-1 transition-colors"
              >
                <span className="flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-primary" />
                  <span>Demo Credentials Quick Fill</span>
                </span>
                <span className="text-[10px] uppercase font-mono">{showDemoHint ? 'Hide' : 'Show'}</span>
              </button>

              {showDemoHint && (
                <div className="mt-2.5 p-3 rounded-lg bg-surface-elevated border border-border text-xs space-y-2 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-foreground">admin</span>
                      <span className="text-[10px] text-muted-foreground ml-2">(Full access)</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => fillDemo('admin', 'Admin@12345')}
                      className="px-2 py-0.5 rounded bg-primary/10 text-primary text-[11px] font-semibold hover:bg-primary/20 transition-colors"
                    >
                      Fill Admin
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-foreground">analyst</span>
                      <span className="text-[10px] text-muted-foreground ml-2">(Read/ack access)</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => fillDemo('analyst', 'Analyst@12345')}
                      className="px-2 py-0.5 rounded bg-secondary/10 text-secondary text-[11px] font-semibold hover:bg-secondary/20 transition-colors"
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
