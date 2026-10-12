import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 font-medium text-xs rounded-md transition-all select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ring-offset-background disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]',
  {
    variants: {
      variant: {
        primary:
          'bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs border border-transparent',
        secondary:
          'bg-surface hover:bg-muted text-foreground border border-border shadow-xs',
        outline:
          'bg-transparent border border-border text-foreground hover:bg-muted/40 shadow-xs',
        ghost:
          'hover:bg-muted/60 text-muted-foreground hover:text-foreground',
        destructive:
          'bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-xs border border-transparent',
        link:
          'text-primary underline-offset-4 hover:underline p-0 h-auto',
      },
      size: {
        sm: 'h-7 px-2.5 text-[11px]',
        md: 'h-8.5 px-3.5 text-xs',
        lg: 'h-10 px-4 text-sm',
        icon: 'h-8.5 w-8.5 p-0',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  isLoading?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      isLoading = false,
      disabled = false,
      leftIcon,
      rightIcon,
      children,
      type = 'button',
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || isLoading

    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        aria-disabled={isDisabled}
        aria-busy={isLoading}
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          leftIcon
        )}
        {children}
        {!isLoading && rightIcon}
      </button>
    )
  }
)
Button.displayName = 'Button'
