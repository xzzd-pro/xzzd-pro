// lib/homeworkBeautifier.tsx

import { createRoot } from "react-dom/client"
import { mountCourseDetailPage } from "@/shared/course-detail/courseDetailHelpers"
import { HomeworkPanel } from "@/features/homework/components"

export async function homeworkBeautifier(): Promise<void> {
  console.log("XZZDPRO: preparing homework page...")

  const page = await mountCourseDetailPage({
    currentPage: "homework",
    pageTitle: "作业提交",
    contentHtml: '<div id="homework-mount-point" class="homework-list"></div>'
  })
  if (!page) return

  const mountPoint = page.getMountPoint("homework-mount-point")
  if (mountPoint) {
    createRoot(mountPoint).render(<HomeworkPanel courseId={page.courseId} />)
  }
}
