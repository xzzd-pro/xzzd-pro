import * as React from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { CategoryItem } from "./CategoryItem"
import type { TopicCategoriesResponse, TopicCategory, ProcessedCategory } from "@/types"

// Fetch topic categories
async function fetchTopicCategories(courseId: string): Promise<TopicCategory[]> {
  try {
    const response = await fetch(
      `https://courses.zju.edu.cn/api/courses/${courseId}/topic-categories`
    )
    if (!response.ok) return []
    const data: TopicCategoriesResponse = await response.json()
    return data.topic_categories || []
  } catch (error) {
    console.error('XZZDPRO: 获取讨论区列表时出错', error)
    return []
  }
}

// Process categories
function processCategories(categories: TopicCategory[]): ProcessedCategory[] {
  return categories.map(cat => ({
    id: cat.id,
    title: cat.title || '默认讨论区',
    topicCount: cat.topics_and_replies_count,
    unreadCount: cat.category_unread_topic_count + cat.category_unread_reply_count
  }))
}

// Skeleton
function ForumSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="bg-muted rounded-lg overflow-hidden border-l-4 border-l-border p-5">
          <div className="flex items-start gap-3">
            <Skeleton className="w-6 h-6 rounded" />
            <div className="flex-1">
              <div className="flex justify-between items-start gap-4">
                <Skeleton className="h-6 w-48" />
                <div className="flex gap-2">
                  <Skeleton className="h-6 w-20 rounded-full" />
                  <Skeleton className="h-6 w-20 rounded-full" />
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

interface ForumPanelProps {
  courseId: string
}

export function ForumPanel({ courseId }: ForumPanelProps) {
  const [categories, setCategories] = React.useState<ProcessedCategory[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    async function loadCategories() {
      setIsLoading(true)
      setError(null)

      try {
        const categoryList = await fetchTopicCategories(courseId)
        const processed = processCategories(categoryList)
        setCategories(processed)
      } catch (err) {
        setError('加载讨论区失败，请刷新重试')
        console.error('XZZDPRO: 加载讨论区时出错', err)
      } finally {
        setIsLoading(false)
      }
    }

    loadCategories()
  }, [courseId])

  if (isLoading) {
    return <ForumSkeleton />
  }

  if (error) {
    return (
      <p className="text-center text-destructive py-10 text-base">
        {error}
      </p>
    )
  }

  if (categories.length === 0) {
    return (
      <p className="text-center text-muted-foreground py-10 text-base">
        暂无讨论区
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {categories.map(cat => (
        <CategoryItem key={cat.id} category={cat} courseId={courseId} />
      ))}
    </div>
  )
}
