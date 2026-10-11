import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { toast } from 'sonner'

interface CopyButtonProps {
  value: string
  label?: string
  className?: string
  iconSize?: string
}

export function CopyButton({
  value,
  label = 'Value',
  className = '',
  iconSize = 'w-3.5 h-3.5',
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      toast.success(`${label} copied to clipboard`, { duration: 1500 })
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Failed to copy to clipboard')
    }
  }

  return (
    <button
      onClick={handleCopy}
      type="button"
      className={`p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors inline-flex items-center justify-center shrink-0 ${className}`}
      title={`Copy ${label}`}
      aria-label={`Copy ${label}`}
    >
      {copied ? (
        <Check className={`${iconSize} text-success animate-in zoom-in-50 duration-150`} />
      ) : (
        <Copy className={iconSize} />
      )}
    </button>
  )
}
