const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const source=ts.transpileModule(fs.readFileSync('src/features/courses/courseFilters.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function load(fetch){const exports={};vm.runInNewContext(source,{exports,fetch,console});return exports}
test('academic semesters are chronological across school years and calendar years',()=>{const {semesterOrder:r}=load();assert.ok(r('2025-2026春夏学期')>r('2025-2026秋冬学期'));assert.ok(r('2026年秋学期')>r('2025-2026春夏学期'));assert.ok(r('2025-2026第一学期')<r('2025-2026第二学期'));assert.equal(r('2025-2026学年'),null);assert.equal(r('其他课程'),null)});
test('catalog deduplicates semesters and chooses latest with bounded concurrency',async()=>{let active=0,max=0;const api=load(async url=>{active++;max=Math.max(max,active);await new Promise(r=>setTimeout(r,3));active--;return {ok:true,json:async()=>({semester:url.endsWith('/9')?{id:2,name:'2025-2026春夏学期'}:{id:1,name:'2025-2026秋冬学期'}})}});const result=await api.collectCourseSemesters(Array.from({length:10},(_,id)=>({id})),new AbortController().signal);assert.equal(result.options.length,2);assert.equal(result.latestId,'2025:spring');assert.equal(result.warning,'');assert.ok(max<=4)});
test('partial failure and ambiguous names never silently choose a default',async()=>{const api=load(async url=>({ok:!url.endsWith('/2'),json:async()=>({semester:{id:1,name:'2025-2026秋冬学期'}})}));const result=await api.collectCourseSemesters([{id:1},{id:2}],new AbortController().signal);assert.equal(result.latestId,'');assert.match(result.warning,/失败/);const ambiguous=load(async()=>({ok:true,json:async()=>({semester:{id:3,name:'长期课程'}})}));assert.equal((await ambiguous.collectCourseSemesters([{id:3}],new AbortController().signal)).latestId,'')});

test('semester halves group split terms and keep different academic years separate', async()=>{
  const names=['2026-2027秋冬','2026-2027秋','2026-2027冬','2025-2026春夏','2025-2026春','2025-2026夏','2025-2026秋冬'];
  const api=load(async url=>{const id=Number(url.split('/').pop());return {ok:true,json:async()=>({semester:{id,name:names[id]}})}});
  const courses=names.map((_,id)=>({id,name:'信号 '+id,display_name:'信号 '+id,instructors:[{name:'教师'}]}));
  const catalog=await api.collectCourseSemesters(courses,new AbortController().signal);
  assert.equal(catalog.options.length,3);assert.equal(catalog.latestId,'2026:autumn');
  const latest=catalog.options.find(o=>o.id===catalog.latestId);
  assert.equal(latest.semesterIds.length,3);
  const statuses=new Map(courses.map(c=>[c.id,new Set([c.id===0?'ongoing':'closed'])]));
  let selected=api.filterCourses(courses,{keyword:'',status:api.COURSE_STATUSES,semester_id:latest.semesterIds},catalog.courseSemesters,statuses);
  assert.equal(selected.length,3);
  selected=api.filterCourses(courses,{keyword:'教师',status:['ongoing'],semester_id:latest.semesterIds},catalog.courseSemesters,statuses);
  assert.equal(selected.length,1);assert.equal(selected[0].id,0);
  assert.equal(api.filterCourses(courses,{keyword:'',status:api.COURSE_STATUSES,semester_id:[]},catalog.courseSemesters,statuses).length,7);
});
