import { Storage } from "@plasmohq/storage"
import { navIcons } from "./icons"
import { bindLayoutControl } from "./bindings"
import { SIDEBAR_DEFAULT_WIDTH, SIDEBAR_MIN_WIDTH, SIDEBAR_MAX_WIDTH, SIDEBAR_COLLAPSE_THRESHOLD, SIDEBAR_COLLAPSED_WIDTH } from "./constants"
const storage = new Storage()
const LAYOUT_STORAGE_KEY = "indexPageLayout"

interface SidebarOptions {
  currentPage?: 'home' | 'notification' | 'courses' | 'assistant';
}

export function renderSidebar(options: SidebarOptions = {}): string {
  const { currentPage } = options;

  return `
    <nav class="xzzdpro-sidebar">
      <div class="sidebar-section">
        <ul class="sidebar-nav">
          <li class="nav-item ${currentPage === 'home' ? 'active' : ''}">
            <a href="https://courses.zju.edu.cn/user/index#/" class="nav-link">
              <span class="nav-icon">${navIcons.home}</span>
              <span class="nav-text">主页</span>
            </a>
          </li>
          <li class="nav-item ${currentPage === 'notification' ? 'active' : ''}">
            <a href="https://courses.zju.edu.cn/bulletin-list/#/" class="nav-link">
              <span class="nav-icon">${navIcons.notification}</span>
              <span class="nav-text">动态</span>
            </a>
          </li>
          <li class="nav-item ${currentPage === 'courses' ? 'active' : ''}">
            <a href="https://courses.zju.edu.cn/user/courses#/" class="nav-link">
              <span class="nav-icon">${navIcons.courses}</span>
              <span class="nav-text">课程</span>
            </a>
          </li>
          <li class="nav-item nav-item-expandable ${currentPage === 'assistant' ? 'active' : ''}">
            <div class="nav-link nav-link-expandable">
              <a href="https://courses.zju.edu.cn/air" id="nav-assistant-link" class="nav-link-main" aria-label="学习助理">
                <span class="nav-icon">${navIcons.assistant}</span>
                <span class="nav-text">学习助理</span>
              </a>
              <button id="nav-assistant-expand" class="expand-toggle" type="button" aria-label="展开学习助理课程列表" title="展开课程列表">
                <span class="expand-arrow">▼</span>
              </button>
            </div>
            <div class="nav-submenu">
              <div id="assistant-course-list" class="course-list-submenu">
                <div class="submenu-loading">加载课程中...</div>
              </div>
            </div>
          </li>
          ${currentPage === 'assistant' ? `
          <li class="nav-item nav-item-expandable nav-item-materials">
            <div class="nav-link nav-link-expandable nav-link-secondary-expandable">
              <button id="nav-assistant-material-expand" class="nav-link-main nav-link-main-button" type="button" aria-label="展开资料选择" title="展开资料选择">
                <span class="nav-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 5V19" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                    <path d="M5 12H19" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                  </svg>
                </span>
                <span class="nav-text">资料选择</span>
              </button>
              <button id="nav-assistant-material-arrow" class="expand-toggle" type="button" aria-label="展开资料列表" title="展开资料列表">
                <span class="expand-arrow">▼</span>
              </button>
            </div>
            <div class="nav-submenu nav-submenu-materials">
              <div id="assistant-material-list" class="material-list-submenu">
                <div class="submenu-empty">请选择课程后加载资料</div>
              </div>
            </div>
          </li>
          ` : ''}
          ${currentPage === 'assistant' ? `
          <li class="nav-item nav-item-action assistant-sidebar-action">
            <button id="nav-assistant-flashcard-toggle" class="nav-link nav-action-btn" type="button" title="展开侧栏">
              <span class="nav-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="3" y="6" width="18" height="12" rx="2" stroke="currentColor" stroke-width="1.8"/>
                  <path d="M12 6V18" stroke="currentColor" stroke-width="1.8"/>
                </svg>
              </span>
              <span class="nav-text">展开侧栏</span>
            </button>
          </li>
          <li class="nav-item nav-item-action assistant-sidebar-action">
            <button id="nav-assistant-clear-history" class="nav-link nav-action-btn" type="button" title="清除历史">
              <span class="nav-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M9 3H15M4 7H20M6 7L7 20C7.08 21.1 7.99 22 9.1 22H14.9C16.01 22 16.92 21.1 17 20L18 7M10 11V17M14 11V17" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                </svg>
              </span>
              <span class="nav-text">清除历史</span>
            </button>
          </li>
          ` : ''}
        </ul>
      </div>
      <div class="sidebar-footer">
        <button class="sidebar-toggle-btn" id="sidebar-toggle" title="收缩侧边栏">
          <span class="toggle-icon">&lt;&lt;</span>
        </button>
      </div>
      <div id="sidebar-resize-handle" class="sidebar-resize-handle" title="拖拽调整侧边栏宽度" aria-label="调整侧边栏宽度"></div>
    </nav>
  `;
}

export async function setupSidebarToggle(): Promise<void> {
  const toggleBtn = document.getElementById('sidebar-toggle');
  const resizeHandle = document.getElementById('sidebar-resize-handle');
  const root = document.querySelector('.xzzdpro-root') as HTMLElement;

  if (!toggleBtn || !root) return;
  const binding = bindLayoutControl('sidebar', toggleBtn);
  if (!binding) return;
  const { signal } = binding;

  const clampSidebarWidth = (width: number): number => {
    return Math.max(SIDEBAR_MIN_WIDTH, Math.min(SIDEBAR_MAX_WIDTH, width));
  };

  const setSidebarWidth = (width: number): void => {
    const resolvedWidth = clampSidebarWidth(width);
    root.style.setProperty('--xzzd-sidebar-width', `${resolvedWidth}px`);
    if (!root.classList.contains('sidebar-collapsed')) {
      root.style.gridTemplateColumns = `${resolvedWidth}px 1fr`;
    }
  };

  const readSidebarWidth = (): number => {
    const cssValue = root.style.getPropertyValue('--xzzd-sidebar-width').trim();
    const parsed = Number(cssValue.replace('px', ''));
    if (Number.isFinite(parsed) && parsed > 0) {
      return clampSidebarWidth(parsed);
    }
    return SIDEBAR_DEFAULT_WIDTH;
  };

  const setCollapsedState = (collapsed: boolean): void => {
    if (collapsed) {
      root.classList.add('sidebar-collapsed');
      root.style.gridTemplateColumns = `${SIDEBAR_COLLAPSED_WIDTH}px 1fr`;
      toggleBtn.setAttribute('title', '展开侧边栏');
      return;
    }
    root.classList.remove('sidebar-collapsed');
    const expandedWidth = readSidebarWidth();
    root.style.gridTemplateColumns = `${expandedWidth}px 1fr`;
    toggleBtn.setAttribute('title', '收缩侧边栏');
  };

  const persistSidebarState = async (collapsed: boolean, width: number): Promise<void> => {
    const currentState = await storage.get<Record<string, unknown>>(LAYOUT_STORAGE_KEY) || {};
    await storage.set(LAYOUT_STORAGE_KEY, {
      ...currentState,
      sidebarCollapsed: collapsed,
      sidebarWidth: clampSidebarWidth(width)
    });
  };

  // Load and apply saved state
  try {
    const state = await storage.get<{ sidebarCollapsed?: boolean; sidebarWidth?: number }>(LAYOUT_STORAGE_KEY);
    if (signal.aborted || !root.isConnected) return;
    const savedWidth = typeof state?.sidebarWidth === 'number'
      ? clampSidebarWidth(state.sidebarWidth)
      : SIDEBAR_DEFAULT_WIDTH;
    setSidebarWidth(savedWidth);
    setCollapsedState(!!state?.sidebarCollapsed);
  } catch (error) {
    if (signal.aborted || !root.isConnected) return;
    console.error('XZZDPRO: Failed to load sidebar state', error);
    setSidebarWidth(SIDEBAR_DEFAULT_WIDTH);
  }

  // Setup click handler
  toggleBtn.addEventListener('click', async () => {
    const isCollapsed = !root.classList.contains('sidebar-collapsed');
    setCollapsedState(isCollapsed);

    if (!isCollapsed && readSidebarWidth() < SIDEBAR_MIN_WIDTH) {
      setSidebarWidth(SIDEBAR_DEFAULT_WIDTH);
    }

    // Save state
    try {
      const width = readSidebarWidth();
      await persistSidebarState(isCollapsed, width);
      console.log('XZZDPRO: Sidebar toggled', { collapsed: isCollapsed, width });
    } catch (error) {
      console.error('XZZDPRO: Failed to save sidebar state', error);
    }
  }, { signal });

  if (!resizeHandle) return;

  let isResizing = false;
  let resizeStartX = 0;
  let resizeStartWidth = SIDEBAR_DEFAULT_WIDTH;
  let pendingWidth = SIDEBAR_DEFAULT_WIDTH;
  let pendingCollapsed = false;

  const endResizing = async () => {
    if (!isResizing) return;

    isResizing = false;
    root.classList.remove('sidebar-resizing');
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);

    setCollapsedState(pendingCollapsed);
    if (!pendingCollapsed) {
      setSidebarWidth(pendingWidth);
    }

    try {
      await persistSidebarState(pendingCollapsed, pendingWidth);
      console.log('XZZDPRO: Sidebar resized', { collapsed: pendingCollapsed, width: pendingWidth });
    } catch (error) {
      console.error('XZZDPRO: Failed to save sidebar resize state', error);
    }

  };

  const onMouseMove = (event: MouseEvent) => {
    if (!isResizing) return;

    const deltaX = event.clientX - resizeStartX;
    const rawWidth = resizeStartWidth + deltaX;

    if (rawWidth <= SIDEBAR_COLLAPSE_THRESHOLD) {
      pendingCollapsed = true;
      pendingWidth = SIDEBAR_MIN_WIDTH;
      setCollapsedState(true);
      return;
    }

    pendingCollapsed = false;
    pendingWidth = clampSidebarWidth(rawWidth);
    setCollapsedState(false);
    setSidebarWidth(pendingWidth);
  };

  const onMouseUp = () => {
    void endResizing();
  };
  binding.onCleanup(() => root.classList.remove('sidebar-resizing'));

  resizeHandle.addEventListener('mousedown', (event: MouseEvent) => {
    if (event.button !== 0) return;
    event.preventDefault();

    isResizing = true;
    root.classList.add('sidebar-resizing');
    resizeStartX = event.clientX;

    const currentCollapsed = root.classList.contains('sidebar-collapsed');
    if (currentCollapsed) {
      setCollapsedState(false);
      setSidebarWidth(SIDEBAR_DEFAULT_WIDTH);
      resizeStartWidth = SIDEBAR_DEFAULT_WIDTH;
    } else {
      resizeStartWidth = readSidebarWidth();
    }

    pendingWidth = resizeStartWidth;
    pendingCollapsed = false;

    document.addEventListener('mousemove', onMouseMove, { signal });
    document.addEventListener('mouseup', onMouseUp, { signal });
  }, { signal });
}
