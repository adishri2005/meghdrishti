import { Link } from 'react-router-dom'
import { ArrowLeft, ShieldAlert } from 'lucide-react'

export default function Forbidden() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center p-6">
      <div className="w-16 h-16 rounded-2xl bg-danger/10 border border-danger/20 flex items-center justify-center mb-6 text-danger">
        <ShieldAlert className="w-8 h-8 stroke-[1.5]" />
      </div>
      <h1 className="text-3xl font-bold tracking-tight mb-2">403 — Access Restricted</h1>
      <p className="text-muted-foreground max-w-md mb-8">
        Your current role does not have permission to view this section or perform administrative operations.
      </p>
      <Link
        to="/"
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-elevated border border-border text-foreground font-medium text-sm hover:bg-muted transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Return to Overview
      </Link>
    </div>
  )
}
