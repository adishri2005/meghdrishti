interface LegendItem {
  id: string
  name: string
  color: string
  value?: string | number
  visible?: boolean
}

interface ChartLegendProps {
  items: LegendItem[]
  onToggle?: (id: string) => void
  onHover?: (id: string | null) => void
  className?: string
}

export function ChartLegend({
  items,
  onToggle,
  onHover,
  className = '',
}: ChartLegendProps) {
  return (
    <div className={`flex flex-wrap items-center gap-3 text-xs select-none ${className}`}>
      {items.map((item) => {
        const isVisible = item.visible !== false
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onToggle?.(item.id)}
            onMouseEnter={() => onHover?.(item.id)}
            onMouseLeave={() => onHover?.(null)}
            className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md transition-all ${
              isVisible
                ? 'hover:bg-muted/40 text-foreground'
                : 'opacity-40 hover:opacity-60 text-muted-foreground line-through'
            }`}
          >
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: item.color }}
            />
            <span className="font-sans font-medium text-[11px] truncate max-w-[140px]">
              {item.name}
            </span>
            {item.value !== undefined && (
              <span className="font-mono text-[11px] text-muted-foreground ml-1">
                {item.value}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
