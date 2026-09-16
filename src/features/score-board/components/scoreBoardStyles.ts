export const scoreBoardStyles = `
.score-board-view { --sb-accent: #416487; --sb-subtle: #f3f6fa; --sb-border: #e3e9f0; display: grid; gap: 20px; color: hsl(var(--foreground)); font-size: 14px; min-width: 0; }
.dark .score-board-view, [data-theme="dark"] .score-board-view { --sb-accent: #a9c5e2; --sb-subtle: #202b39; --sb-border: #334155; }
.score-board-view * { box-sizing: border-box; }
.score-board-view h3, .score-board-view p { margin: 0; }
.score-board-view h3 { font-size: 15px; font-weight: 650; line-height: 1.5; }
.score-board-view .score-board-overview { display: flex; align-items: center; justify-content: space-between; gap: 28px; padding: 24px 28px; background: var(--sb-subtle); border: 1px solid var(--sb-border); border-radius: 12px; }
.score-board-view .score-board-eyebrow { display: block; color: var(--sb-accent); font-size: 12px; font-weight: 600; margin-bottom: 7px; letter-spacing: .04em; }
.score-board-view .score-board-overview h3 { font-size: 20px; }
.score-board-view .score-board-overview p { font-size: 12px; color: hsl(var(--muted-foreground)); margin-top: 7px; }
.score-board-view .score-board-publications { display: grid; grid-template-columns: repeat(2, minmax(125px, 1fr)); gap: 32px; }
.score-board-view .score-board-publications > div { display: grid; gap: 12px; padding-left: 28px; border-left: 1px solid var(--sb-border); }
.score-board-view .score-board-publications > div > span:first-child { font-size: 13px; color: hsl(var(--muted-foreground)); }
.score-board-view .score-board-status { display: inline-flex; align-items: center; gap: 7px; font-size: 12px; color: hsl(var(--muted-foreground)); white-space: nowrap; }
.score-board-view .score-board-status > span { height: 6px; width: 6px; border-radius: 50%; background: currentColor; opacity: .6; }
.score-board-view .score-board-status.is-published { color: var(--sb-accent); }
.score-board-view .score-board-section { background: hsl(var(--card)); border: 1px solid var(--sb-border); border-radius: 12px; overflow: hidden; min-width: 0; }
.score-board-view .score-board-section-heading { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 19px 22px; }
.score-board-view .score-board-section-heading p { color: hsl(var(--muted-foreground)); font-size: 12px; margin-top: 5px; }
.score-board-view .score-board-note, .score-board-view .score-board-muted { color: hsl(var(--muted-foreground)); font-size: 12px; }
.score-board-view .score-board-breakdown { display: grid; grid-template-columns: minmax(240px, .85fr) minmax(0, 1.6fr); gap: 20px; align-items: start; }
.score-board-view .score-board-performance-body { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; padding: 5px 22px 24px; align-items: end; }
.score-board-view .score-board-metric-label { display: block; color: hsl(var(--muted-foreground)); font-size: 12px; margin-bottom: 9px; }
.score-board-view .score-board-performance-body strong { font-size: 32px; line-height: 1; letter-spacing: -.04em; font-weight: 650; color: var(--sb-accent); font-variant-numeric: tabular-nums; }
.score-board-view .score-board-performance-body b { font-size: 20px; line-height: 1; font-weight: 500; }
.score-board-view .score-board-table-scroll { overflow-x: auto; }
.score-board-view .score-board-table { border-collapse: collapse; width: 100%; min-width: 360px; text-align: left; font-size: 13px; }
.score-board-view .score-board-table th { background: var(--sb-subtle); color: hsl(var(--muted-foreground)); font-size: 12px; font-weight: 500; padding: 11px 22px; white-space: nowrap; border-top: 1px solid var(--sb-border); }
.score-board-view .score-board-table td { padding: 15px 22px; border-top: 1px solid var(--sb-border); line-height: 1.6; overflow-wrap: anywhere; }
.score-board-view .score-board-table tr:hover td { background: var(--sb-subtle); }
.score-board-view .score-board-numeric { width: 100px; text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
.score-board-view .score-board-value { font-size: 15px; font-weight: 600; color: var(--sb-accent); }
.score-board-view .score-board-comment { width: 34%; min-width: 160px; }
.score-board-view .score-board-activity-name { min-width: 160px; font-weight: 500; }
.score-board-view .score-board-filters { display: flex; gap: 6px; padding: 0 22px 17px; flex-wrap: wrap; }
.score-board-view .score-board-filters button { display: inline-flex; align-items: center; gap: 9px; padding: 8px 12px; border: 1px solid transparent; border-radius: 7px; background: transparent; color: hsl(var(--muted-foreground)); font-size: 13px; cursor: pointer; }
.score-board-view .score-board-filters button:hover, .score-board-view .score-board-filters button.is-active { background: var(--sb-subtle); color: var(--sb-accent); }
.score-board-view .score-board-filters button.is-active { border-color: var(--sb-border); font-weight: 600; }
.score-board-view .score-board-filters button > span { font-size: 11px; opacity: .75; font-variant-numeric: tabular-nums; }
.score-board-view button:focus-visible, .score-board-view .score-board-table-scroll:focus-visible { outline: 2px solid var(--sb-accent); outline-offset: -2px; }
.score-board-view .score-board-empty { padding: 20px 22px 27px; color: hsl(var(--muted-foreground)); font-size: 13px; }
.score-board-view .score-board-attendance { display: inline-block; border-radius: 5px; padding: 2px 8px; font-size: 12px; }
.score-board-view .score-board-attendance.is-normal { background: var(--sb-subtle); color: var(--sb-accent); }
.score-board-view .score-board-attendance.is-absent { background: hsl(var(--destructive) / .09); color: hsl(var(--destructive)); }
@media (max-width: 900px) {
  .score-board-view .score-board-breakdown { grid-template-columns: 1fr; }
  .score-board-view .score-board-overview { gap: 20px; padding: 22px; }
  .score-board-view .score-board-publications { gap: 16px; grid-template-columns: repeat(2, minmax(95px, 1fr)); }
  .score-board-view .score-board-publications > div { padding-left: 16px; }
}
@media (max-width: 600px) {
  .score-board-view { gap: 14px; }
  .score-board-view .score-board-overview { align-items: stretch; flex-direction: column; }
  .score-board-view .score-board-publications > div { padding: 14px 0 0; border-left: 0; border-top: 1px solid var(--sb-border); }
  .score-board-view .score-board-section-heading { padding: 17px 16px; flex-wrap: wrap; gap: 8px; }
  .score-board-view .score-board-table th, .score-board-view .score-board-table td { padding: 12px 16px; }
  .score-board-view .score-board-filters { padding: 0 16px 14px; gap: 3px; }
  .score-board-view .score-board-filters button { padding: 7px 9px; }
  .score-board-view .score-board-breakdown { gap: 14px; }
}
`
