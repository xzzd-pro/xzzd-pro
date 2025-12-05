// lib/components/resizeHandlers.ts

import { Storage } from "@plasmohq/storage"
import type { LayoutState } from "../../types"

const storage = new Storage()
const LAYOUT_STORAGE_KEY = "indexPageLayout"

// Default layout state
const DEFAULT_LAYOUT: LayoutState = {
  leftHandleWidth: 100,
  rightHandleWidth: 100,
  welcomeCardHeight: 120,
  coursesCardFlex: 1,
  todoCardFlex: 1,
  sidebarCollapsed: false
}

// Save layout state to storage
async function saveLayoutState(state: Partial<LayoutState>): Promise<void> {
  try {
    const currentState = await storage.get<LayoutState>(LAYOUT_STORAGE_KEY) || DEFAULT_LAYOUT
    const newState = { ...currentState, ...state }
    await storage.set(LAYOUT_STORAGE_KEY, newState)
    console.log('XZZDPRO: Layout state saved', newState)
  } catch (error) {
    console.error('XZZDPRO: Failed to save layout state', error)
  }
}

// Load layout state from storage
async function loadLayoutState(): Promise<LayoutState> {
  try {
    const state = await storage.get<LayoutState>(LAYOUT_STORAGE_KEY)
    return state || DEFAULT_LAYOUT
  } catch (error) {
    console.error('XZZDPRO: Failed to load layout state', error)
    return DEFAULT_LAYOUT
  }
}

// Apply saved layout state to DOM
export async function applySavedLayout(): Promise<void> {
  const state = await loadLayoutState()

  const mainGrid = document.querySelector('.xzzdpro-main') as HTMLElement
  const mainContentWrapper = document.querySelector('.main-content-wrapper') as HTMLElement
  const handleLeft = document.querySelector('.resize-handle-left') as HTMLElement
  const handleRight = document.querySelector('.resize-handle-right') as HTMLElement
  const root = document.querySelector('.xzzdpro-root') as HTMLElement

  if (mainGrid && handleLeft && handleRight) {
    mainGrid.style.gridTemplateColumns = `${state.leftHandleWidth}px 1fr ${state.rightHandleWidth}px`
    handleLeft.style.width = `${state.leftHandleWidth}px`
    handleRight.style.width = `${state.rightHandleWidth}px`
  }

  if (mainContentWrapper) {
    mainContentWrapper.style.gridTemplateRows = `${state.welcomeCardHeight}px 12px 1fr`
    mainContentWrapper.style.gridTemplateColumns = `${state.coursesCardFlex}fr 12px ${state.todoCardFlex}fr`
  }

  // Apply sidebar collapsed state
  if (root && state.sidebarCollapsed) {
    root.classList.add('sidebar-collapsed')
  }

  console.log('XZZDPRO: Layout state applied', state)
}

export function setupResizeHandlers(): void {
  const mainGrid = document.querySelector('.xzzdpro-main') as HTMLElement
  const mainContentWrapper = document.querySelector('.main-content-wrapper') as HTMLElement

  if (!mainGrid || !mainContentWrapper) {
    console.warn('XZZDPRO: Main grid or content wrapper not found')
    return
  }

  // Handle resize-handle-left (adjusts left column width)
  const handleLeft = document.querySelector('.resize-handle-left') as HTMLElement
  if (handleLeft) {
    let isResizingLeft = false
    let startX = 0
    let startWidth = 100

    handleLeft.addEventListener('mousedown', (e: MouseEvent) => {
      isResizingLeft = true
      startX = e.clientX
      startWidth = handleLeft.offsetWidth
      document.body.style.cursor = 'ew-resize'
      document.body.style.userSelect = 'none'
      e.preventDefault()
    })

    document.addEventListener('mousemove', (e: MouseEvent) => {
      if (!isResizingLeft) return

      const deltaX = e.clientX - startX
      const newWidth = Math.max(50, Math.min(300, startWidth + deltaX))

      const currentRightWidth = handleRight?.offsetWidth || 100
      mainGrid.style.gridTemplateColumns = `${newWidth}px 1fr ${currentRightWidth}px`
      handleLeft.style.width = `${newWidth}px`
    })

    document.addEventListener('mouseup', () => {
      if (isResizingLeft) {
        isResizingLeft = false
        document.body.style.cursor = ''
        document.body.style.userSelect = ''

        // Save state
        saveLayoutState({ leftHandleWidth: handleLeft.offsetWidth })
      }
    })
  }

  // Handle resize-handle-right (adjusts right column width)
  const handleRight = document.querySelector('.resize-handle-right') as HTMLElement
  if (handleRight) {
    let isResizingRight = false
    let startX = 0
    let startWidth = 100

    handleRight.addEventListener('mousedown', (e: MouseEvent) => {
      isResizingRight = true
      startX = e.clientX
      startWidth = handleRight.offsetWidth
      document.body.style.cursor = 'ew-resize'
      document.body.style.userSelect = 'none'
      e.preventDefault()
    })

    document.addEventListener('mousemove', (e: MouseEvent) => {
      if (!isResizingRight) return

      const deltaX = startX - e.clientX // Reversed for right handle
      const newWidth = Math.max(50, Math.min(300, startWidth + deltaX))

      const currentLeftWidth = handleLeft?.offsetWidth || 100
      mainGrid.style.gridTemplateColumns = `${currentLeftWidth}px 1fr ${newWidth}px`
      handleRight.style.width = `${newWidth}px`
    })

    document.addEventListener('mouseup', () => {
      if (isResizingRight) {
        isResizingRight = false
        document.body.style.cursor = ''
        document.body.style.userSelect = ''

        // Save state
        saveLayoutState({ rightHandleWidth: handleRight.offsetWidth })
      }
    })
  }

  // Handle resize-handle-horizontal (adjusts welcome card height)
  const handleHorizontal = document.querySelector('.resize-handle-horizontal') as HTMLElement
  if (handleHorizontal) {
    let isResizingHorizontal = false
    let startY = 0
    let startHeight = 0

    handleHorizontal.addEventListener('mousedown', (e: MouseEvent) => {
      isResizingHorizontal = true
      startY = e.clientY
      const welcomeCard = document.querySelector('.welcome-card') as HTMLElement
      startHeight = welcomeCard?.offsetHeight || 0
      document.body.style.cursor = 'ns-resize'
      document.body.style.userSelect = 'none'
      e.preventDefault()
    })

    document.addEventListener('mousemove', (e: MouseEvent) => {
      if (!isResizingHorizontal) return

      const deltaY = e.clientY - startY
      const newHeight = Math.max(80, startHeight + deltaY)

      mainContentWrapper.style.gridTemplateRows = `${newHeight}px 12px 1fr`
    })

    document.addEventListener('mouseup', () => {
      if (isResizingHorizontal) {
        isResizingHorizontal = false
        document.body.style.cursor = ''
        document.body.style.userSelect = ''

        // Save state
        const welcomeCard = document.querySelector('.welcome-card') as HTMLElement
        if (welcomeCard) {
          saveLayoutState({ welcomeCardHeight: welcomeCard.offsetHeight })
        }
      }
    })
  }

  // Handle resize-handle-vertical (adjusts cards' width ratio)
  const handleVertical = document.querySelector('.resize-handle-vertical') as HTMLElement
  if (handleVertical) {
    let isResizingVertical = false
    let startX = 0
    let startLeftFlex = 1
    let startRightFlex = 1

    handleVertical.addEventListener('mousedown', (e: MouseEvent) => {
      isResizingVertical = true
      startX = e.clientX

      const currentColumns = window.getComputedStyle(mainContentWrapper).gridTemplateColumns.split(' ')
      const leftWidth = parseFloat(currentColumns[0])
      const rightWidth = parseFloat(currentColumns[2])
      const totalWidth = leftWidth + rightWidth

      startLeftFlex = leftWidth / totalWidth
      startRightFlex = rightWidth / totalWidth

      document.body.style.cursor = 'ew-resize'
      document.body.style.userSelect = 'none'
      e.preventDefault()
    })

    document.addEventListener('mousemove', (e: MouseEvent) => {
      if (!isResizingVertical) return

      const deltaX = e.clientX - startX
      const containerWidth = mainContentWrapper.offsetWidth - 24 - 12 // Subtract padding and handle width
      const deltaRatio = deltaX / containerWidth

      let newLeftFlex = Math.max(0.2, Math.min(0.8, startLeftFlex + deltaRatio))
      let newRightFlex = 1 - newLeftFlex

      mainContentWrapper.style.gridTemplateColumns = `${newLeftFlex}fr 12px ${newRightFlex}fr`
    })

    document.addEventListener('mouseup', () => {
      if (isResizingVertical) {
        isResizingVertical = false
        document.body.style.cursor = ''
        document.body.style.userSelect = ''

        // Save state
        const currentColumns = window.getComputedStyle(mainContentWrapper).gridTemplateColumns.split(' ')
        const leftWidth = parseFloat(currentColumns[0])
        const rightWidth = parseFloat(currentColumns[2])
        const totalWidth = leftWidth + rightWidth

        saveLayoutState({
          coursesCardFlex: leftWidth / totalWidth,
          todoCardFlex: rightWidth / totalWidth
        })
      }
    })
  }

  // Handle sidebar toggle button
  const toggleBtn = document.getElementById('sidebar-toggle')
  if (toggleBtn) {
    toggleBtn.addEventListener('click', async () => {
      const root = document.querySelector('.xzzdpro-root') as HTMLElement
      if (!root) return

      const isCollapsed = root.classList.toggle('sidebar-collapsed')

      // Update title
      toggleBtn.setAttribute('title', isCollapsed ? '展开侧边栏' : '收缩侧边栏')

      // Save state
      await saveLayoutState({ sidebarCollapsed: isCollapsed })
      console.log('XZZDPRO: Sidebar toggled', { collapsed: isCollapsed })
    })
  }
}
