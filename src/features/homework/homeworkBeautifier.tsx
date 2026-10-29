// lib/homeworkBeautifier.tsx

import { HomeworkPanel } from "@/features/homework/components"
import { mountCourseDetailPage } from "@/shared/course-detail/courseDetailHelpers"
import { mountCoursePanel } from "@/shared/course-detail/mountPanel"

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
    mountCoursePanel(mountPoint, <HomeworkPanel courseId={page.courseId} />)
  }
}
