import { Search } from "lucide-react"
import * as React from "react"

import { Input } from "@/components/ui/input"

/** Pause after the last keystroke before filtering, in ms. */
export const SEARCH_DEBOUNCE_MS = 200

interface CourseSearchFormProps {
  onSearch: (keyword: string) => void
}

/**
 * Search box that filters courses by keyword while the user types.
 * Filtering runs locally, so it waits only for a short pause in typing;
 * Enter applies the keyword at once. Typing stays enabled while filter data
 * loads; the keyword applies as soon as the courses appear.
 * @param props Called with the trimmed keyword.
 */
export function CourseSearchForm({ onSearch }: CourseSearchFormProps) {
  const [keyword, setKeyword] = React.useState("")
  const onSearchRef = React.useRef(onSearch)
  onSearchRef.current = onSearch

  React.useEffect(() => {
    const timer = window.setTimeout(
      () => onSearchRef.current(keyword.trim()),
      SEARCH_DEBOUNCE_MS
    )
    return () => window.clearTimeout(timer)
  }, [keyword])

  return (
    <form
      role="search"
      className="course-search-form relative flex items-center"
      onSubmit={(event) => {
        event.preventDefault()
        onSearch(keyword.trim())
      }}>
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute left-3 h-4 w-4 text-muted-foreground"
      />
      <Input
        type="search"
        aria-label="搜索课程名称或教师"
        placeholder="搜索课程名称或教师..."
        value={keyword}
        onChange={(event) => setKeyword(event.target.value)}
        className="flex-1 pl-9"
      />
    </form>
  )
}
