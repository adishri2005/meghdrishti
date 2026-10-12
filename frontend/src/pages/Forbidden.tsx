import { Link } from 'react-router-dom'
import { ArrowLeft, ShieldAlert } from 'lucide-react'

export default function Forbidden() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center p-6 select-none animate-in fade-in duration-200">
      <div className="w-12 h-12 rounded-xl bg-danger/10 border border-danger/25 flex items-center justify-center mb-4 text-danger shadow-xs">
        <ShieldAlert className="w-6 h-6 stroke-[1.5]" />
      </div>
      <h1 className="text-xl font-semibold tracking-tight mb-1 text-foreground">403 — Access Restricted</h1>
      <p className="text-xs text-muted-foreground max-w-sm mb-6 leading-relaxed">
        Your current role does not have permission to view this section or perform administrative operations.
      </p>
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-surface border border-border text-foreground font-medium text-xs hover:bg-muted/50 transition-colors shadow-xs"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Return to Overview</span>
      </Link>
    </div>
  )
}
