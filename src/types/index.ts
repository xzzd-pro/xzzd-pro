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
  url: string;
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
  url: string;
}

export interface ProcessedCourse {
  name: string;
  instructors: string;
  link: string;
}