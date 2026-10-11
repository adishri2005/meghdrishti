import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { toast } from 'sonner'

interface JsonViewerProps {
  data: unknown
  title?: string
  maxHeight?: string
  className?: string
}

export function JsonViewer({
  data,
  title,
  maxHeight = '400px',
  className = '',
}: JsonViewerProps) {
  const [copied, setCopied] = useState(false)

  const jsonString = typeof data === 'string' ? data : JSON.stringify(data, null, 2)

  const copyToClipboard = () => {
    navigator.clipboard.writeText(jsonString)
    setCopied(true)
    toast.success('Copied JSON to clipboard')
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className={`rounded-xl border border-border bg-surface-elevated overflow-hidden shadow-xs ${className}`}>
      <div className="flex items-center justify-between border-b border-border bg-surface px-3 py-2">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider font-mono">
          {title || 'JSON Payload'}
        </span>
        <button
          type="button"
          onClick={copyToClipboard}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-surface hover:text-foreground transition-colors"
        >
          {copied ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>

      <pre
        className="p-3 font-mono text-xs text-foreground leading-relaxed overflow-x-auto selection:bg-primary/20"
        style={{ maxHeight }}
      >
        <code>{jsonString}</code>
      </pre>
    </div>
  )
}
