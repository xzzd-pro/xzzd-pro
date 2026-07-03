import * as React from "react"
import { cn } from "@/lib/utils"

interface CollapsibleContextValue {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const CollapsibleContext = React.createContext<
  CollapsibleContextValue | undefined
>(undefined)

function useCollapsible() {
  const context = React.useContext(CollapsibleContext)
  if (!context) {
    throw new Error("useCollapsible must be used within a Collapsible")
  }
  return context
}

interface CollapsibleProps extends React.HTMLAttributes<HTMLDivElement> {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  defaultOpen?: boolean
}

const Collapsible = React.forwardRef<HTMLDivElement, CollapsibleProps>(
  (
    {
      className,
      children,
      open: controlledOpen,
      onOpenChange,
      defaultOpen = false,
      ...props
    },
    ref
  ) => {
    const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen)

    const isControlled = controlledOpen !== undefined
    const open = isControlled ? controlledOpen : uncontrolledOpen

    const handleOpenChange = React.useCallback(
      (newOpen: boolean) => {
        if (!isControlled) {
          setUncontrolledOpen(newOpen)
        }
        onOpenChange?.(newOpen)
      },
      [isControlled, onOpenChange]
    )

    return (
      <CollapsibleContext.Provider
        value={{ open, onOpenChange: handleOpenChange }}>
        <div
          ref={ref}
          data-state={open ? "open" : "closed"}
          className={cn(className)}
          {...props}
        >
          {children}
        </div>
      </CollapsibleContext.Provider>
    )
  }
)
Collapsible.displayName = "Collapsible"

const CollapsibleTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }
>(({ className, children, asChild, onClick, ...props }, ref) => {
  const { open, onOpenChange } = useCollapsible()

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    onOpenChange(!open)
    onClick?.(e)
  }

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<any>, {
      onClick: handleClick,
      "data-state": open ? "open" : "closed",
      "aria-expanded": open
    })
  }

  return (
    <button
      ref={ref}
      type="button"
      data-state={open ? "open" : "closed"}
      aria-expanded={open}
      className={cn(className)}
      onClick={handleClick}
      {...props}
    >
      {children}
    </button>
  )
})
CollapsibleTrigger.displayName = "CollapsibleTrigger"

interface CollapsibleContentProps
  extends React.HTMLAttributes<HTMLDivElement> {
  durationMs?: number
  unmountOnExit?: boolean
}

const CollapsibleContent = React.forwardRef<
  HTMLDivElement,
  CollapsibleContentProps
>(
  (
    {
      className,
      children,
      durationMs = 200,
      style,
      unmountOnExit = false,
      ...props
    },
    ref
  ) => {
    const { open } = useCollapsible()
    const contentRef = React.useRef<HTMLDivElement>(null)
    const unmountTimerRef = React.useRef<number | null>(null)
    const [height, setHeight] = React.useState<number | undefined>(
      open ? undefined : 0
    )
    const [shouldRender, setShouldRender] = React.useState(
      open || !unmountOnExit
    )

    React.useEffect(() => {
      if (open) {
        if (unmountTimerRef.current !== null) {
          window.clearTimeout(unmountTimerRef.current)
          unmountTimerRef.current = null
        }
        setShouldRender(true)
        return
      }

      if (!unmountOnExit) {
        setShouldRender(true)
        return
      }

      unmountTimerRef.current = window.setTimeout(() => {
        setShouldRender(false)
        unmountTimerRef.current = null
      }, durationMs)

      return () => {
        if (unmountTimerRef.current !== null) {
          window.clearTimeout(unmountTimerRef.current)
          unmountTimerRef.current = null
        }
      }
    }, [durationMs, open, unmountOnExit])

    React.useLayoutEffect(() => {
      const content = contentRef.current
      if (!content) {
        if (!open) setHeight(0)
        return
      }

      if (open) {
        const contentHeight = content.scrollHeight
        setHeight(contentHeight)
        const timer = window.setTimeout(() => setHeight(undefined), durationMs)
        return () => window.clearTimeout(timer)
      }

      const contentHeight = content.scrollHeight
      setHeight(contentHeight)
      requestAnimationFrame(() => {
        setHeight(0)
      })
    }, [durationMs, open, shouldRender])

    return (
      <div
        ref={ref}
        data-state={open ? "open" : "closed"}
        aria-hidden={!open}
        className={cn(
          "min-h-0 overflow-hidden transition-[height] ease-out",
          className
        )}
        style={{
          height: height === undefined ? "auto" : height,
          transitionDuration: `${durationMs}ms`,
          ...style
        }}
        {...props}>
        <div ref={contentRef}>{shouldRender ? children : null}</div>
      </div>
    )
  }
)
CollapsibleContent.displayName = "CollapsibleContent"

export { Collapsible, CollapsibleTrigger, CollapsibleContent }
