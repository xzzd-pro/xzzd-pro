// lib/courseware-beautifier.tsx

import { CoursewarePanel } from "@/features/courseware/components"
import { mountCourseDetailPage } from "@/shared/course-detail/course-detail-helpers"
import { mountCoursePanel } from "@/shared/course-detail/mount-panel"

/**
 * Replaces the courseware page with the extension layout and the courseware panel.
 */
export async function coursewareBeautifier(): Promise<void> {
  console.log("XZZDPRO: preparing courseware page...")

  const page = await mountCourseDetailPage({
    currentPage: "materials",
    pageTitle: "课件下载",
    contentHtml:
      '<div id="courseware-mount-point" class="materials-list"></div>'
  })
  if (!page) return

  const mountPoint = page.getMountPoint("courseware-mount-point")
  if (mountPoint) {
    mountCoursePanel(mountPoint, <CoursewarePanel courseId={page.courseId} />)
  }
}
