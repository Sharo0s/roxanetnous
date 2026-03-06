import * as React from 'react'

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'success' | 'gold' | 'silver' | 'bronze'
}

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className = '', variant = 'default', children, ...props }, ref) => {
    const variants = {
      default: 'bg-kraft text-black',
      success: 'bg-accent text-black',
      gold: 'bg-accent text-black',
      silver: 'bg-gray-200 text-gray-700',
      bronze: 'bg-gray-300 text-gray-800',
    }

    return (
      <div
        ref={ref}
        className={`inline-flex items-center rounded-full px-3 py-1.5 text-xs font-medium ${variants[variant]} ${className}`}
        {...props}
      >
        {children}
      </div>
    )
  }
)

Badge.displayName = 'Badge'

export { Badge }
