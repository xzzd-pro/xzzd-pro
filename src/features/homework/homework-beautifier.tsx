// lib/homework-beautifier.tsx

import { HomeworkPanel } from "@/features/homework/components"
import { mountCourseDetailPage } from "@/shared/course-detail/course-detail-helpers"
import { mountCoursePanel } from "@/shared/course-detail/mount-panel"

/**
 * Replaces the homework page with the extension layout and the homework panel.
 */
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
