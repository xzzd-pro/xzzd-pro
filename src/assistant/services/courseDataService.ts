import type { CourseInfo, MaterialSummary, HomeworkSummary, CourseContext } from '../types'
import { createMyCoursesPayload, fetchMyCoursesResponse } from '@/lib/myCoursesApi'

interface ApiCourseData {
    id: number
    name: string
    display_name: string
    instructors: Array<{ id: number; name: string }>
}


interface HomeworkActivity {
    id: number
    title: string
    description?: string
    end_time: string
    is_closed: boolean
}

export async function fetchAllCourses(): Promise<CourseInfo[]> {
    const response = await fetchMyCoursesResponse(
        createMyCoursesPayload({
            status: ['ongoing', 'notStarted']
        })
    )

    if (!response.ok) {
        throw new Error(`Failed to fetch courses: ${response.status}`)
    }

    const data = await response.json()
    const courses: ApiCourseData[] = data.courses || []

    return courses.map(course => ({
        id: course.id,
        name: course.name,
        displayName: course.display_name || course.name,
        instructors: course.instructors.map(i => i.name)
    }))
}

interface CoursewareUpload {
    id: number
    name: string
    size: number
}

interface CoursewareActivity {
    id: number
    title: string
    description?: string
    uploads?: CoursewareUpload[]
}

export async function fetchCourseMaterials(courseId: string): Promise<MaterialSummary[]> {
    const response = await fetch(
        `https://courses.zju.edu.cn/api/course/${courseId}/coursewares?conditions=%7B%22category%22:null,%22itemsSortBy%22:%7B%22predicate%22:%22chapter%22,%22reverse%22:true%7D,%22ignore_activity_types%22:%5B%22lesson%22%5D%7D&page=1&page_size=1000`,
        { credentials: 'include' }
    )

    if (!response.ok) {
        return []
    }

    const data = await response.json()
    const activities: CoursewareActivity[] = data.activities || []

    return activities.map(activity => ({
        id: activity.id,
        title: activity.title,
        description: activity.description,
        files: (activity.uploads || []).map(u => ({
            id: u.id,
            name: u.name,
            size: u.size,
            downloadUrl: `https://courses.zju.edu.cn/api/uploads/${u.id}/blob`
        }))
    }))
}

export async function fetchHomeworkList(courseId: string): Promise<HomeworkSummary[]> {
    const response = await fetch(
        `https://courses.zju.edu.cn/api/courses/${courseId}/homework-activities?conditions%5Bstatus%5D%5B%5D=ongoing&conditions%5Bstatus%5D%5B%5D=notStarted&conditions%5Bstatus%5D%5B%5D=closed`,
        { credentials: 'include' }
    )

    if (!response.ok) {
        return []
    }

    const data = await response.json()
    const activities: HomeworkActivity[] = data.homework_activities || []

    return activities.map(activity => ({
        id: activity.id,
        title: activity.title,
        requirement: activity.description,
        deadline: activity.end_time
    }))
}

export async function fetchCourseName(courseId: string): Promise<string> {
    const response = await fetch(
        `https://courses.zju.edu.cn/api/courses/${courseId}`,
        { credentials: 'include' }
    )

    if (!response.ok) {
        return `Course ${courseId}`
    }

    const data = await response.json()
    return data.display_name || data.name || `Course ${courseId}`
}

interface BuildCourseContextOptions {
    includeHomeworks?: boolean
}

export async function buildCourseContext(
    courseId: string,
    options: BuildCourseContextOptions = {}
): Promise<CourseContext> {
    const includeHomeworks = options.includeHomeworks ?? true

    const [courseName, materials, homeworks] = await Promise.all([
        fetchCourseName(courseId),
        fetchCourseMaterials(courseId),
        includeHomeworks ? fetchHomeworkList(courseId) : Promise.resolve([])
    ])

    return {
        courseId,
        courseName,
        materials,
        homeworks
    }
}
