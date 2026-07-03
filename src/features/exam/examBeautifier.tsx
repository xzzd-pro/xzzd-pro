// lib/examBeautifier.tsx

import { mountCourseDetailPage } from "@/shared/course-detail/courseDetailHelpers"

export async function examBeautifier(): Promise<void> {
  console.log("XZZDPRO: preparing exam page...")

  await mountCourseDetailPage({
    currentPage: "quiz",
    pageTitle: "小测",
    contentHtml: '<p class="loading-message">正在加载小测列表...</p>'
  })
}
