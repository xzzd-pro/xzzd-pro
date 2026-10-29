// lib/score-board-beautifier.tsx

import { ScoreBoardPanel } from "@/features/score-board/components"
import { mountCourseDetailPage } from "@/shared/course-detail/course-detail-helpers"
import { mountCoursePanel } from "@/shared/course-detail/mount-panel"

/**
 * Replaces the score page with the extension layout and the score board panel.
 */
export async function scoreBoardBeautifier(): Promise<void> {
  console.log("XZZDPRO: preparing score board page...")

  const page = await mountCourseDetailPage({
    currentPage: "grades",
    pageTitle: "成绩",
    contentHtml:
      '<div id="scoreboard-mount-point" class="score-board-content"></div>'
  })
  if (!page) return

  const mountPoint = page.getMountPoint("scoreboard-mount-point")
  if (mountPoint) {
    mountCoursePanel(mountPoint, <ScoreBoardPanel courseId={page.courseId} />)
  }
}
