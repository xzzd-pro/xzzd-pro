// lib/homeworkBeautifier.tsx

import { createRoot } from "react-dom/client"
import { getCourseIdFromUrl, getCourseName, renderCourseDetailPage, setupThemeToggle, setupHelpModal, setupSidebarToggle, setupAvatarUpload } from "./components/courseDetailHelpers"
import { HomeworkPanel } from "@/components/homework"

export async function homeworkBeautifier(): Promise<void> {
  console.log('XZZDPRO: 准备接管作业页...')

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
    <div id="homework-mount-point" class="homework-list"></div>
  `

  root.innerHTML = renderCourseDetailPage(
    courseId,
    courseName,
    'homework',
    '作业提交',
    contentHtml
  )

  document.body.appendChild(root)
  document.body.classList.add('xzzdpro-body')

  setupThemeToggle()
  setupHelpModal()
  setupAvatarUpload()
  setupSidebarToggle()

  console.log('XZZDPRO: 作业页面渲染完成，开始挂载React组件...')

  // Mount React component
  const mountPoint = document.getElementById('homework-mount-point')
  if (mountPoint) {
    const reactRoot = createRoot(mountPoint)
    reactRoot.render(<HomeworkPanel courseId={courseId} />)
  }
}
