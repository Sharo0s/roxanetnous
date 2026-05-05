import * as React from 'react'
import { useId } from 'react'

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className = '',
      label,
      error,
      id,
      'aria-invalid': ariaInvalidProp,
      'aria-describedby': ariaDescribedByProp,
      'aria-required': ariaRequiredProp,
      ...props
    },
    ref
  ) => {
    const generatedId = useId()
    const finalId = id ?? generatedId
    const errorId = `${finalId}-error`

    const describedBy =
      [ariaDescribedByProp, error ? errorId : undefined]
        .filter(Boolean)
        .join(' ') || undefined
    const ariaInvalid = ariaInvalidProp ?? (error ? true : undefined)
    const ariaRequired = ariaRequiredProp ?? (props.required ? true : undefined)

    return (
      <div className="w-full">
        <label htmlFor={finalId} className="block">
          {label && (
            <span className="block text-sm font-medium text-black mb-2">
              {label}
              {props.required && (
                <span className="text-gray-700"> (obligatoire)</span>
              )}
            </span>
          )}
          <input
            ref={ref}
            id={finalId}
            aria-invalid={ariaInvalid}
            aria-describedby={describedBy}
            aria-required={ariaRequired}
            className={`flex h-10 w-full rounded-lg border ${
              error ? 'border-red-500' : 'border-gray-400'
            } bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
              error ? 'focus:ring-red-500' : 'focus:ring-focus-ring'
            } disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
            {...props}
          />
        </label>
        {error && (
          <p id={errorId} role="alert" className="mt-1 text-sm text-red-700">
            {error}
          </p>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'

export { Input }
