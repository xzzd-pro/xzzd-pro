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
  | "homework_score_updated"
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

// Layout state for index page
export interface LayoutState {
  leftHandleWidth: number;
  rightHandleWidth: number;
  welcomeCardHeight: number;
  coursesCardFlex: number;
  todoCardFlex: number;
  sidebarCollapsed: boolean;
}