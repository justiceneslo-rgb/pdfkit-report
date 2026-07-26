// Type definitions for pdfkit-report
// Project: https://github.com/justicedigital/pdfkit-report

/// <reference types="node" />

import type { Writable } from 'stream'

export type Align = 'left' | 'center' | 'right'
export type ParagraphAlign = Align | 'justify'

/**
 * The page cursor handed to custom blocks. `doc` is the underlying PDFKit
 * document; everything else describes where you are on the page.
 */
export interface Layout {
  /** The PDFKit document. Typed as `any` so PDFKit's own types stay optional. */
  doc: any
  theme: Theme
  /** Left edge of the content column. */
  x: number
  /** Width of the content column. */
  width: number
  /** Current vertical position. */
  y: number
  /** Top of the content area, below any running header. */
  top: number
  /** Bottom of the content area, above any running footer. */
  bottom: number
  /** 1-based page number currently being drawn. */
  page: number
  /** Vertical room left on this page. */
  readonly free: number
  /** Vertical room on a completely empty page. */
  readonly pageCapacity: number
  /** True when the cursor sits at the top of an otherwise empty page. */
  readonly atPageTop: boolean
  /** Advance the cursor by `h` points. */
  move (h: number): void
  /** Break to a new page. */
  newPage (reason?: string): number
  /** Ensure `h` points are free, breaking if not. Returns true if it broke. */
  space (h: number, reason?: string): boolean
  /** Add an entry to the layout log. */
  record (event: Record<string, unknown>): void
}

export interface Theme {
  font: string
  fontBold: string
  fontItalic: string
  size: {
    h1: number
    h2: number
    h3: number
    body: number
    table: number
    small: number
    caption: number
    [key: string]: number
  }
  color: {
    text: string
    muted: string
    line: string
    accent: string
    band: string
    headBand: string
    white: string
    negative: string
    positive: string
    grid: string
    series: string[]
    [key: string]: string | string[]
  }
  gap: {
    block: number
    afterHeading: number
    paragraph: number
    cellPadX: number
    cellPadY: number
    [key: string]: number
  }
  rule: {
    thin: number
    medium: number
    thick: number
    [key: string]: number
  }
}

/** Theme overrides are merged one level deep; arrays are replaced wholesale. */
export type ThemeOverrides = {
  [K in keyof Theme]?: Theme[K] extends object ? Partial<Theme[K]> : Theme[K]
}

export interface BlockBase {
  /** Vertical space before this block. Defaults to one theme gap. */
  spaceBefore?: number
  /** Extra vertical space after this block. */
  spaceAfter?: number
  /** Reserve room for this block plus the start of the next one. */
  keepWithNext?: boolean
}

export interface HeadingBlock extends BlockBase {
  type: 'heading'
  text: string
  /** 1 to 3. Defaults to 2. */
  level?: 1 | 2 | 3
  subtitle?: string
  color?: string
  /** Level 1 headings carry an accent rule unless this is false. */
  rule?: boolean
}

export interface ParagraphBlock extends BlockBase {
  type: 'paragraph' | 'text'
  text: string
  align?: ParagraphAlign
  bold?: boolean
  italic?: boolean
  color?: string
  fontSize?: number
  /** Minimum lines kept on the page a paragraph breaks from. Default 2. */
  orphans?: number
  /** Minimum lines carried to the next page. Default 2. */
  widows?: number
}

export interface ListBlock extends BlockBase {
  type: 'list'
  items: Array<string | number>
  ordered?: boolean
  bullet?: string
  indent?: number
  gap?: number
  color?: string
  markerColor?: string
  fontSize?: number
}

export interface Column<Row = any> {
  /** Key to read from an object row. Ignored for array rows. */
  key?: string
  /** Header text. Falls back to `key`. */
  label?: string
  align?: Align
  headerAlign?: Align
  /** Exact width in points. */
  width?: number
  /** Share of the remaining width. Default 1. Must be above 0. */
  flex?: number
  bold?: boolean
  color?: string
  /** Not called for null, undefined or empty string. */
  format?: (value: any, row: Row, rowIndex: number) => string
}

export interface Cell {
  value?: any
  text?: string
  align?: Align
  bold?: boolean
  color?: string
}

export type TableRow = Record<string, any> | any[]

export interface TableBlock<Row extends TableRow = TableRow> extends BlockBase {
  type: 'table'
  columns: Array<Column<Row>>
  rows?: Row[]
  /** Emphasised closing row, laid out like any other row. */
  summary?: Row
  /** Shade every other row. */
  zebra?: boolean
  /** Repeat the header on each new page. Default true. */
  repeatHeader?: boolean
  /** Draw a header row at all. Default true. */
  header?: boolean
  headerBand?: boolean
  headerBandColor?: string
  headerColor?: string
  headerFontSize?: number
  ruleColor?: string
  zebraColor?: string
  fontSize?: number
  caption?: string
}

export interface ChartDatum {
  label?: string
  value: number
  color?: string
}

export interface BarBlock extends BlockBase {
  type: 'bar'
  data: ChartDatum[]
  /** Plot height in points. Default 170. */
  height?: number
  title?: string
  caption?: string
  /** Draw a dashed reference line at this value. */
  target?: number
  targetColor?: string
  /** Print each value above its bar. */
  valueLabels?: boolean
  /** Bar width as a share of its slot. Default 0.55. */
  barRatio?: number
  /** Colour each bar separately. Off by default: one series, one colour. */
  colorByPoint?: boolean
  color?: string
  /** Approximate number of axis ticks. Default 4. */
  ticks?: number
  /** Format axis and value labels. */
  format?: (value: number) => string
}

export interface DeltaBlock extends BlockBase {
  type: 'delta'
  data: ChartDatum[]
  /** Value the bars deviate from. Default 0. */
  baseline?: number
  height?: number
  title?: string
  caption?: string
  barRatio?: number
  ticks?: number
  format?: (value: number) => string
}

export type Point = { x: number, y: number } | [number, number]

export interface ScatterSeries {
  name?: string
  color?: string
  points: Point[]
}

export interface ScatterBlock extends BlockBase {
  type: 'scatter'
  /** One or more named series. Use `points` for a single unnamed series. */
  series?: ScatterSeries[]
  points?: Point[]
  height?: number
  title?: string
  caption?: string
  color?: string
  /** Point radius in points. Default 2.4. */
  radius?: number
  opacity?: number
  ticks?: number
  xTicks?: number
  format?: (value: number) => string
}

export interface ImageBlock extends BlockBase {
  type: 'image'
  /** File path, Buffer or data URI. PNG and JPEG only. */
  src: string | Buffer
  /** Drawn width in points. Capped at the content width. */
  width?: number
  /** Drawn height in points. Derived from the aspect ratio if omitted. */
  height?: number
  align?: Align
  caption?: string
  captionAlign?: Align
}

export interface DividerBlock extends BlockBase {
  type: 'divider'
  thickness?: number
  color?: string
}

export interface SpacerBlock extends BlockBase {
  type: 'spacer'
  /** Negative values are clamped to 0. */
  height?: number
}

export interface PageBreakBlock extends BlockBase {
  type: 'pagebreak'
}

export interface CustomBlock extends BlockBase {
  type: 'custom'
  draw (layout: Layout): void
}

/**
 * A block handled by a renderer registered through `options.renderers`.
 *
 * Deliberately NOT part of `Block`. Folding an index-signature type into the
 * union would make every object with a `type` field assignable, so the union
 * would stop rejecting anything. Pass your own block type as the spec's type
 * argument instead: `ReportSpec<StampBlock>`.
 */
export interface ExtensionBlock extends BlockBase {
  type: string
  [key: string]: any
}

/** The blocks this library renders out of the box. */
export type Block =
  | HeadingBlock
  | ParagraphBlock
  | ListBlock
  | TableBlock
  | BarBlock
  | DeltaBlock
  | ScatterBlock
  | ImageBlock
  | DividerBlock
  | SpacerBlock
  | PageBreakBlock
  | CustomBlock

/** `{page}` and `{pages}` are substituted, or use a function. */
export type RunningText = string | ((info: { page: number, pages: number }) => string)

export interface RunningElement {
  text?: RunningText
  right?: RunningText
  align?: Align
  /** Draw the separating rule. Default true. */
  rule?: boolean
  /** Leave it off page 1. */
  skipFirstPage?: boolean
  /** Reserved height in points. Derived from the font size if omitted. */
  height?: number
}

export interface PageSetup {
  /** 'A4', 'LETTER', 'LEGAL', or [width, height] in points. Default 'A4'. */
  size?: string | [number, number]
  layout?: 'portrait' | 'landscape'
  margins?: {
    top?: number
    right?: number
    bottom?: number
    left?: number
  }
}

export interface DocumentMeta {
  author?: string
  subject?: string
  keywords?: string | string[]
  creator?: string
  /** Pin this to make the output byte-reproducible. */
  creationDate?: Date
}

/**
 * A report. Pass a block type as `E` when you register extra renderers:
 * `const spec: ReportSpec<StampBlock> = { ... }`
 */
export interface ReportSpec<E extends ExtensionBlock = never> {
  title?: string
  subtitle?: string
  /** Draw the title and subtitle on page 1. Default true when there is a title. */
  titleBlock?: boolean
  meta?: DocumentMeta
  page?: PageSetup
  theme?: ThemeOverrides
  header?: RunningElement | false
  footer?: RunningElement | false
  /** Compress the content streams. Default true. Turn off to read the PDF source. */
  compress?: boolean
  blocks?: Array<Block | E>
}

export interface RenderOptions {
  /** Write to this path. Resolves once the file is flushed. */
  output?: string
  /** Pipe into a writable stream, for example an HTTP response. */
  stream?: Writable
  /** Extra block types, keyed by the `type` they handle. */
  renderers?: Record<string, (layout: Layout, block: any, context: BlockContext) => void>
}

export interface BlockContext {
  next?: Block
  previous?: Block
  index: number
}

/** One decision the renderer made, in document order. */
export interface LayoutEvent {
  type: string
  page: number
  [key: string]: any
}

export interface Geometry {
  width: number
  top: number
  bottom: number
  capacity: number
}

export interface RenderResult {
  pages: number
  /** Every layout decision, in order. */
  layout: LayoutEvent[]
  geometry: Geometry
  /** Present when neither `output` nor `stream` was given. */
  buffer?: Buffer
  /** Present when `output` was given. */
  path?: string
}

/**
 * Render a report specification to a PDF.
 *
 * With neither `output` nor `stream`, the PDF comes back as `result.buffer`.
 */
export function renderReport<E extends ExtensionBlock = never> (
  spec: ReportSpec<E>,
  options?: RenderOptions
): Promise<RenderResult>

export const DEFAULT_MARGINS: { top: number, right: number, bottom: number, left: number }
