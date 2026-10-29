// Probe a small pool concurrently: empty or slow courses must not hold up
// courses that already have a user activity record. No user ID is persisted.
export function findNotificationUser(
  courses: { id: number }[],
  signal?: AbortSignal
): Promise<string | null> {
  return new Promise((resolve) => {
    const controller = new AbortController()
    let cursor = 0
    let done = false
    const finish = (id: string | null) => {
      if (done) return
      done = true
      signal?.removeEventListener("abort", cancel)
      controller.abort()
      resolve(id)
    }
    const cancel = () => finish(null)
    if (signal?.aborted) {
      finish(null)
      return
    }
    signal?.addEventListener("abort", cancel, { once: true })
    async function worker() {
      while (!done && cursor < courses.length) {
        const course = courses[cursor++]
        try {
          const response = await fetch(
            `https://courses.zju.edu.cn/api/course/${course.id}/activity-reads-for-user`,
            { signal: controller.signal }
          )
          if (!response.ok || done) continue
          const data = await response.json()
          const record = data.activity_reads?.[0]
          const id = record?.created_by_id || record?.created_for_id
          if (id && !done) finish(String(id))
        } catch {
          /* A failed course does not prevent checking the next one. */
        }
      }
    }
    void Promise.all(
      Array.from({ length: Math.min(4, courses.length) }, worker)
    ).then(() => finish(null))
  })
}
