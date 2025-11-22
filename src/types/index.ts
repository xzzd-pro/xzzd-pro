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