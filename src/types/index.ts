export interface ApiTodoData {
  course_code: string;
  course_id: number;
  course_name: string;
  course_type: number;
  end_time: string;
  id: number;
  is_locked: boolean;
  is_student: boolean;
  order: string;
  prerequisites: any[];
  title: string;
  type: string;
}

export interface ProcessedTodo {
  title: string;
  type: string;
  courseName: string;
  deadline: string;
  daysLeft: number | null;
  link: string;
}

export interface ApiCourseData {
  id: number;
  name: string;
  display_name: string;
  academic_year_id: number;
  course_attributes: {
    teaching_class_name: string;
  };
  instructors: Array<{
    id: number;
    name: string;
  }>;
}

export interface ProcessedCourse {
  name: string;
  instructors: string;
  link: string;
}

// Notification types
export type NotificationType =
  | "activity_opened"
  | "homework_opened_for_submission"
  | "course_homework_make_up"
  | "homework_score_updated"
  | "exam_opened"
  | "exam_will_start"
  | "exam_submit_started"
  | "activity_expiring";

export interface ApiNotificationData {
  id: string;
  type: NotificationType | string;
  top: boolean;
  timestamp: number;
  read?: boolean;
  payload: {
    activity_id?: number;
    activity_title?: string;
    activity_type?: string;
    course_id: number;
    course_name: string;
    created_at: string;
    end_time?: string;
    start_time?: string;
    homework_id?: number;
    homework_title?: string;
    exam_id?: number;
    exam_title?: string;
    score?: string;
    instructor_comment?: string;
    [key: string]: any;
  };
}

export interface ProcessedNotification {
  id: string;
  type: NotificationType;
  title: string;
  courseName: string;
  time: string;
  link: string;
  read: boolean;
  score?: string;
  timestamp: number;
}

// Read timestamps storage for marking notifications as read
export interface ReadTimestamps {
  activity_opened: number;
  homework_opened_for_submission: number;
  course_homework_make_up: number;
  homework_score_updated: number;
  exam_opened: number;
  exam_will_start: number;
  exam_submit_started: number;
  others: number;
}

// Activity material types
export interface MaterialUpload {
  allow_aliyun_office_view: boolean;
  allow_download: boolean;
  allow_private_wps_office_view: boolean;
  created_at: string;
  created_by_id: number;
  deleted: boolean;
  id: number;
  key: string;
  name: string;
  size: number;
  type: string;
  updated_at: string;
}

export interface MaterialReference {
  deleted: boolean;
  id: number;
  name: string;
  org_id: number;
  parent_id: number;
  parent_type: string;
  upload: MaterialUpload;
  upload_id: number;
}

export interface MaterialApiResponse {
  references: MaterialReference[];
}

export interface ProcessedMaterial {
  id: number;
  name: string;
  size: number;
  sizeText: string;
  type: string;
  uploadId: number;
  downloadUrl: string;
  canDownload: boolean;
}

// Courseware types (new API)
export interface CoursewareUpload {
  allow_download: boolean;
  created_at: string;
  created_by_id: number;
  id: number;
  name: string;
  size: number;
}

export interface CoursewareActivity {
  completion_criterion: string;
  course_id: number;
  created_at: string;
  id: number;
  is_closed: boolean;
  is_in_progress: boolean;
  is_started: boolean;
  title: string;
  updated_at: string;
  uploads: CoursewareUpload[];
}

export interface CoursewareApiResponse {
  activities: CoursewareActivity[];
}

export interface ProcessedCoursewareSection {
  id: number;
  title: string;
  isStarted: boolean;
  isClosed: boolean;
  completionCriterion: string;
  files: ProcessedCoursewareFile[];
}

export interface ProcessedCoursewareFile {
  id: number;
  name: string;
  size: number;
  sizeText: string;
  canDownload: boolean;
  downloadUrl: string;
}

// Homework types
export interface HomeworkActivity {
  id: number;
  title: string;
  score: string;
  submitted: boolean;
  is_closed: boolean;
  end_time: string;
  start_time: string;
  deadline: string;
  score_published: boolean;
  type: string;
  module_id: number;
  teaching_unit_id: number;
  user_submit_count: number;
  is_in_progress: boolean;
}

export interface HomeworkApiResponse {
  end: number;
  homework_activities: HomeworkActivity[];
}

export interface ProcessedHomework {
  id: number;
  title: string;
  score: string;
  submitted: boolean;
  isClosed: boolean;
  endTime: string;
  deadline: Date;
  scorePublished: boolean;
  link: string;
}

// Homework submission types
export interface SubmissionUpload {
  id: number;
  name: string;
  size: number;
  type: string;
  created_at: string;
  allow_download: boolean;
}

export interface HomeworkSubmission {
  id: number;
  activity_id: number;
  is_draft: boolean;
  is_latest_version: boolean;
  marked_submitted: boolean;
  submitted_at: string;
  uploads: SubmissionUpload[];
  score: string | null;
}

export interface SubmissionListResponse {
  list: HomeworkSubmission[];
}

// Upload API types
export interface UploadPreRegisterResponse {
  id: number;
  key: number;
  name: string;
  status: string;
  upload_url: string;
  url: string;
}

export interface UploadFileResponse {
  file_key: string;
}

// Layout state for index page
export interface LayoutState {
  leftHandleWidth: number;
  rightHandleWidth: number;
  welcomeCardHeight: number;
  coursesCardFlex: number;
  todoCardFlex: number;
  sidebarCollapsed: boolean;
}

// Score board types
// 1. 总成绩设置
export interface AnnounceScoreSettings {
  announce_raw_score_time: string | null;
  announce_raw_score_type: string;
  announce_score_time: string | null;
  announce_score_type: string;
  is_announce_raw_score_time_passed: boolean;
  is_announce_score_time_passed: boolean;
}

export interface AnnounceScoreSettingsResponse {
  announce_score_settings: AnnounceScoreSettings;
}

// 2. 考勤成绩
export interface RollcallItem {
  is_expired: boolean;
  is_number: boolean;
  is_radar: boolean;
  published_at: string | null;
  rollcall_id: number;
  rollcall_status: string;
  rollcall_time: string;
  scored: boolean;
  source: string;
  status: string;
  student_rollcall_id: number;
  student_status: string;
  student_status_detail: string;
  title: string;
  type: string;
}

export interface RollcallsResponse {
  rollcalls: RollcallItem[];
}

// 3. 课堂表现成绩
export interface PerformanceScoreResponse {
  announce_score_setting: string;
  extra_score_updated_time: string | null;
  interaction_score: number | null;
  score: number | null;
  score_announce_setting: {
    announce_time: string | null;
    setting_name: string;
  };
  score_announced: boolean;
  score_percentage: string;
  standard_score: number;
}

// 4. 自定义成绩项
export interface CustomScoreItem {
  announce_score_time: string | null;
  announce_score_type: string;
  can_announce_score: boolean;
  created_at: string;
  id: number;
  is_external_score_item: boolean | null;
  name: string;
  referrer_type: string;
  score: string;
  score_percentage: string;
}

export interface CustomScoreItemsResponse {
  custom_score_items: CustomScoreItem[];
}

// 5. 学习活动成绩 - 作业
export interface HomeworkScoreActivity {
  id: number;
  title: string;
  score_percentage: string;
  end_time: string;
  data: {
    score_percentage: string;
  };
}

export interface HomeworkScoreItem {
  activity_id: number;
  final_score: number | null;
  instructor_comment: string;
  inter_score: number | null;
  intra_score: number | null;
  score: string;
  student_id: number;
}

export interface HomeworkScoresResponse {
  homework_activities: HomeworkScoreActivity[];
  scores: HomeworkScoreItem[];
}

// 5. 学习活动成绩 - 测试
export interface ExamScoreItem {
  activity_id: number;
  score: number;
  submission_scores: number[];
}

export interface ExamScoresResponse {
  exam_scores: ExamScoreItem[];
}

export interface ExamInfo {
  title: string;
  type: string;
  unique_key: string;
  using_phase: string;
}

export interface ExamsResponse {
  exams: ExamInfo[];
}

// Forum/Discussion types
export interface TopicCategory {
  activity: any | null;
  activity_id: number;
  category_instructor_reply_rate: number;
  category_like_count: number;
  category_unread_reply_count: number;
  category_unread_topic_count: number;
  category_visits_number: number;
  created_at: string;
  current_user_reply_count: number;
  current_user_topic_count: number;
  id: number;
  title: string;
  topics: Topic[];
  topics_and_replies_count: number;
}

export interface TopicCategoriesResponse {
  end: number;
  page: number;
  page_size: number;
  pages: number;
  start: number;
  topic_categories: TopicCategory[];
  total: number;
}

export interface TopicAuthor {
  id: number;
  name: string;
  avatar_url?: string;
}

export interface Topic {
  id: number;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
  author: TopicAuthor;
  reply_count: number;
  like_count: number;
  is_top: boolean;
  is_digest: boolean;
  instructor_replied: boolean;
  last_reply_at: string | null;
}

export interface CategoryDetailResponse {
  activity_id: number | null;
  id: number;
  result: {
    end: number;
    page: number;
    page_size: number;
    pages: number;
    start: number;
    topics: Topic[];
    total: number;
  };
}

export interface ProcessedCategory {
  id: number;
  title: string;
  topicCount: number;
  unreadCount: number;
}