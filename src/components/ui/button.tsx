import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "cursor-pointer inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold transition-all duration-200 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--gp-blue)] text-white shadow-md hover:bg-[var(--gp-blue-dark)] hover:shadow-lg border border-transparent",
        destructive:
          "bg-[var(--gp-black)] text-white shadow-md hover:bg-[var(--gp-grey-800)] border border-transparent",
        outline:
          "border border-[var(--gp-grey-200)] bg-white text-[var(--gp-black)] shadow-sm hover:border-[var(--gp-blue)] hover:text-[var(--gp-blue)] hover:bg-[var(--gp-grey-50)]",
        secondary:
          "bg-[var(--gp-grey-100)] text-[var(--gp-black)] shadow-sm hover:bg-[var(--gp-grey-200)] border border-transparent",
        ghost:
          "text-[var(--gp-grey-800)] hover:bg-[var(--gp-grey-100)] hover:text-[var(--gp-blue)]",
        link: "text-[var(--gp-blue)] underline-offset-4 hover:underline hover:text-[var(--gp-blue-dark)]",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-lg px-3 text-xs",
        lg: "h-11 rounded-lg px-8",
        xs: "h-8 rounded-md px-2.5 text-xs",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
