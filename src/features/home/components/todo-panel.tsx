import * as React from "react"

import { TodoList, type TodoItem } from "@/components/ui/todo-list"

interface TodoPanelProps {
  todos: TodoItem[]
  loading?: boolean
}

/**
 * Panel listing the user's to-dos.
 * @param props To-dos and loading flag.
 */
export function TodoPanel({ todos, loading = false }: TodoPanelProps) {
  return (
    <TodoList
      todos={todos}
      loading={loading}
      emptyMessage="太棒了，没有待办事项！"
    />
  )
}

export type { TodoItem }
