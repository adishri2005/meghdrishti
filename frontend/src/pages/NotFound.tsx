import { Link } from 'react-router-dom'
import { ArrowLeft, Compass } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center p-6 select-none animate-in fade-in duration-200">
      <div className="w-12 h-12 rounded-xl bg-muted/60 border border-border flex items-center justify-center mb-4 text-muted-foreground shadow-xs">
        <Compass className="w-6 h-6 stroke-[1.5]" />
      </div>
      <h1 className="text-xl font-semibold tracking-tight mb-1 text-foreground">404 — Page Not Found</h1>
      <p className="text-xs text-muted-foreground max-w-sm mb-6 leading-relaxed">
        The console route you are looking for does not exist or may have been relocated.
      </p>
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground font-medium text-xs hover:bg-primary/90 transition-colors shadow-xs"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Return to Overview</span>
      </Link>
    </div>
  )
}
