// lib/forumBeautifier.tsx

import { createRoot } from "react-dom/client"
import { mountCourseDetailPage } from "@/shared/course-detail/courseDetailHelpers"
import { ForumPanel } from "@/features/forum/components"

export async function forumBeautifier(): Promise<void> {
  console.log("XZZDPRO: preparing forum page...")

  const page = await mountCourseDetailPage({
    currentPage: "discussion",
    pageTitle: "讨论区",
    contentHtml: '<div id="forum-mount-point" class="forum-list"></div>'
  })
  if (!page) return

  const mountPoint = page.getMountPoint("forum-mount-point")
  if (mountPoint) {
    createRoot(mountPoint).render(<ForumPanel courseId={page.courseId} />)
  }
}
