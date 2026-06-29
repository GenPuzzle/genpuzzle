"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

export interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "onChange"> {
  onCheckedChange?: (checked: boolean) => void
  label?: React.ReactNode
  compact?: boolean
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, checked, onCheckedChange, disabled, id, label, compact, children, ...props }, ref) => {
    const text = label ?? children
    const hasText = text !== undefined && text !== null && text !== ""

    return (
      <label
        className={cn(
          "custom-checkbox-container",
          compact && "custom-checkbox-container--compact",
          disabled && "custom-checkbox-container--disabled",
          className
        )}
      >
        <input
          type="checkbox"
          ref={ref}
          id={id}
          checked={checked}
          disabled={disabled}
          className="custom-checkbox-input"
          onChange={(event) => onCheckedChange?.(event.target.checked)}
          {...props}
        />
        <span
          className={cn(
            "custom-checkbox-label",
            !hasText && "custom-checkbox-label--box-only"
          )}
        >
          {hasText ? <span className="custom-checkbox-text">{text}</span> : null}
        </span>
      </label>
    )
  }
)
Checkbox.displayName = "Checkbox"

export { Checkbox }
