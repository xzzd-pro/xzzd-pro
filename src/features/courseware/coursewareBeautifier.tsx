// lib/coursewareBeautifier.tsx

import { createRoot } from "react-dom/client"
import { mountCourseDetailPage } from "@/shared/course-detail/courseDetailHelpers"
import { CoursewarePanel } from "@/features/courseware/components"

export async function coursewareBeautifier(): Promise<void> {
  console.log("XZZDPRO: preparing courseware page...")

  const page = await mountCourseDetailPage({
    currentPage: "materials",
    pageTitle: "课件下载",
    contentHtml: '<div id="courseware-mount-point" class="materials-list"></div>'
  })
  if (!page) return

  const mountPoint = page.getMountPoint("courseware-mount-point")
  if (mountPoint) {
    createRoot(mountPoint).render(<CoursewarePanel courseId={page.courseId} />)
  }
}
