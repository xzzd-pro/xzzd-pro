import * as React from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search } from "lucide-react"

interface CourseSearchFormProps {
  onSearch: (keyword: string) => void
  disabled?: boolean
}

export function CourseSearchForm({ onSearch, disabled }: CourseSearchFormProps) {
  const [keyword, setKeyword] = React.useState("")
  return (
    <form className="course-search-form flex items-center gap-3" onSubmit={event => { event.preventDefault(); onSearch(keyword.trim()) }}>
      <Input aria-label="搜索课程名称或教师" placeholder="搜索课程名称或教师..." value={keyword}
        onChange={event => setKeyword(event.target.value)} className="flex-1" />
      <Button type="submit" disabled={disabled} className="shrink-0">
        <Search className="h-4 w-4" />搜索
      </Button>
    </form>
  )
}
