// lib/scoreBoardBeautifier.tsx

import { getCourseIdFromUrl, getCourseName, renderCourseDetailPage, setupThemeToggle, setupHelpModal, setupSidebarToggle } from "./components/courseDetailHelpers"
import type {
  AnnounceScoreSettingsResponse,
  RollcallsResponse,
  RollcallItem,
  PerformanceScoreResponse,
  CustomScoreItemsResponse,
  CustomScoreItem,
  HomeworkScoresResponse,
  HomeworkScoreActivity,
  HomeworkScoreItem,
  ExamScoresResponse,
  ExamsResponse,
  ExamInfo
} from "../types"

// Get user ID
async function getUserId(): Promise<string | null> {
  try {
    const coursesResponse = await fetch('https://courses.zju.edu.cn/api/my-courses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conditions: {
          semester_id: [],
          status: ["ongoing", "notStarted", "closed"],
          keyword: "",
          classify_type: "recently_started",
          display_studio_list: false
        },
        showScorePassedStatus: false
      })
    });

    if (!coursesResponse.ok) return null;
    const coursesData = await coursesResponse.json();
    if (!coursesData.courses || coursesData.courses.length === 0) return null;

    const courseId = coursesData.courses[0].id;
    const activityResponse = await fetch(
      `https://courses.zju.edu.cn/api/course/${courseId}/activity-reads-for-user`
    );

    if (!activityResponse.ok) return null;
    const activityData = await activityResponse.json();
    if (!activityData.activity_reads || activityData.activity_reads.length === 0) return null;

    const firstActivity = activityData.activity_reads[0];
    const userId = firstActivity.created_by_id || firstActivity.created_for_id;
    return userId ? String(userId) : null;
  } catch (error) {
    console.error('XZZDPRO: 获取用户ID时出错', error);
    return null;
  }
}

// 1. 获取总成绩设置
async function fetchAnnounceScoreSettings(courseId: string): Promise<AnnounceScoreSettingsResponse | null> {
  try {
    const response = await fetch(`https://courses.zju.edu.cn/api/courses/${courseId}/announce-score-settings`);
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.error('XZZDPRO: 获取总成绩设置时出错', error);
    return null;
  }
}

// 2. 获取考勤成绩
async function fetchRollcalls(courseId: string, studentId: string): Promise<RollcallItem[]> {
  try {
    const response = await fetch(`https://courses.zju.edu.cn/api/course/${courseId}/student/${studentId}/rollcalls`);
    if (!response.ok) return [];
    const data: RollcallsResponse = await response.json();
    return data.rollcalls || [];
  } catch (error) {
    console.error('XZZDPRO: 获取考勤成绩时出错', error);
    return [];
  }
}

// 3. 获取课堂表现成绩
async function fetchPerformanceScore(courseId: string): Promise<PerformanceScoreResponse | null> {
  try {
    const response = await fetch(`https://courses.zju.edu.cn/api/course/${courseId}/performance-score`);
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.error('XZZDPRO: 获取课堂表现成绩时出错', error);
    return null;
  }
}

// 4. 获取自定义成绩项
async function fetchCustomScoreItems(courseId: string): Promise<CustomScoreItem[]> {
  try {
    const response = await fetch(`https://courses.zju.edu.cn/api/courses/${courseId}/custom-score-items`);
    if (!response.ok) return [];
    const data: CustomScoreItemsResponse = await response.json();
    return data.custom_score_items || [];
  } catch (error) {
    console.error('XZZDPRO: 获取自定义成绩项时出错', error);
    return [];
  }
}

// 5. 获取作业成绩
async function fetchHomeworkScores(courseId: string): Promise<HomeworkScoresResponse | null> {
  try {
    const response = await fetch(`https://courses.zju.edu.cn/api/course/${courseId}/homework-scores`);
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.error('XZZDPRO: 获取作业成绩时出错', error);
    return null;
  }
}

// 5. 获取测试成绩
async function fetchExamScores(courseId: string): Promise<ExamScoresResponse | null> {
  try {
    const response = await fetch(`https://courses.zju.edu.cn/api/courses/${courseId}/exam-scores`);
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.error('XZZDPRO: 获取测试成绩时出错', error);
    return null;
  }
}

// 5. 获取测试列表
async function fetchExams(courseId: string): Promise<ExamInfo[]> {
  try {
    const response = await fetch(`https://courses.zju.edu.cn/api/courses/${courseId}/exams`);
    if (!response.ok) return [];
    const data: ExamsResponse = await response.json();
    return data.exams || [];
  } catch (error) {
    console.error('XZZDPRO: 获取测试列表时出错', error);
    return [];
  }
}

// 格式化时间
function formatTime(isoTime: string): string {
  const date = new Date(isoTime);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// 获取考勤状态显示文本
function getRollcallStatusText(status: string): { text: string; className: string } {
  if (status === 'on_call_fine') {
    return { text: '正常', className: 'status-normal' };
  }
  return { text: '缺勤', className: 'status-absent' };
}

// 获取公布状态显示文本
function getAnnounceStatusText(type: string): { text: string; className: string } {
  if (type === 'no_announce') {
    return { text: '未公布', className: 'announce-no' };
  }
  return { text: '已公布', className: 'announce-yes' };
}

// 渲染总成绩部分
function renderTotalScore(settings: AnnounceScoreSettingsResponse | null): string {
  if (!settings) {
    return `
      <div class="score-section">
        <h3 class="section-title">总成绩</h3>
        <p class="no-data-message">无法获取总成绩信息</p>
      </div>
    `;
  }

  const finalStatus = getAnnounceStatusText(settings.announce_score_settings.announce_score_type);
  const rawStatus = getAnnounceStatusText(settings.announce_score_settings.announce_raw_score_type);

  return `
    <div class="score-section">
      <h3 class="section-title">总成绩</h3>
      <div class="total-score-grid">
        <div class="total-score-item">
          <span class="score-label">最终成绩</span>
          <span class="score-status ${finalStatus.className}">${finalStatus.text}</span>
        </div>
        <div class="total-score-item">
          <span class="score-label">原始成绩</span>
          <span class="score-status ${rawStatus.className}">${rawStatus.text}</span>
        </div>
      </div>
    </div>
  `;
}

// 渲染考勤成绩部分
function renderRollcalls(rollcalls: RollcallItem[]): string {
  if (rollcalls.length === 0) {
    return `
      <div class="score-section">
        <h3 class="section-title">考勤成绩</h3>
        <p class="no-data-message">暂无考勤记录</p>
      </div>
    `;
  }

  const rollcallItems = rollcalls.map(item => {
    const status = getRollcallStatusText(item.status);
    return `
      <div class="rollcall-item">
        <div class="rollcall-time">${formatTime(item.rollcall_time)}</div>
        <div class="rollcall-status ${status.className}">${status.text}</div>
        <div class="rollcall-scored ${item.scored ? 'scored-yes' : 'scored-no'}">
          ${item.scored ? '计分' : '不计分'}
        </div>
      </div>
    `;
  }).join('');

  return `
    <div class="score-section">
      <h3 class="section-title">考勤成绩</h3>
      <div class="rollcall-header">
        <span>签到时间</span>
        <span>出勤状态</span>
        <span>是否计分</span>
      </div>
      <div class="rollcall-list">
        ${rollcallItems}
      </div>
    </div>
  `;
}

// 渲染课堂表现成绩部分
function renderPerformanceScore(performance: PerformanceScoreResponse | null): string {
  if (!performance) {
    return `
      <div class="score-section">
        <h3 class="section-title">课堂表现成绩</h3>
        <p class="no-data-message">无法获取课堂表现信息</p>
      </div>
    `;
  }

  const announceStatus = getAnnounceStatusText(performance.announce_score_setting);
  const scoreDisplay = performance.score !== null ? performance.score : '--';
  const percentageDisplay = parseFloat(performance.score_percentage) > 0
    ? `${performance.score_percentage}%`
    : '0%';

  return `
    <div class="score-section">
      <h3 class="section-title">课堂表现成绩</h3>
      <div class="performance-grid">
        <div class="performance-item">
          <span class="perf-label">公布状态</span>
          <span class="perf-value ${announceStatus.className}">${announceStatus.text}</span>
        </div>
        <div class="performance-item">
          <span class="perf-label">成绩</span>
          <span class="perf-value perf-score">${scoreDisplay}</span>
        </div>
        <div class="performance-item">
          <span class="perf-label">成绩占比</span>
          <span class="perf-value">${percentageDisplay}</span>
        </div>
      </div>
    </div>
  `;
}

// 渲染自定义成绩项部分
function renderCustomScoreItems(items: CustomScoreItem[]): string {
  if (items.length === 0) {
    return `
      <div class="score-section">
        <h3 class="section-title">自定义成绩项</h3>
        <p class="no-data-message">暂无自定义成绩项</p>
      </div>
    `;
  }

  const itemsHtml = items.map(item => {
    const scoreDisplay = item.score || '--';
    const percentageDisplay = parseFloat(item.score_percentage) > 0
      ? `${item.score_percentage}%`
      : '0%';

    return `
      <div class="custom-score-item">
        <div class="custom-score-name">${item.name}</div>
        <div class="custom-score-value">${scoreDisplay}</div>
        <div class="custom-score-percentage">${percentageDisplay}</div>
      </div>
    `;
  }).join('');

  return `
    <div class="score-section">
      <h3 class="section-title">自定义成绩项</h3>
      <div class="custom-score-header">
        <span>名称</span>
        <span>得分</span>
        <span>成绩占比</span>
      </div>
      <div class="custom-score-list">
        ${itemsHtml}
      </div>
    </div>
  `;
}

// 渲染学习活动成绩部分
function renderActivityScores(
  homeworkData: HomeworkScoresResponse | null,
  examScores: ExamScoresResponse | null,
  exams: ExamInfo[]
): string {
  // 处理作业成绩
  let homeworkHtml = '';
  if (homeworkData && homeworkData.homework_activities.length > 0) {
    const scoreMap = new Map<number, HomeworkScoreItem>();
    homeworkData.scores.forEach(s => scoreMap.set(s.activity_id, s));

    const homeworkItems = homeworkData.homework_activities.map(activity => {
      const scoreItem = scoreMap.get(activity.id);
      const score = scoreItem?.score || '--';
      const comment = scoreItem?.instructor_comment || '';
      const percentage = parseFloat(activity.score_percentage) > 0
        ? `${activity.score_percentage}%`
        : '0%';

      return `
        <div class="homework-score-item">
          <div class="hw-score-name">${activity.title}</div>
          <div class="hw-score-value">${score}</div>
          <div class="hw-score-percentage">${percentage}</div>
          <div class="hw-score-comment" title="${comment}">${comment || '--'}</div>
        </div>
      `;
    }).join('');

    homeworkHtml = `
      <div class="activity-subsection">
        <h4 class="subsection-title">作业</h4>
        <div class="homework-score-header">
          <span>名称</span>
          <span>成绩</span>
          <span>占比</span>
          <span>老师评语</span>
        </div>
        <div class="homework-score-list">
          ${homeworkItems}
        </div>
      </div>
    `;
  } else {
    homeworkHtml = `
      <div class="activity-subsection">
        <h4 class="subsection-title">作业</h4>
        <p class="no-data-message">暂无作业成绩</p>
      </div>
    `;
  }

  // 处理测试成绩
  let examHtml = '';
  if (examScores && examScores.exam_scores.length > 0 && exams.length > 0) {
    // 创建 activity_id 到 exam 信息的映射
    const examMap = new Map<number, ExamInfo>();
    exams.forEach(exam => {
      const match = exam.unique_key.match(/exam-(\d+)/);
      if (match) {
        examMap.set(parseInt(match[1]), exam);
      }
    });

    const examItems = examScores.exam_scores.map(scoreItem => {
      const examInfo = examMap.get(scoreItem.activity_id);
      const title = examInfo?.title || `测试 #${scoreItem.activity_id}`;
      const score = scoreItem.score !== null ? scoreItem.score : '--';

      return `
        <div class="exam-score-item">
          <div class="exam-score-name">${title}</div>
          <div class="exam-score-value">${score}</div>
        </div>
      `;
    }).join('');

    examHtml = `
      <div class="activity-subsection">
        <h4 class="subsection-title">测试</h4>
        <div class="exam-score-header">
          <span>名称</span>
          <span>得分</span>
        </div>
        <div class="exam-score-list">
          ${examItems}
        </div>
      </div>
    `;
  } else {
    examHtml = `
      <div class="activity-subsection">
        <h4 class="subsection-title">测试</h4>
        <p class="no-data-message">暂无测试成绩</p>
      </div>
    `;
  }

  return `
    <div class="score-section">
      <h3 class="section-title">学习活动成绩</h3>
      ${homeworkHtml}
      ${examHtml}
    </div>
  `;
}

// 加载并渲染所有成绩数据
async function loadAndRenderScores(courseId: string) {
  const container = document.querySelector('#score-content');
  if (!container) return;

  container.innerHTML = '<p class="loading-message">正在加载成绩数据...</p>';

  // 获取用户ID
  const userId = await getUserId();
  if (!userId) {
    container.innerHTML = '<p class="error-message">无法获取用户信息</p>';
    return;
  }

  // 并行获取所有数据
  const [
    announceSettings,
    rollcalls,
    performanceScore,
    customScoreItems,
    homeworkScores,
    examScores,
    exams
  ] = await Promise.all([
    fetchAnnounceScoreSettings(courseId),
    fetchRollcalls(courseId, userId),
    fetchPerformanceScore(courseId),
    fetchCustomScoreItems(courseId),
    fetchHomeworkScores(courseId),
    fetchExamScores(courseId),
    fetchExams(courseId)
  ]);

  // 渲染所有部分
  const html = `
    ${renderTotalScore(announceSettings)}
    ${renderRollcalls(rollcalls)}
    ${renderPerformanceScore(performanceScore)}
    ${renderCustomScoreItems(customScoreItems)}
    ${renderActivityScores(homeworkScores, examScores, exams)}
  `;

  container.innerHTML = html;
}

export async function scoreBoardBeautifier(): Promise<void> {
  console.log('XZZDPRO: 准备接管成绩页...');

  // 移除 chatbot 并监视动态添加
  const removeChatbot = () => {
    document.querySelectorAll('air-chatbot-app').forEach(el => el.remove());
  };
  removeChatbot();

  const observer = new MutationObserver(() => {
    removeChatbot();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  // 5秒后停止监视
  setTimeout(() => observer.disconnect(), 5000);

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
    <div id="score-content" class="score-board-content">
      <p class="loading-message">正在加载成绩...</p>
    </div>
  `;

  root.innerHTML = renderCourseDetailPage(
    courseId,
    courseName,
    'grades',
    '成绩',
    contentHtml
  );

  document.body.appendChild(root);
  document.body.classList.add('xzzdpro-body');

  setupThemeToggle();
  setupHelpModal();
  setupSidebarToggle();

  console.log('XZZDPRO: 成绩页面渲染完成，开始加载数据...');

  loadAndRenderScores(courseId);
}
