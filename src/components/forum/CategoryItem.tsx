import * as React from "react"
import { cn } from "@/lib/utils"
import { ChevronRight } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { TopicItem } from "./TopicItem"
import type { ProcessedCategory, Topic, CategoryDetailResponse } from "@/types"

// Fetch topics for a category
async function fetchCategoryTopics(categoryId: number): Promise<Topic[]> {
  try {
    const response = await fetch(
      `https://courses.zju.edu.cn/api/forum/categories/${categoryId}`
    )
    if (!response.ok) return []
    const data: CategoryDetailResponse = await response.json()
    return data.result?.topics || []
  } catch (error) {
    console.error('XZZDPRO: 获取讨论帖子时出错', error)
    return []
  }
}

interface CategoryItemProps {
  category: ProcessedCategory
  courseId: string
}

export function CategoryItem({ category, courseId }: CategoryItemProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const [topics, setTopics] = React.useState<Topic[] | null>(null)
  const [isLoading, setIsLoading] = React.useState(false)

  // Load topics on first expand
  React.useEffect(() => {
    if (isOpen && topics === null) {
      setIsLoading(true)
      fetchCategoryTopics(category.id).then(data => {
        setTopics(data)
        setIsLoading(false)
      })
    }
  }, [isOpen, category.id, topics])

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className={cn(
      "bg-muted rounded-lg overflow-hidden border-l-4 border-l-primary transition-shadow duration-200",
      "hover:shadow-md"
    )}>
      <CollapsibleTrigger asChild>
        <div className="flex items-start gap-3 p-5 cursor-pointer hover:bg-border/50 transition-colors">
          <div className={cn(
            "w-6 h-6 flex-shrink-0 flex items-center justify-center transition-transform duration-300 mt-0.5",
            isOpen && "rotate-90"
          )}>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-start gap-4 mb-2">
              <h3 className="text-lg font-semibold text-foreground leading-snug">
                {category.title}
              </h3>
              <div className="flex gap-2 flex-shrink-0">
                {category.unreadCount > 0 && (
                  <Badge variant="destructive">
                    {category.unreadCount} 条未读
                  </Badge>
                )}
                <Badge variant="secondary">
                  {category.topicCount} 条讨论
                </Badge>
              </div>
            </div>
          </div>
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="px-5 pb-5 pl-14">
          {isLoading ? (
            <p className="text-muted-foreground text-sm py-4">正在加载帖子...</p>
          ) : topics && topics.length > 0 ? (
            <div className="flex flex-col gap-2">
              {topics.map(topic => (
                <TopicItem key={topic.id} topic={topic} courseId={courseId} />
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm py-4 text-center">暂无帖子</p>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
