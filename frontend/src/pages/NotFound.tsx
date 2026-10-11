import { Link } from 'react-router-dom'
import { ArrowLeft, Compass } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center p-6">
      <div className="w-16 h-16 rounded-2xl bg-muted/40 border border-border flex items-center justify-center mb-6 text-muted-foreground">
        <Compass className="w-8 h-8 stroke-[1.5]" />
      </div>
      <h1 className="text-3xl font-bold tracking-tight mb-2">404 — Page Not Found</h1>
      <p className="text-muted-foreground max-w-md mb-8">
        The console route you are looking for does not exist or may have been relocated.
      </p>
      <Link
        to="/"
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity"
      >
        <ArrowLeft className="w-4 h-4" />
        Return to Overview
      </Link>
    </div>
  )
}
