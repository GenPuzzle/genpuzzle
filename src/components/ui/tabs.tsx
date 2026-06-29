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
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, children, title, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "inline-flex h-auto w-20 flex-col items-center justify-center rounded-none text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-white data-[state=active]:text-[var(--gp-blue)] data-[state=active]:shadow-sm text-[var(--gp-grey-600)]",
      className
    )}
    {...props}
  >
    <span className="relative flex flex-col items-center justify-center w-full h-full gap-1">
      <span className="inline-flex items-center justify-center transition-transform duration-300 data-[state=active]:scale-110 hover:scale-105">
        {children}
      </span>
      {title && (
        <span className="tab-subtitle text-[11px] text-[var(--gp-grey-600)] data-[state=active]:text-[var(--gp-blue)] leading-none">
          {title}
        </span>
      )}
      <span
        aria-hidden
        className={cn(
          "absolute inset-0 rounded-none pointer-events-none transition-opacity duration-300",
          "opacity-0 data-[state=active]:opacity-100",
          "bg-[var(--gp-blue)]/10 blur-[4px]"
        )}
      />
    </span>
  </TabsPrimitive.Trigger>
))
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
