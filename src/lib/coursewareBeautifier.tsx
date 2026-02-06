// lib/coursewareBeautifier.tsx

import { createRoot } from "react-dom/client"
import { renderCourseDetailPage, setupThemeToggle, setupHelpModal, setupSidebarToggle, setupAvatarUpload, getCourseIdFromUrl, getCourseName } from "./components/courseDetailHelpers"
import { CoursewarePanel } from "@/components/courseware"

export async function coursewareBeautifier(): Promise<void> {
  console.log('XZZDPRO: 准备接管课件下载页...')

  // 移除 chatbot 并监视动态添加
  const removeChatbot = () => {
    document.querySelectorAll('air-chatbot-app').forEach(el => el.remove())
  }
  removeChatbot()

  const observer = new MutationObserver(() => {
    removeChatbot()
  })
  observer.observe(document.documentElement, { childList: true, subtree: true })

  // 5秒后停止监视
  setTimeout(() => observer.disconnect(), 5000)

  document.body.innerHTML = ''
  const root = document.createElement('div')
  root.className = 'xzzdpro-root'

  const courseId = getCourseIdFromUrl()
  if (!courseId) {
    console.error('XZZDPRO: 无法提取课程ID')
    return
  }

  const courseName = await getCourseName()

  const contentHtml = `
    <div id="courseware-mount-point" class="materials-list"></div>
  `

  root.innerHTML = renderCourseDetailPage(
    courseId,
    courseName,
    'materials',
    '课件下载',
    contentHtml
  )

  document.body.appendChild(root)
  document.body.classList.add('xzzdpro-body')

  setupThemeToggle()
  setupHelpModal()
  setupAvatarUpload()
  setupSidebarToggle()

  console.log('XZZDPRO: 课件下载页面渲染完成，开始挂载React组件...')

  // Mount React component
  const mountPoint = document.getElementById('courseware-mount-point')
  if (mountPoint) {
    const reactRoot = createRoot(mountPoint)
    reactRoot.render(<CoursewarePanel courseId={courseId} />)
  }
}
