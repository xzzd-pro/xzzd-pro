const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const source=ts.transpileModule(fs.readFileSync('src/features/home/homeSummary.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function load(){const exports={};vm.runInNewContext(source,{exports});return exports}
const text=(html)=>html.replace(/<[^>]+>/g,'');

test('greeting follows the hour and the date reads month, day and weekday',()=>{
  const s=load();const at=(h)=>new Date(2026,9,29,h,30);
  assert.deepEqual([2,6,12,15,20].map(h=>s.getGreeting(at(h))),['夜深了','早上好','中午好','下午好','晚上好']);
  assert.equal(s.getGreeting(new Date(2026,9,29,10,59)),'早上好');
  assert.equal(s.getGreeting(new Date(2026,9,29,11,0)),'中午好');
  assert.equal(s.formatLongDate(new Date(2026,9,29)),'10月29日 星期四');
  assert.equal(s.formatLongDate(new Date(2026,10,1)),'11月1日 星期日');
});

test('deadline counts use the badge thresholds and ignore undated todos',()=>{
  const s=load();
  assert.deepEqual({...s.countDeadlines([-2,0,1,7,8,null])},{dueSoon:2,overdue:2});
  assert.deepEqual({...s.countDeadlines([])},{dueSoon:0,overdue:0});
});

test('the sentence grows as counts arrive and leaves out anything missing or failed',()=>{
  const s=load();
  assert.equal(text(s.composeSummary('早上好',{})),'早上好');
  assert.equal(text(s.composeSummary('早上好',{courses:2})),'早上好，今天有 2 节课');
  assert.equal(text(s.composeSummary('早上好',{courses:2,dueSoon:2,overdue:0})),'早上好，今天有 2 节课，2 项待办即将截止');
  assert.equal(text(s.composeSummary('下午好',{courses:0,dueSoon:0,overdue:0})),'下午好，今天没有课，暂无即将截止的待办');
  assert.equal(text(s.composeSummary('晚上好',{courses:null,dueSoon:1,overdue:2})),'晚上好，1 项待办即将截止，2 项已过期');
  // Only overdue: no "nothing due" clause that would contradict it.
  assert.equal(text(s.composeSummary('晚上好',{dueSoon:0,overdue:1})),'晚上好，1 项已过期');
  assert.match(s.composeSummary('早上好',{overdue:1}),/class="home-summary-alert"><strong>1<\/strong> 项已过期/);
  assert.match(s.composeSummary('早上好',{courses:3}),/<strong>3<\/strong>/);
});

test('setSummaryStat keeps earlier counts and re-renders the heading',()=>{
  const s=load();
  const title={dataset:{greeting:'早上好'},innerHTML:''};
  const root={querySelector:()=>title};
  s.setSummaryStat(root,'courses',2);
  assert.equal(text(title.innerHTML),'早上好，今天有 2 节课');
  s.setSummaryStat(root,'dueSoon',null);s.setSummaryStat(root,'overdue',null);
  assert.equal(text(title.innerHTML),'早上好，今天有 2 节课');
  s.setSummaryStat(root,'dueSoon',3);s.setSummaryStat(root,'overdue',0);
  assert.equal(text(title.innerHTML),'早上好，今天有 2 节课，3 项待办即将截止');
  assert.match(s.renderSummaryHeading(new Date(2026,9,29,9)),/data-greeting="早上好"[\s\S]*10月29日 星期四/);
});

test('a random quote never repeats the current one and every quote can come up',()=>{
  const s=load();const n=s.QUOTES.length;
  // random() values spread across [0,1) reach every remaining quote exactly once.
  const current=s.QUOTES[0].text;
  const picks=Array.from({length:n-1},(_,i)=>s.pickRandomQuote(current,()=>(i+0.5)/(n-1)).text);
  assert.ok(!picks.includes(current));
  assert.equal(new Set(picks).size,n-1);
  // Edge values stay in range.
  assert.ok(s.QUOTES.includes(s.pickRandomQuote(undefined,()=>0)));
  assert.ok(s.QUOTES.includes(s.pickRandomQuote(undefined,()=>0.999999)));
  // A one-item list still returns its only quote.
  const only=[{text:'求是创新',source:'浙江大学校训'}];
  assert.equal(s.pickRandomQuote('求是创新',Math.random,only).text,'求是创新');
  for(const q of s.QUOTES){assert.ok(q.text.trim());assert.ok(q.source.trim())}
});

test('the quote renders as a focusable control with the full text in its tooltip',()=>{
  const s=load();
  const html=s.renderQuote({text:'只问是非，不计利害。',source:'竺可桢'});
  assert.match(html,/role="button" tabindex="0" aria-label="换一句语录"/);
  assert.match(html,/title="只问是非，不计利害。 —— 竺可桢\n点击换一句"/);
  assert.match(html,/<blockquote>只问是非，不计利害。<\/blockquote>\s*<figcaption>—— 竺可桢<\/figcaption>/);
});
