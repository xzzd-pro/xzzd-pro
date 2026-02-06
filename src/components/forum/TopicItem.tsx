import * as React from "react"
import { cn } from "@/lib/utils"
import { MessageSquare, ThumbsUp, CheckCircle } from "lucide-react"
import type { Topic } from "@/types"

interface TopicItemProps {
  topic: Topic
  courseId: string
}

// Format date display
function formatDate(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diff = now.getTime() - date.getTime()

  const minutes = Math.floor(diff / (1000 * 60))
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes} 分钟前`
  if (hours < 24) return `${hours} 小时前`
  if (days < 7) return `${days} 天前`

  return date.toLocaleDateString('zh-CN')
}

export function TopicItem({ topic, courseId }: TopicItemProps) {
  return (
    <div className={cn(
      "flex items-center justify-between gap-4 p-4 bg-card rounded-lg transition-all duration-200",
      "hover:translate-x-1 hover:shadow-md",
      topic.is_top && "border-l-[3px] border-l-yellow-500",
      topic.is_digest && !topic.is_top && "border-l-[3px] border-l-green-500"
    )}>
      <div className="flex-1 min-w-0">
        <div className="mb-2">
          <a
            href={`https://courses.zju.edu.cn/course/${courseId}/forum#/topic/${topic.id}`}
            className="inline-flex items-center gap-2 text-[15px] font-medium text-foreground hover:text-primary transition-colors"
            target="_blank"
            rel="noopener noreferrer"
          >
            {topic.is_top && (
              <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-yellow-500 text-gray-900 flex-shrink-0">
                置顶
              </span>
            )}
            {topic.is_digest && (
              <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-green-500 text-white flex-shrink-0">
                精华
              </span>
            )}
            <span className="break-words">{topic.title}</span>
          </a>
        </div>
        <div className="flex items-center gap-3 text-[13px] text-muted-foreground">
          <span className="font-medium">{topic.author?.name || '匿名用户'}</span>
          <span className="opacity-80">{formatDate(topic.created_at)}</span>
        </div>
      </div>
      <div className="flex items-center gap-4 flex-shrink-0">
        <span className="flex items-center gap-1 text-[13px] text-muted-foreground">
          <MessageSquare className="w-4 h-4" />
          <span className="font-medium">{topic.reply_count || 0}</span>
        </span>
        <span className="flex items-center gap-1 text-[13px] text-muted-foreground">
          <ThumbsUp className="w-4 h-4" />
          <span className="font-medium">{topic.like_count || 0}</span>
        </span>
        {topic.instructor_replied && (
          <span className="flex items-center gap-1 text-[13px] text-primary">
            <CheckCircle className="w-4 h-4" />
            <span className="font-medium">教师已回复</span>
          </span>
        )}
      </div>
    </div>
  )
}
