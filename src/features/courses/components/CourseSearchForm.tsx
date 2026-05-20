import * as React from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Search } from "lucide-react"

interface CourseSearchFormProps {
  onSearch: (filters: { keyword: string; status: string[] }) => void
}

export function CourseSearchForm({ onSearch }: CourseSearchFormProps) {
  const [keyword, setKeyword] = React.useState("")
  const [selectedStatus, setSelectedStatus] = React.useState<string[]>([
    "ongoing",
    "notStarted",
    "closed",
  ])

  const statusOptions = [
    { value: "ongoing", label: "进行中" },
    { value: "notStarted", label: "未开始" },
    { value: "closed", label: "已结束" },
  ]

  const handleSearch = () => {
    onSearch({
      keyword,
      status: selectedStatus.length > 0 ? selectedStatus : ["ongoing", "notStarted", "closed"],
    })
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault()
      handleSearch()
    }
  }

  const toggleStatus = (status: string) => {
    setSelectedStatus((prev) =>
      prev.includes(status)
        ? prev.filter((s) => s !== status)
        : [...prev, status]
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Input
          placeholder="搜索课程名称或教师..."
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1"
        />
        <Button onClick={handleSearch} className="shrink-0">
          <Search className="h-4 w-4 mr-2" />
          搜索
        </Button>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-muted-foreground mr-2">状态筛选:</span>
        {statusOptions.map((option) => (
          <Badge
            key={option.value}
            variant={selectedStatus.includes(option.value) ? "default" : "outline"}
            className="cursor-pointer transition-colors"
            onClick={() => toggleStatus(option.value)}
          >
            {option.label}
          </Badge>
        ))}
      </div>
    </div>
  )
}
