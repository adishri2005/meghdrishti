import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

type SkeletonCardProps = HTMLAttributes<HTMLDivElement>

export function SkeletonCard({ className, ...props }: SkeletonCardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-border bg-surface/50 p-6 animate-pulse',
        className
      )}
      {...props}
    >
      <div className="h-4 w-1/3 bg-muted rounded mb-4" />
      <div className="h-8 w-1/2 bg-muted rounded" />
    </div>
  )
}
