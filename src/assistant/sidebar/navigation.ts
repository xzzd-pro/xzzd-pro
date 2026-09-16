import { fetchAllCourses } from "../services/courseDataService"
import type { AssistantUploadHistoryItem } from "../types"
import { SIDEBAR_DEFAULT_WIDTH, SIDEBAR_MIN_WIDTH, SIDEBAR_MAX_WIDTH } from "@/shared/layout/constants"
import { bindLayoutControl } from "@/shared/layout/bindings"

interface SidebarMaterialFile {
  id: number;
  name: string;
  size: number;
  downloadUrl: string;
  materialTitle: string;
  sourceType: "courseware" | "history_upload";
  historyId?: string;
  historyPayloadRef?: string;
  historyMimeType?: string;
  historyStatus?: "ready" | "missing" | "session_only";
  createdAt?: number;
}

let sidebarMaterialCourseId: string | null = null;
const selectedSidebarMaterialUrls = new Set<string>();
let assistantHistoryManageMode = false;
const selectedHistoryDeleteIds = new Set<string>();
let coursesRequestId = 0;
let materialsRequestId = 0;

export function setupAssistantNavigation(): void {
  const link = document.getElementById('nav-assistant-link');
  const expandBtn = document.getElementById('nav-assistant-expand');
  const materialExpandMainBtn = document.getElementById('nav-assistant-material-expand') as HTMLButtonElement | null;
  const materialExpandArrowBtn = document.getElementById('nav-assistant-material-arrow') as HTMLButtonElement | null;
  const sidebarToggleBtn = document.getElementById('sidebar-toggle') as HTMLButtonElement | null;
  const root = document.querySelector('.xzzdpro-root') as HTMLElement | null;
  const flashcardToggleBtn = document.getElementById('nav-assistant-flashcard-toggle');
  const clearHistoryBtn = document.getElementById('nav-assistant-clear-history');
  const navItem = link?.closest('.nav-item-expandable');
  const materialNavItem = materialExpandArrowBtn?.closest('.nav-item-expandable');
  const submenu = navItem?.querySelector('.nav-submenu') as HTMLElement;
  const materialSubmenu = materialNavItem?.querySelector('.nav-submenu') as HTMLElement;
  
  if (!link || !expandBtn || !navItem || !submenu) return;
  const binding = bindLayoutControl('assistant-navigation', link);
  if (!binding) return;
  const { signal } = binding;

  const ensureSidebarExpanded = (): boolean => {
    if (!root || !root.classList.contains('sidebar-collapsed')) return false;
    if (sidebarToggleBtn) {
      sidebarToggleBtn.click();
      return true;
    }

    root.classList.remove('sidebar-collapsed');
    const cssValue = root.style.getPropertyValue('--xzzd-sidebar-width').trim();
    const parsed = Number(cssValue.replace('px', ''));
    const width = Number.isFinite(parsed) && parsed > 0
      ? Math.max(SIDEBAR_MIN_WIDTH, Math.min(SIDEBAR_MAX_WIDTH, parsed))
      : SIDEBAR_DEFAULT_WIDTH;
    root.style.gridTemplateColumns = `${width}px 1fr`;
    return true;
  };

  // If already on assistant page, clicking the assistant icon should open submenu
  // instead of navigating and refreshing the page.
  link.addEventListener('click', (e) => {
    const onAssistantPage = navItem.classList.contains('active')
    if (!onAssistantPage) return

    e.preventDefault()
    e.stopPropagation()
    ensureSidebarExpanded()
    navItem.classList.add('expanded')
    submenu.style.display = 'block'
    void loadAssistantCourses()
  }, { signal })

  // Toggle submenu on expand button click only
  expandBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    const isExpanded = navItem.classList.contains('expanded');
    if (isExpanded) {
      navItem.classList.remove('expanded');
      submenu.style.display = 'none';
    } else {
      navItem.classList.add('expanded');
      submenu.style.display = 'block';
      loadAssistantCourses();
    }
  }, { signal });

  if (navItem.classList.contains('active')) {
    navItem.classList.add('expanded');
    submenu.style.display = 'block';
  }

  if (materialExpandArrowBtn && materialNavItem && materialSubmenu) {
    const openMaterialSubmenu = () => {
      materialNavItem.classList.add('expanded');
      materialSubmenu.style.display = 'block';
      void loadAssistantMaterials();
    };
    const closeMaterialSubmenu = () => {
      materialNavItem.classList.remove('expanded');
      materialSubmenu.style.display = 'none';
    };

    const toggleMaterialSubmenu = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      const expandedFromCollapsed = ensureSidebarExpanded();
      if (expandedFromCollapsed) {
        openMaterialSubmenu();
        return;
      }
      if (materialNavItem.classList.contains('expanded')) {
        closeMaterialSubmenu();
      } else {
        openMaterialSubmenu();
      }
    };

    materialExpandArrowBtn.addEventListener('click', toggleMaterialSubmenu, { signal });
    materialExpandMainBtn?.addEventListener('click', toggleMaterialSubmenu, { signal });

    window.addEventListener('xzzd:assistant-course-changed', (event: Event) => {
      const customEvent = event as CustomEvent<{ courseId?: string }>;
      const courseId = customEvent.detail?.courseId;
      if (!courseId) return;
      void loadAssistantMaterials(courseId);
    }, { signal });
  }

  // Load courses on initial setup
  loadAssistantCourses();
  if (materialNavItem && materialSubmenu) {
    loadAssistantMaterials();
  }

  flashcardToggleBtn?.addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('xzzd:assistant-toggle-flashcard'));
  }, { signal });

  clearHistoryBtn?.addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('xzzd:assistant-clear-history'));
  }, { signal });
}

async function loadAssistantCourses(): Promise<void> {
  const courseListEl = document.getElementById('assistant-course-list');
  if (!courseListEl) return;
  const requestId = ++coursesRequestId;
  const isCurrent = () => requestId === coursesRequestId && courseListEl.isConnected;

  const assistantNavItem = document.getElementById('nav-assistant-link')?.closest('.nav-item-expandable') as HTMLElement | null;
  const assistantSubmenu = assistantNavItem?.querySelector('.nav-submenu') as HTMLElement | null;
  const collapseAssistantCourseSubmenu = () => {
    if (!assistantNavItem || !assistantSubmenu) return;
    assistantNavItem.classList.remove('expanded');
    assistantSubmenu.style.display = 'none';
  };

  try {
    const activeCourseId = new URLSearchParams(window.location.search).get('courseId');
    const courses = await fetchAllCourses();
    if (!isCurrent()) return;

    if (courses.length === 0) {
      courseListEl.innerHTML = '<div class="submenu-empty">暂无课程</div>';
      return;
    }

    // Render course list
    const courseHTML = courses
      .map((course) => `
        <a href="https://courses.zju.edu.cn/air?courseId=${course.id}" class="course-submenu-item ${String(course.id) === activeCourseId ? 'active' : ''}" data-course-id="${course.id}">
          <span class="course-name">${course.displayName || course.name}</span>
        </a>
      `)
      .join('');

    courseListEl.innerHTML = courseHTML;

    // Add click handlers for each course
    courseListEl.querySelectorAll('.course-submenu-item').forEach((item) => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const courseId = item.getAttribute('data-course-id');
        if (courseId) {
          const onAssistantPage = !!document.querySelector('.nav-item-expandable.active');
          if (onAssistantPage) {
            window.dispatchEvent(new CustomEvent('xzzd:assistant-course-select', {
              detail: { courseId }
            }));
            courseListEl.querySelectorAll('.course-submenu-item').forEach((linkEl) => {
              if (linkEl.getAttribute('data-course-id') === courseId) {
                linkEl.classList.add('active');
              } else {
                linkEl.classList.remove('active');
              }
            });
            collapseAssistantCourseSubmenu();
            return;
          }
          collapseAssistantCourseSubmenu();
          window.location.assign(`https://courses.zju.edu.cn/air?courseId=${courseId}`);
        }
      });
    });
  } catch (error) {
    if (!isCurrent()) return;
    console.error('XZZDPRO: Failed to load assistant courses', error);
    courseListEl.innerHTML = '<div class="submenu-error">加载课程失败</div>';
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function loadAssistantMaterials(courseId?: string): Promise<void> {
  const materialListEl = document.getElementById('assistant-material-list');
  if (!materialListEl) return;
  const requestId = ++materialsRequestId;
  const isCurrent = () => requestId === materialsRequestId && materialListEl.isConnected;

  const activeCourseId = courseId || new URLSearchParams(window.location.search).get('courseId');
  if (!activeCourseId) {
    sidebarMaterialCourseId = null;
    selectedSidebarMaterialUrls.clear();
    selectedHistoryDeleteIds.clear();
    assistantHistoryManageMode = false;
    materialListEl.innerHTML = '<div class="submenu-empty">请选择课程后加载资料</div>';
    return;
  }

  if (sidebarMaterialCourseId !== activeCourseId) {
    sidebarMaterialCourseId = activeCourseId;
    selectedSidebarMaterialUrls.clear();
    selectedHistoryDeleteIds.clear();
    assistantHistoryManageMode = false;
  }

  materialListEl.innerHTML = '<div class="submenu-loading">加载资料中...</div>';

  try {
    const [
      { fetchCourseMaterials },
      { getAssistantUploadHistory, deleteAssistantUploadHistoryItems },
    ] = await Promise.all([
      import("../services/courseDataService"),
      import("../storage"),
    ]);
    const [materials, historyItems] = await Promise.all([
      fetchCourseMaterials(activeCourseId),
      getAssistantUploadHistory(activeCourseId),
    ]);
    if (!isCurrent()) return;

    const coursewareFiles: SidebarMaterialFile[] = materials.flatMap(
      (material) =>
        (material.files || []).map((file) => ({
          ...file,
          materialTitle: material.title,
          sourceType: "courseware",
        })),
    );

    const historyFiles: SidebarMaterialFile[] = historyItems.map((item) => ({
      id: Number.isFinite(Number(item.id)) ? Number(item.id) : 0,
      name: item.name,
      size: item.size,
      downloadUrl: `assistant-history://${encodeURIComponent(item.id)}`,
      materialTitle: "历史上传",
      sourceType: "history_upload",
      historyId: item.id,
      historyPayloadRef: item.payloadRef,
      historyMimeType: item.mimeType,
      historyStatus: item.status,
      createdAt: item.createdAt,
    }));

    if (coursewareFiles.length === 0 && historyFiles.length === 0) {
      materialListEl.innerHTML =
        '<div class="submenu-empty">当前课程暂无可用资料</div>';
      return;
    }

    const fileByUrl = new Map<string, SidebarMaterialFile>();
    for (const file of [...coursewareFiles, ...historyFiles]) {
      fileByUrl.set(file.downloadUrl, file);
    }
    const historyById = new Map<string, AssistantUploadHistoryItem>();
    for (const item of historyItems) {
      historyById.set(item.id, item);
    }

    const getHistoryStatusLabel = (
      status?: SidebarMaterialFile["historyStatus"],
    ): string => {
      if (status === "missing") return "载入失败";
      if (status === "session_only") return "仅本次";
      return "可复用";
    };

    const getHistoryStatusClass = (
      status?: SidebarMaterialFile["historyStatus"],
    ): string => {
      if (status === "missing") return "status-missing";
      if (status === "session_only") return "status-session";
      return "status-ready";
    };

    const renderMaterialOption = (file: SidebarMaterialFile): string => {
      const checked = selectedSidebarMaterialUrls.has(file.downloadUrl)
        ? "checked"
        : "";
      const disabled =
        file.sourceType === "history_upload" &&
        file.historyStatus &&
        file.historyStatus !== "ready";
      const metaText =
        file.sourceType === "history_upload"
          ? `历史上传 · ${new Date(file.createdAt || Date.now()).toLocaleString("zh-CN")}`
          : file.materialTitle;
      const statusLabel =
        file.sourceType === "history_upload"
          ? `<span class="material-history-status ${getHistoryStatusClass(file.historyStatus)}">${getHistoryStatusLabel(file.historyStatus)}</span>`
          : "";
      return `
        <label class="material-submenu-item${disabled ? " is-disabled" : ""}" title="${escapeHtml(metaText)}">
          <input
            class="material-submenu-checkbox"
            type="checkbox"
            data-file-id="${file.id}"
            data-file-name="${encodeURIComponent(file.name)}"
            data-file-size="${file.size}"
            data-download-url="${encodeURIComponent(file.downloadUrl)}"
            data-material-title="${encodeURIComponent(file.materialTitle)}"
            data-source-type="${file.sourceType}"
            data-history-id="${encodeURIComponent(file.historyId || "")}"
            ${checked}
            ${disabled ? "disabled" : ""}
          />
          <span class="material-submenu-content">
            <span class="material-submenu-name">${escapeHtml(file.name)}</span>
            <span class="material-submenu-meta">${escapeHtml(metaText)}${statusLabel}</span>
          </span>
        </label>
      `;
    };

    const renderHistoryManageOption = (file: SidebarMaterialFile): string => {
      const historyId = file.historyId || "";
      const checked =
        historyId && selectedHistoryDeleteIds.has(historyId) ? "checked" : "";
      return `
        <label class="material-submenu-item material-submenu-item-manage" title="${escapeHtml(file.name)}">
          <input
            class="material-history-delete-checkbox"
            type="checkbox"
            data-history-id="${encodeURIComponent(historyId)}"
            ${checked}
          />
          <span class="material-submenu-content">
            <span class="material-submenu-name">${escapeHtml(file.name)}</span>
            <span class="material-submenu-meta">历史上传 · ${new Date(file.createdAt || Date.now()).toLocaleString("zh-CN")}</span>
          </span>
        </label>
      `;
    };

    const coursewareHtml =
      coursewareFiles.length > 0
        ? coursewareFiles.map(renderMaterialOption).join("")
        : '<div class="submenu-empty material-group-empty">暂无课程课件</div>';

    const historyHtml =
      historyFiles.length > 0
        ? assistantHistoryManageMode
          ? historyFiles.map(renderHistoryManageOption).join("")
          : historyFiles.map(renderMaterialOption).join("")
        : '<div class="submenu-empty material-group-empty">暂无历史上传</div>';

    const historyManageActionsHtml = assistantHistoryManageMode
      ? `
        <div class="material-history-manage-actions">
          <button id="assistant-history-delete-selected" class="material-action-btn danger" type="button">删除选中</button>
          <button id="assistant-history-manage-cancel" class="material-action-btn" type="button">完成</button>
        </div>
      `
      : "";

    materialListEl.innerHTML = `
      <div class="material-submenu-actions">
        <button id="assistant-material-clear-all" class="material-action-btn material-action-left" type="button">清除</button>
        <button id="assistant-material-invert" class="material-action-btn material-action-center" type="button">反选</button>
        <button id="assistant-material-select-all" class="material-action-btn material-action-right" type="button">全选</button>
      </div>
      <div class="material-group">
        <div class="material-group-header">
          <span class="material-group-title">课程课件</span>
          <span class="material-group-count">${coursewareFiles.length}</span>
        </div>
        ${coursewareHtml}
      </div>
      <div class="material-group">
        <div class="material-group-header">
          <span class="material-group-title">历史上传</span>
          <div class="material-group-header-actions">
            <button id="assistant-history-manage-toggle" class="material-manage-btn" type="button">
              ${assistantHistoryManageMode ? "退出管理" : "管理"}
            </button>
            <span class="material-group-count">${historyFiles.length}</span>
          </div>
        </div>
        ${historyManageActionsHtml}
        ${historyHtml}
      </div>
    `;

    const checkboxes = Array.from(materialListEl.querySelectorAll<HTMLInputElement>('.material-submenu-checkbox'));
    const clearAllBtn = materialListEl.querySelector<HTMLButtonElement>('#assistant-material-clear-all');
    const invertBtn = materialListEl.querySelector<HTMLButtonElement>('#assistant-material-invert');
    const selectAllBtn = materialListEl.querySelector<HTMLButtonElement>('#assistant-material-select-all');
    const historyManageToggleBtn =
      materialListEl.querySelector<HTMLButtonElement>(
        "#assistant-history-manage-toggle",
      );
    const historyDeleteSelectedBtn =
      materialListEl.querySelector<HTMLButtonElement>(
        "#assistant-history-delete-selected",
      );
    const historyManageCancelBtn =
      materialListEl.querySelector<HTMLButtonElement>(
        "#assistant-history-manage-cancel",
      );
    const historyDeleteCheckboxes = Array.from(
      materialListEl.querySelectorAll<HTMLInputElement>(
        ".material-history-delete-checkbox",
      ),
    );

    const updateSelectAllState = () => {
      const anyChecked = checkboxes.some(input => input.checked);
      if (!selectAllBtn) return;
      const allChecked = checkboxes.length > 0 && checkboxes.every(input => input.checked);
      selectAllBtn.disabled = allChecked;
      selectAllBtn.textContent = allChecked ? '已全选' : '全选';
      if (clearAllBtn) {
        clearAllBtn.disabled = !anyChecked;
      }
      if (invertBtn) {
        invertBtn.disabled = checkboxes.length === 0;
      }
    };

    const updateDeleteSelectionState = () => {
      if (!historyDeleteSelectedBtn) return;
      historyDeleteSelectedBtn.disabled = selectedHistoryDeleteIds.size === 0;
      historyDeleteSelectedBtn.textContent =
        selectedHistoryDeleteIds.size > 0
          ? `删除选中 (${selectedHistoryDeleteIds.size})`
          : "删除选中";
    };

    checkboxes.forEach((checkboxEl) => {
      checkboxEl.addEventListener('change', (event) => {
        const input = event.currentTarget as HTMLInputElement;
        const checked = input.checked;
        const downloadUrl = decodeURIComponent(input.dataset.downloadUrl || '');
        if (!downloadUrl) return;

        const file = fileByUrl.get(downloadUrl);
        if (!file) return;

        if (checked) {
          selectedSidebarMaterialUrls.add(downloadUrl);
        } else {
          selectedSidebarMaterialUrls.delete(downloadUrl);
        }

        window.dispatchEvent(
          new CustomEvent("xzzd:assistant-material-toggle", {
            detail: {
              courseId: activeCourseId,
              checked,
              file: {
                id: file.historyId || Number(input.dataset.fileId || 0),
                name: decodeURIComponent(input.dataset.fileName || ""),
                size: Number(input.dataset.fileSize || 0),
                downloadUrl,
                materialTitle: decodeURIComponent(
                  input.dataset.materialTitle || "",
                ),
                sourceType: file.sourceType,
                historyId: file.historyId,
                historyPayloadRef: file.historyPayloadRef,
                historyMimeType: file.historyMimeType,
                historyStatus: file.historyStatus,
              },
            },
          }),
        );

        updateSelectAllState();
      });
    });

    selectAllBtn?.addEventListener('click', () => {
      checkboxes.forEach((input) => {
        if (input.checked) return;
        input.checked = true;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      });
      updateSelectAllState();
    });

    clearAllBtn?.addEventListener('click', () => {
      checkboxes.forEach((input) => {
        if (!input.checked) return;
        input.checked = false;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      });
      updateSelectAllState();
    });

    invertBtn?.addEventListener('click', () => {
      checkboxes.forEach((input) => {
        input.checked = !input.checked;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      });
      updateSelectAllState();
    });

    historyManageToggleBtn?.addEventListener("click", () => {
      assistantHistoryManageMode = !assistantHistoryManageMode;
      selectedHistoryDeleteIds.clear();
      void loadAssistantMaterials(activeCourseId);
    });

    historyManageCancelBtn?.addEventListener("click", () => {
      assistantHistoryManageMode = false;
      selectedHistoryDeleteIds.clear();
      void loadAssistantMaterials(activeCourseId);
    });

    historyDeleteCheckboxes.forEach((checkboxEl) => {
      checkboxEl.addEventListener("change", (event) => {
        const input = event.currentTarget as HTMLInputElement;
        const historyId = decodeURIComponent(input.dataset.historyId || "");
        if (!historyId) return;
        if (input.checked) {
          selectedHistoryDeleteIds.add(historyId);
        } else {
          selectedHistoryDeleteIds.delete(historyId);
        }
        updateDeleteSelectionState();
      });
    });

    historyDeleteSelectedBtn?.addEventListener("click", async () => {
      if (selectedHistoryDeleteIds.size === 0) return;
      const idsToDelete = Array.from(selectedHistoryDeleteIds);
      await deleteAssistantUploadHistoryItems(activeCourseId, idsToDelete);
      // A read refresh does not invalidate a completed mutation in this course.
      if (!materialListEl.isConnected || sidebarMaterialCourseId !== activeCourseId) return;

      idsToDelete.forEach((historyId) => {
        const downloadUrl = `assistant-history://${encodeURIComponent(historyId)}`;
        if (!selectedSidebarMaterialUrls.has(downloadUrl)) return;
        selectedSidebarMaterialUrls.delete(downloadUrl);
        const item = historyById.get(historyId);
        if (!item) return;
        window.dispatchEvent(
          new CustomEvent("xzzd:assistant-material-toggle", {
            detail: {
              courseId: activeCourseId,
              checked: false,
              file: {
                id: historyId,
                name: item.name,
                size: item.size,
                downloadUrl,
                materialTitle: "历史上传",
                sourceType: "history_upload",
                historyId,
                historyPayloadRef: item.payloadRef,
                historyMimeType: item.mimeType,
                historyStatus: item.status,
              },
            },
          }),
        );
      });

      assistantHistoryManageMode = false;
      selectedHistoryDeleteIds.clear();
      await loadAssistantMaterials(activeCourseId);
    });

    updateSelectAllState();
    updateDeleteSelectionState();
  } catch (error) {
    if (!isCurrent()) return;
    console.error('XZZDPRO: Failed to load assistant materials', error);
    materialListEl.innerHTML = '<div class="submenu-error">加载资料失败</div>';
  }
}
