import { X, Command } from 'lucide-react'

interface ShortcutsDialogProps {
  isOpen: boolean
  onClose: () => void
}

const SHORTCUT_GROUPS = [
  {
    title: 'Navigation (Chords)',
    items: [
      { keys: ['g', 'o'], label: 'Go to Overview' },
      { keys: ['g', 'a'], label: 'Go to Anomalies' },
      { keys: ['g', 'c'], label: 'Go to Costs' },
      { keys: ['g', 'm'], label: 'Go to Monitoring' },
      { keys: ['g', 'l'], label: 'Go to Logs' },
      { keys: ['g', 'd'], label: 'Go to Deployments' },
      { keys: ['g', 's'], label: 'Go to Settings' },
    ],
  },
  {
    title: 'Global Controls',
    items: [
      { keys: ['⌘/Ctrl', 'K'], label: 'Open command palette' },
      { keys: ['/'], label: 'Focus quick search' },
      { keys: ['t'], label: 'Toggle light / dark theme' },
      { keys: ['r'], label: 'Trigger live refresh' },
      { keys: ['?'], label: 'Show this shortcuts dialog' },
    ],
  },
]

export function ShortcutsDialog({ isOpen, onClose }: ShortcutsDialogProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in">
      <div
        className="fixed inset-0"
        onClick={onClose}
      />
      <div className="relative w-full max-w-lg card-surface border border-border rounded-xl shadow-2xl p-6 z-10 animate-in zoom-in-95">
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Command className="w-5 h-5 text-primary" />
            <h2 className="text-base font-bold text-foreground">Keyboard Shortcuts</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-4 space-y-6">
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.title}>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                {group.title}
              </h3>
              <div className="space-y-2">
                {group.items.map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center justify-between text-xs py-1"
                  >
                    <span className="text-foreground">{item.label}</span>
                    <div className="flex items-center gap-1">
                      {item.keys.map((k) => (
                        <kbd
                          key={k}
                          className="px-2 py-0.5 rounded bg-muted border border-border-strong text-foreground font-mono text-[11px] shadow-sm"
                        >
                          {k}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 pt-4 border-t border-border flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium rounded-lg bg-surface-elevated border border-border hover:bg-muted transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
