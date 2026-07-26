/**
 * Type checks, not runtime tests.
 *
 * `npm run types` compiles this file with --strict and --noEmit. It fails if the
 * declarations drift away from what the library actually accepts, which is the
 * only way the claim "types included" stays true.
 *
 * Cases that must NOT compile are marked with @ts-expect-error: the compiler
 * fails if such a line turns out to be valid after all.
 */

import { renderReport, DEFAULT_MARGINS } from './index'
import type { ReportSpec, Block, Layout, RenderResult, TableBlock, ExtensionBlock } from './index'
import { PassThrough } from 'stream'

// Minimal call.
async function minimal (): Promise<number> {
  const r = await renderReport({ blocks: [{ type: 'paragraph', text: 'hello' }] })
  return r.pages
}

// Every block type in one spec.
const everything: ReportSpec = {
  title: 'Report',
  subtitle: 'Subtitle',
  titleBlock: true,
  meta: { author: 'A', subject: 'B', keywords: ['x', 'y'], creationDate: new Date(0) },
  page: { size: 'A4', layout: 'portrait', margins: { top: 40, left: 40 } },
  theme: { color: { accent: '#FF0000' }, size: { body: 11 } },
  header: { text: 'Header', right: 'page {page}', skipFirstPage: true },
  footer: { text: info => `${info.page}/${info.pages}`, rule: false },
  compress: false,
  blocks: [
    { type: 'heading', text: 'Section', level: 2, subtitle: 'sub' },
    { type: 'paragraph', text: 'Body', align: 'justify', orphans: 3, widows: 3 },
    { type: 'text', text: 'Alias for paragraph' },
    { type: 'list', items: ['a', 'b', 3], ordered: true },
    {
      type: 'table',
      columns: [
        { key: 'a', label: 'A', width: 60, align: 'right' },
        { key: 'b', label: 'B', flex: 2, format: (v, row, i) => `${String(v)}-${i}` }
      ],
      rows: [{ a: 1, b: 'x' }, { a: 2, b: { text: 'bold', bold: true } }],
      summary: { b: 'Total' },
      zebra: true,
      repeatHeader: false,
      caption: 'note'
    },
    { type: 'table', columns: [{ label: 'One' }, { label: 'Two' }], rows: [['x', 'y']] },
    { type: 'bar', data: [{ label: 'Jan', value: 10 }], target: 8, valueLabels: true, format: n => n.toFixed(1) },
    { type: 'delta', data: [{ label: 'Jan', value: 10 }], baseline: 8 },
    { type: 'scatter', series: [{ name: 'S', points: [{ x: 1, y: 2 }, [3, 4]] }] },
    { type: 'scatter', points: [[1, 2]] },
    { type: 'image', src: 'logo.png', width: 100, align: 'center', caption: 'Logo' },
    { type: 'image', src: Buffer.alloc(0) },
    { type: 'divider', thickness: 1 },
    { type: 'spacer', height: 20 },
    { type: 'pagebreak' },
    {
      type: 'custom',
      draw (L: Layout) {
        L.doc.fontSize(10).text('by hand', L.x, L.y, { width: L.width })
        if (L.space(20)) L.record({ type: 'custom-broke' })
        L.move(20)
      }
    },
  ]
}

// Registered block types are opted into explicitly, so the plain union keeps
// rejecting unknown types.
interface StampBlock extends ExtensionBlock {
  type: 'stamp'
  label: string
}

const withExtension: ReportSpec<StampBlock> = {
  blocks: [
    { type: 'paragraph', text: 'built in' },
    { type: 'stamp', label: 'APPROVED' }
  ]
}

// @ts-expect-error 'stamp' is not a built-in block type
const withoutExtension: ReportSpec = { blocks: [{ type: 'stamp', label: 'APPROVED' }] }

// Options and result shape.
async function outputs (): Promise<void> {
  const buffered: RenderResult = await renderReport(everything)
  const b: Buffer | undefined = buffered.buffer
  const size: number = buffered.geometry.capacity
  const first = buffered.layout[0]
  const page: number = first.page
  const kind: string = first.type
  void b; void size; void page; void kind

  await renderReport(everything, { output: 'out.pdf' })
  await renderReport(everything, { stream: new PassThrough() })
  await renderReport(withExtension, {
    renderers: {
      stamp (L, block, ctx) {
        const nextType: string | undefined = ctx.next?.type
        L.doc.text(String(block.label), L.x, L.y)
        L.move(14)
        void nextType
      }
    }
  })
}

// Generic rows keep their type inside format().
interface Line { code: string, total: number }
const typedTable: TableBlock<Line> = {
  type: 'table',
  columns: [
    { key: 'code', label: 'Code' },
    { key: 'total', label: 'Total', format: (v, row) => `${row.code}: ${String(v)}` }
  ],
  rows: [{ code: 'A', total: 1 }]
}

const margins: number = DEFAULT_MARGINS.top

// A block array stays assignable.
const blocks: Block[] = [{ type: 'pagebreak' }, { type: 'paragraph', text: 'x' }]

// --- these must all be rejected ---

// @ts-expect-error missing required text
const badHeading: Block = { type: 'heading' }

// @ts-expect-error level 4 does not exist
const badLevel: Block = { type: 'heading', text: 'x', level: 4 }

// @ts-expect-error justify is not a valid cell alignment
const badAlign: Block = { type: 'table', columns: [{ key: 'a', align: 'justify' }] }

// @ts-expect-error columns is required on a table
const badTable: Block = { type: 'table', rows: [] }

// @ts-expect-error an image needs a src
const badImage: Block = { type: 'image', width: 10 }

// @ts-expect-error a custom block needs a draw function
const badCustom: Block = { type: 'custom' }

// @ts-expect-error spec is not a string
const badSpec = renderReport('nope')

// @ts-expect-error output must be a string path
const badOption = renderReport(everything, { output: 42 })

void minimal; void outputs; void everything; void typedTable; void margins; void blocks
void withExtension; void withoutExtension
void badHeading; void badLevel; void badAlign; void badTable; void badImage; void badCustom
void badSpec; void badOption
