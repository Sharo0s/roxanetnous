import * as React from 'react'

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', label, error, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-black mb-2">
            {label}
            {props.required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}
        <input
          ref={ref}
          className={`flex h-10 w-full rounded-lg border ${
            error ? 'border-red-500' : 'border-gray-400'
          } bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
            error ? 'focus:ring-red-500' : 'focus:ring-focus-ring'
          } disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
          {...props}
        />
        {error && <p className="mt-1 text-sm text-red-700">{error}</p>}
      </div>
    )
  }
)

Input.displayName = 'Input'

export { Input }
