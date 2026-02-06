import * as React from "react"
import { cn } from "@/lib/utils"
import { MessageCircle, User, Calendar } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion"
import { Skeleton } from "@/components/ui/skeleton"

interface DiscussionTopic {
  id: number
  title: string
  content: string
  author: string
  createdAt: string
  replyCount: number
  isSticky: boolean
  isLocked: boolean
}

interface DiscussionItemProps {
  topic: DiscussionTopic
  className?: string
}

function DiscussionItem({ topic, className }: DiscussionItemProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (days === 0) {
      const hours = Math.floor(diff / (1000 * 60 * 60))
      if (hours === 0) {
        const minutes = Math.floor(diff / (1000 * 60))
        return minutes <= 1 ? '刚刚' : `${minutes}分钟前`
      }
      return `${hours}小时前`
    }
    if (days < 7) return `${days}天前`
    return date.toLocaleDateString('zh-CN')
  }

  return (
    <AccordionItem
      value={topic.id.toString()}
      className={cn(
        "bg-muted rounded-lg overflow-hidden border-l-4 transition-shadow duration-200",
        "hover:shadow-md",
        topic.isSticky ? "border-l-yellow-500" : "border-l-primary",
        topic.isLocked && "opacity-75",
        className
      )}
    >
      <AccordionTrigger className="flex items-center gap-3 p-5 hover:bg-border/50 transition-colors [&[data-state=open]>svg]:rotate-180">
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-3 mb-3">
            <MessageCircle className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-semibold text-foreground leading-snug mb-2">
                {topic.title}
              </h3>
              <div className="flex gap-4 flex-wrap text-[13px]">
                {topic.isSticky && (
                  <Badge variant="outline" className="bg-yellow-500 text-gray-900 border-transparent">
                    置顶
                  </Badge>
                )}
                {topic.isLocked && (
                  <Badge variant="secondary">
                    已锁定
                  </Badge>
                )}
                <span className="text-muted-foreground flex items-center gap-1">
                  <User className="w-3 h-3" />
                  {topic.author}
                </span>
                <span className="text-muted-foreground flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {formatDate(topic.createdAt)}
                </span>
                <span className="text-muted-foreground">
                  {topic.replyCount} 回复
                </span>
              </div>
            </div>
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-5 pb-5 pl-14">
        <div className="bg-card rounded-lg p-4 border border-border">
          <div className="text-sm text-foreground whitespace-pre-wrap">
            {topic.content}
          </div>
        </div>
      </AccordionContent>
    </AccordionItem>
  )
}

// Skeleton loader for discussion items
function DiscussionSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="bg-muted rounded-lg overflow-hidden border-l-4 border-l-border p-5">
          <div className="flex items-center gap-3">
            <Skeleton className="w-5 h-5 rounded" />
            <div className="flex-1">
              <Skeleton className="h-5 w-3/4 max-w-[300px] mb-3" />
              <div className="flex gap-3">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-16" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

interface DiscussionPanelProps {
  courseId: string
}

export function DiscussionPanel({ courseId }: DiscussionPanelProps) {
  const [topics, setTopics] = React.useState<DiscussionTopic[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    async function loadDiscussions() {
      setIsLoading(true)
      setError(null)

      try {
        // 模拟API调用 - 实际项目中需要替换为真实的API
        await new Promise(resolve => setTimeout(resolve, 1000))

        // 模拟数据 - 实际项目中需要从API获取
        const mockTopics: DiscussionTopic[] = [
          {
            id: 1,
            title: "课程学习方法讨论",
            content: "大家觉得这门课程应该如何学习比较有效？欢迎分享学习心得和方法。",
            author: "张老师",
            createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
            replyCount: 15,
            isSticky: true,
            isLocked: false
          },
          {
            id: 2,
            title: "第三章习题讨论",
            content: "关于第三章的习题，有同学遇到困难吗？我们可以一起讨论解题思路。",
            author: "李同学",
            createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
            replyCount: 8,
            isSticky: false,
            isLocked: false
          },
          {
            id: 3,
            title: "期末考试范围",
            content: "请问老师，期末考试的范围是什么？需要重点复习哪些内容？",
            author: "王同学",
            createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
            replyCount: 3,
            isSticky: false,
            isLocked: true
          }
        ]

        setTopics(mockTopics)
      } catch (err) {
        setError('加载讨论失败，请刷新重试')
        console.error('XZZDPRO: 加载讨论时出错', err)
      } finally {
        setIsLoading(false)
      }
    }

    loadDiscussions()
  }, [courseId])

  if (isLoading) {
    return <DiscussionSkeleton />
  }

  if (error) {
    return (
      <p className="text-center text-destructive py-10 text-base">
        {error}
      </p>
    )
  }

  if (topics.length === 0) {
    return (
      <p className="text-center text-muted-foreground py-10 text-base">
        暂无讨论话题
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {topics.map((topic) => (
        <DiscussionItem key={topic.id} topic={topic} />
      ))}
    </div>
  )
}

export { DiscussionItem }
