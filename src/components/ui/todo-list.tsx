import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

export interface TodoItem {
  title: string
  type: string
  courseName: string
  deadline: string
  daysLeft: number | null
  link: string
}

interface TodoListProps {
  todos: TodoItem[]
  loading?: boolean
  emptyMessage?: string
}

type DeadlineVariant = "overdue" | "urgent" | "soon" | "normal"

function getDeadlineInfo(daysLeft: number | null): {
  variant: DeadlineVariant
  text: string
} | null {
  if (daysLeft === null) return null

  if (daysLeft <= 0) {
    return { variant: "overdue", text: "已过期" }
  } else if (daysLeft <= 3) {
    return { variant: "urgent", text: `剩余 ${daysLeft} 天` }
  } else if (daysLeft <= 7) {
    return { variant: "soon", text: `剩余 ${daysLeft} 天` }
  } else {
    return { variant: "normal", text: `剩余 ${daysLeft} 天` }
  }
}

function TodoCardSkeleton() {
  return (
    <Card>
      <CardHeader className="p-3 pb-1">
        <Skeleton className="h-4 w-2/5 mb-1" />
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-3/5" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      </CardHeader>
      <CardContent className="p-3 pt-0">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
      </CardContent>
    </Card>
  )
}

function TodoCard({ todo }: { todo: TodoItem }) {
  const deadlineInfo = getDeadlineInfo(todo.daysLeft)
  const CardWrapper = todo.link ? "a" : "div"
  const linkProps = todo.link
    ? { href: todo.link, target: "_blank", rel: "noopener noreferrer" }
    : {}

  return (
    <CardWrapper
      {...linkProps}
      className={cn("block no-underline", todo.link && "cursor-pointer group")}
    >
      <Card className="transition-all duration-200 hover:shadow-md hover:border-primary/50">
        <CardHeader className="p-3 pb-1">
          {todo.courseName && (
            <p className="text-sm text-muted-foreground truncate mb-1">
              {todo.courseName}
            </p>
          )}
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-lg font-semibold truncate group-hover:text-primary transition-colors">
              {todo.title}
            </CardTitle>
            {todo.type && (
              <Badge variant="secondary" className="shrink-0 text-xs">
                {todo.type}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-3 pt-0">
          <div className="space-y-0">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {todo.deadline}
              </span>
              {deadlineInfo && (
                <Badge variant={deadlineInfo.variant} className="shrink-0 text-xs">
                  {deadlineInfo.text}
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </CardWrapper>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <Card className="border-dashed">
      <CardContent className="p-8 text-center">
        <p className="text-sm text-muted-foreground">{message}</p>
      </CardContent>
    </Card>
  )
}

export function TodoList({
  todos,
  loading = false,
  emptyMessage = "太棒了，没有待办事项！",
}: TodoListProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <TodoCardSkeleton key={i} />
        ))}
      </div>
    )
  }

  if (todos.length === 0) {
    return <EmptyState message={emptyMessage} />
  }

  return (
    <div className="space-y-3">
      {todos.map((todo, index) => (
        <TodoCard key={index} todo={todo} />
      ))}
    </div>
  )
}

export { TodoCard, TodoCardSkeleton, getDeadlineInfo }
