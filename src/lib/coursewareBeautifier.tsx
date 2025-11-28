// lib/coursewareBeautifier.tsx

import { renderCourseDetailPage, setupThemeToggle, getCourseIdFromUrl, getCourseName  } from "./components/courseDetailHelpers"
import type { MaterialApiResponse, MaterialReference, ProcessedMaterial } from "../types"

// Fetch materials for an activity
async function fetchActivityMaterials(activityId: string): Promise<MaterialReference[]> {
  try {
    const response = await fetch(
      `https://courses.zju.edu.cn/api/activities/${activityId}/upload_references`
    );

    if (!response.ok) {
      console.error('XZZDPRO: 获取课件失败', response.status);
      return [];
    }

    const data: MaterialApiResponse = await response.json();
    return data.references || [];
  } catch (error) {
    console.error('XZZDPRO: 获取课件时出错', error);
    return [];
  }
}

// Format file size
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

// Get file type icon
function getFileTypeIcon(type: string): string {
  const iconMap: Record<string, string> = {
    'document': '📄',
    'video': '🎥',
    'audio': '🎵',
    'image': '🖼️',
    'archive': '📦',
    'default': '📎'
  };
  return iconMap[type] || iconMap['default'];
}

// Process materials
function processMaterials(references: MaterialReference[]): ProcessedMaterial[] {
  return references
    .filter(ref => !ref.deleted && ref.upload)
    .map(ref => ({
      id: ref.id,
      name: ref.name,
      size: ref.upload.size,
      sizeText: formatFileSize(ref.upload.size),
      type: ref.upload.type,
      uploadId: ref.upload_id,
      downloadUrl: `https://courses.zju.edu.cn/api/uploads/${ref.upload_id}/blob`,
      canDownload: ref.upload.allow_download
    }));
}

// Render materials list
function renderMaterialsList(materials: ProcessedMaterial[]): string {
  if (materials.length === 0) {
    return '<p class="no-materials-message">暂无课件</p>';
  }

  return materials.map(material => `
    <div class="material-item">
      <div class="material-icon">${getFileTypeIcon(material.type)}</div>
      <div class="material-info">
        <div class="material-name">${material.name}</div>
        <div class="material-meta">
          <span class="material-size">${material.sizeText}</span>
          <span class="material-type">${material.type}</span>
        </div>
      </div>
      <div class="material-actions">
        ${material.canDownload
          ? `<a href="${material.downloadUrl}" class="download-btn" download="${material.name}" target="_blank">
              <span class="download-icon">⬇️</span>
              <span class="download-text">下载</span>
            </a>`
          : `<span class="download-disabled">不可下载</span>`
        }
      </div>
    </div>
  `).join('');
}

// Load and render materials
async function loadAndRenderMaterials(activityId: string) {
  const container = document.querySelector('#materials-list');
  if (!container) return;

  container.innerHTML = '<p class="loading-message">正在加载课件...</p>';

  const references = await fetchActivityMaterials(activityId);
  const materials = processMaterials(references);

  container.innerHTML = renderMaterialsList(materials);
}

export async function coursewareBeautifier(activityId?: string): Promise<void> {
  console.log('XZZDPRO: 准备接管课件下载页...');

  document.body.innerHTML = '';
  const root = document.createElement('div');
  root.className = 'xzzdpro-root';

  const courseId = getCourseIdFromUrl();
  if (!courseId) {
    console.error('XZZDPRO: 无法提取课程ID');
    return;
  }

  const courseName = await getCourseName();

  const contentHtml = `
    <div id="materials-list" class="materials-list">
      <p class="loading-message">正在加载课件列表...</p>
    </div>
  `;

  root.innerHTML = renderCourseDetailPage(
    courseId,
    courseName,
    'materials',
    '课件下载',
    contentHtml
  );

  document.body.appendChild(root);
  document.body.classList.add('xzzdpro-body');

  setupThemeToggle();

  console.log('XZZDPRO: 课件下载页面渲染完成，开始加载数据...');

  // Load materials if activityId is provided
  if (activityId) {
    loadAndRenderMaterials(activityId);
  }
}
