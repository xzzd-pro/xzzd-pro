const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  vm = require("node:vm"),
  ts = require("typescript")
const source = ts.transpileModule(
  fs.readFileSync("src/features/bulletin/read-state.ts", "utf8"),
  {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022
    }
  }
).outputText
function load() {
  const exports = {}
  vm.runInNewContext(source, { exports })
  return exports
}
const zero = {
  activity_opened: 0,
  homework_opened_for_submission: 0,
  course_homework_make_up: 0,
  homework_score_updated: 0,
  exam_opened: 0,
  exam_will_start: 0,
  exam_submit_started: 0,
  others: 0
}
const notes = [
  { type: "activity_opened", timestamp: 100 },
  { type: "activity_opened", timestamp: 300 },
  { type: "homework_opened_for_submission", timestamp: 200 },
  { type: "course_homework_make_up", timestamp: 250 },
  { type: "homework_score_updated", timestamp: 150 },
  { type: "exam_opened", timestamp: 120 },
  { type: "exam_submit_started", timestamp: 180 },
  { type: "activity_expiring", timestamp: 400 },
  { type: "forum_reply_created", timestamp: 350 }
]

test("marking every filter at once advances all categories in one result", () => {
  const s = load()
  const next = s.advanceReadTimestamps(zero, s.MARKABLE_FILTERS, notes)
  assert.deepEqual(
    { ...next },
    {
      activity_opened: 300,
      homework_opened_for_submission: 200,
      course_homework_make_up: 250,
      homework_score_updated: 150,
      exam_opened: 120,
      exam_will_start: 0,
      exam_submit_started: 180,
      others: 400
    }
  )
})

test("a single filter covers its grouped types and leaves the rest alone", () => {
  const s = load()
  const next = s.advanceReadTimestamps(
    zero,
    ["homework_opened_for_submission"],
    notes
  )
  assert.equal(next.homework_opened_for_submission, 200)
  assert.equal(next.course_homework_make_up, 250)
  assert.equal(next.activity_opened, 0)
  assert.equal(next.others, 0)
  assert.deepEqual(
    [...s.typesForFilter("exam_will_start")],
    ["exam_opened", "exam_will_start", "exam_submit_started"]
  )
  assert.deepEqual([...s.typesForFilter("others")], ["others"])
})

test("timestamps never move back, and an unchanged state returns null", () => {
  const s = load()
  const ahead = { ...zero, activity_opened: 999, others: 999 }
  const next = s.advanceReadTimestamps(
    ahead,
    ["activity_opened", "others", "homework_score_updated"],
    notes
  )
  assert.equal(next.activity_opened, 999)
  assert.equal(next.others, 999)
  assert.equal(next.homework_score_updated, 150)
  assert.equal(
    s.advanceReadTimestamps(
      next,
      s.MARKABLE_FILTERS.filter(
        (f) => f !== "homework_opened_for_submission" && f !== "exam_will_start"
      ),
      notes
    ),
    null
  )
  assert.equal(s.advanceReadTimestamps(zero, s.MARKABLE_FILTERS, []), null)
})

test('read checks use the type timestamp, with unknown types under "others"', () => {
  const s = load()
  const ts = { ...zero, activity_opened: 300, others: 350 }
  assert.equal(
    s.isReadAt(ts, { type: "activity_opened", timestamp: 300 }),
    true
  )
  assert.equal(
    s.isReadAt(ts, { type: "activity_opened", timestamp: 301 }),
    false
  )
  assert.equal(
    s.isReadAt(ts, { type: "forum_reply_created", timestamp: 350 }),
    true
  )
  assert.equal(
    s.isReadAt(ts, { type: "activity_expiring", timestamp: 400 }),
    false
  )
})

test("an undo record is usable for 24 hours and must have timestamps", () => {
  const s = load()
  const now = 1_800_000_000_000
  assert.equal(
    s.isUsableUndo({ timestamps: zero, savedAt: now - 60_000 }, now),
    true
  )
  assert.equal(
    s.isUsableUndo(
      { timestamps: zero, savedAt: now - s.READ_UNDO_WINDOW_MS },
      now
    ),
    false
  )
  assert.equal(
    s.isUsableUndo({ timestamps: zero, savedAt: now + 60_000 }, now),
    false
  )
  for (const bad of [
    null,
    undefined,
    "x",
    { savedAt: now },
    { timestamps: zero }
  ])
    assert.equal(s.isUsableUndo(bad, now), false)
})
