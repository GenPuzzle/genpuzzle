"use client"

import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"

import { cn } from "@/lib/utils"

const Tabs = TabsPrimitive.Root

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, orientation, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    orientation={orientation}
    className={cn(
      orientation === "vertical"
        ? "flex h-auto flex-col w-20 gap-2 rounded-md bg-[var(--gp-grey-100)] p-1 text-[var(--gp-grey-600)]"
        : "inline-flex h-10 items-center justify-center rounded-md bg-[var(--gp-grey-100)] p-1 text-[var(--gp-grey-600)]",
      className
    )}
    {...props}
  />
))
TabsList.displayName = TabsPrimitive.List.displayName

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger> & {
    /** Short visible label under the icon. Falls back to `title` when omitted. */
    label?: string
  }
>(({ className, children, title, label, ...props }, ref) => {
  const visibleLabel = label ?? title
  return (
  <TabsPrimitive.Trigger
    ref={ref}
    title={title}
    aria-label={title ?? label}
    className={cn(
      "modern-tabs-trigger inline-flex h-auto w-20 flex-col items-center justify-center rounded-md text-sm font-medium ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 text-current",
      className
    )}
    {...props}
  >
    <span className="relative z-[1] flex flex-col items-center justify-center gap-1.5 px-0.5 py-0.5">
      <span className="inline-flex items-center justify-center [&>svg]:h-[1.55rem] [&>svg]:w-[1.55rem] [&>svg]:stroke-[2]">
        {children}
      </span>
      {visibleLabel && (
        <span className="tab-subtitle text-[10px] font-semibold tracking-tight leading-none text-center">
          {visibleLabel}
        </span>
      )}
    </span>
  </TabsPrimitive.Trigger>
  )
})
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className
    )}
    {...props}
  />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent }
