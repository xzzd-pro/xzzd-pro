const fs = require('node:fs')
const path = require('node:path')
const postcss = require('postcss')
const tailwind = require('tailwindcss')
const repo = path.resolve(__dirname, '../..')
const store = path.join(repo, 'node_modules/.pnpm')
const esbuildDir = fs.readdirSync(store).find(name => name.startsWith('esbuild@'))
if (!esbuildDir) throw new Error('Install project dependencies before building the preview.')
const esbuild = require(path.join(store, esbuildDir, 'node_modules/esbuild'))
const out = path.resolve(process.argv[2] || path.join(repo, 'build/course-detail-preview'))

async function main() {
  fs.mkdirSync(out, { recursive: true })
  await esbuild.build({
    absWorkingDir: repo,
    entryPoints: ['scripts/preview/course-detail.tsx'], bundle: true,
    outfile: path.join(out, 'preview.js'), platform: 'browser',
    define: { 'process.env.NODE_ENV': '"development"' },
    plugins: [{ name: 'isolated-preview', setup(build) {
      build.onResolve({ filter: /^@plasmohq\/storage$/ }, () => ({ path: 'storage', namespace: 'fixture' }))
      build.onResolve({ filter: /^@plasmohq\/messaging$/ }, () => ({ path: 'messaging', namespace: 'fixture' }))
      build.onResolve({ filter: /assistant\/services\/fileService$/ }, () => ({ path: 'files', namespace: 'fixture' }))
      build.onLoad({ filter: /.*/, namespace: 'fixture' }, ({ path: name }) => ({ contents:
        name === 'storage' ? `export class Storage {
          async get(key) { return JSON.parse(localStorage.getItem(key) || 'null') }
          async set(key, value) { localStorage.setItem(key, JSON.stringify(value)) }
          watch() {} unwatch() {}
        }` : name === 'messaging' ? `export async function sendToBackground() { throw new Error('Extension messages are disabled in the preview') }` :
        `export async function convertPdfToImages() { return [] }
         export async function fetchFileContent() { return '模拟文件预览' }
         export async function fetchPdfBlob() { return new Blob([], {type:'application/pdf'}) }`,
        loader: 'js'
      }))
    } }]
  })
  const source = fs.readFileSync(path.join(repo, 'src/styles/global.css'), 'utf8')
    .replace('data-url:../assets/LXGWWenKaiScreen.ttf', './font.ttf')
  const result = await postcss([tailwind(path.join(repo, 'tailwind.config.js'))]).process(source, { from: path.join(repo, 'src/styles/global.css') })
  fs.writeFileSync(path.join(out, 'preview.css'), result.css + '\n' + fs.readFileSync(path.join(repo, 'src/styles/courseDetail.css'), 'utf8'))
  fs.copyFileSync(path.join(repo, 'src/assets/LXGWWenKaiScreen.ttf'), path.join(out, 'font.ttf'))
  fs.writeFileSync(path.join(out, 'index.html'), '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>课程详情 · 模拟数据预览</title><link rel="stylesheet" href="preview.css"></head><body><script src="preview.js"></script></body></html>')
  console.log(path.join(out, 'index.html'))
}
main().catch(error => { console.error(error); process.exitCode = 1 })
