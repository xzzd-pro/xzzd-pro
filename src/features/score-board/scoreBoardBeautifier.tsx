// lib/scoreBoardBeautifier.tsx

import { mountCoursePanel } from "@/shared/course-detail/mountPanel"
import { mountCourseDetailPage } from "@/shared/course-detail/courseDetailHelpers"
import { ScoreBoardPanel } from "@/features/score-board/components"

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
