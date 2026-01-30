// lib/forumBeautifier.tsx

import { createRoot } from "react-dom/client"
import { getCourseIdFromUrl, getCourseName, renderCourseDetailPage, setupThemeToggle, setupHelpModal, setupSidebarToggle, setupAvatarUpload } from "./components/courseDetailHelpers"
import { ForumPanel } from "@/components/forum"

export async function forumBeautifier(): Promise<void> {
  console.log('XZZDPRO: 准备接管讨论区页...')

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
    <div id="forum-mount-point" class="forum-list"></div>
  `

  root.innerHTML = renderCourseDetailPage(
    courseId,
    courseName,
    'discussion',
    '讨论区',
    contentHtml
  )

  document.body.appendChild(root)
  document.body.classList.add('xzzdpro-body')

  setupThemeToggle()
  setupHelpModal()
  setupAvatarUpload()
  setupSidebarToggle()

  console.log('XZZDPRO: 讨论区页面渲染完成，开始挂载React组件...')

  // Mount React component
  const mountPoint = document.getElementById('forum-mount-point')
  if (mountPoint) {
    const reactRoot = createRoot(mountPoint)
    reactRoot.render(<ForumPanel courseId={courseId} />)
  }
}
