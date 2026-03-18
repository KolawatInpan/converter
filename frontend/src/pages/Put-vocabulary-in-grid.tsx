import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import kleeOneRegularUrl from '../font/KleeOne-Regular.ttf'
import kleeOneSemiBoldUrl from '../font/KleeOne-SemiBold.ttf'

const A4_PORTRAIT_W_MM = 210
const A4_PORTRAIT_H_MM = 297
const PREVIEW_PX_PER_MM = 2.5

const GRID_COLOR = '#94a3b8'
const BG_COLOR = '#ffffff'
const TEXT_COLOR = '#0f172a'

const WORD_BG_COLORS = [
	'rgba(59,130,246,0.10)',
	'rgba(16,185,129,0.10)',
	'rgba(245,158,11,0.10)',
	'rgba(236,72,153,0.10)',
	'rgba(139,92,246,0.10)',
]
const WORD_BAR_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6']

type FillDirection = 'horizontal' | 'vertical'
type TemplateStyle = 'classic' | 'bold-5' | 'cross'
type PageOrientation = 'portrait' | 'landscape'
type LaneMode = 'next-line' | 'half' | 'third'

type FontOption = {
	label: string
	value: string
	weight: string
}

type GridImportState = {
	vocabWords?: string[]
}

type PageLayout = {
	words: PlacedWord[]
}

type PlacedWord = {
	word: string
	chars: string[]
	cells: Array<{ r: number; c: number }>
	colorIdx: number
}

type DrawOptions = {
	cellMm: number
	pxPerMm: number
	templateStyle: TemplateStyle
	fontFamily: string
	fontWeight: string
	orientation: PageOrientation
	pages: PageLayout[]
}

const FONT_OPTIONS: FontOption[] = [
	{ label: 'Arial', value: 'Arial, sans-serif', weight: '600' },
	{ label: 'Times New Roman', value: '"Times New Roman", serif', weight: '600' },
	{ label: 'Courier New', value: '"Courier New", monospace', weight: '700' },
	{ label: 'Georgia', value: 'Georgia, serif', weight: '600' },
	{ label: 'Trebuchet MS', value: '"Trebuchet MS", sans-serif', weight: '600' },
]

const BUNDLED_FONT_OPTIONS: Array<FontOption & { family: string; source: string }> = [
	{
		label: 'Klee One Regular',
		value: '"Klee One Grid Regular", sans-serif',
		weight: '400',
		family: 'Klee One Grid Regular',
		source: kleeOneRegularUrl,
	},
	{
		label: 'Klee One SemiBold',
		value: '"Klee One Grid SemiBold", sans-serif',
		weight: '600',
		family: 'Klee One Grid SemiBold',
		source: kleeOneSemiBoldUrl,
	},
]

function getPageSizeMm(orientation: PageOrientation) {
	if (orientation === 'landscape') {
		return { pageWmm: A4_PORTRAIT_H_MM, pageHmm: A4_PORTRAIT_W_MM }
	}
	return { pageWmm: A4_PORTRAIT_W_MM, pageHmm: A4_PORTRAIT_H_MM }
}

function parseVocab(text: string): string[] {
	return text
		.split(/[\s,、]+/)
		.map((word) => word.trim())
		.filter((word) => word.length > 0)
}

function isKatakanaWord(word: string): boolean {
	return /^[\u30A0-\u30FFー]+$/.test(word)
}

function isKanjiOnlyWord(word: string): boolean {
	return /^[\u4E00-\u9FAF々〆ヵヶ]+$/.test(word)
}

function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, value))
}

function getLaneStep(total: number, laneMode: LaneMode) {
	if (laneMode === 'half') {
		return Math.max(1, Math.ceil(total / 2))
	}
	if (laneMode === 'third') {
		return Math.max(1, Math.ceil(total / 3))
	}
	return 1
}

function buildPages(
	vocabWords: string[],
	rows: number,
	cols: number,
	fillDirection: FillDirection,
	startRow: number,
	startCol: number,
	laneMode: LaneMode,
): PageLayout[] {
	const pages: PageLayout[] = []
	if (rows <= 0 || cols <= 0 || vocabWords.length === 0) {
		return pages
	}

	const rowStart = clamp(startRow, 1, rows) - 1
	const colStart = clamp(startCol, 1, cols) - 1
	const horizontalStep = getLaneStep(rows, laneMode)
	const verticalStep = getLaneStep(cols, laneMode)

	let currentPage: PageLayout = { words: [] }
	let cursorRow = rowStart
	let cursorCol = colStart

	function pushPageIfNeeded() {
		if (currentPage.words.length > 0) {
			pages.push(currentPage)
		}
		currentPage = { words: [] }
		cursorRow = rowStart
		cursorCol = colStart
	}

	function moveToNextLane() {
		if (fillDirection === 'horizontal') {
			cursorRow += horizontalStep
			cursorCol = colStart
			if (cursorRow >= rows) {
				pushPageIfNeeded()
			}
			return
		}

		cursorCol += verticalStep
		cursorRow = rowStart
		if (cursorCol >= cols) {
			pushPageIfNeeded()
		}
	}

	for (let index = 0; index < vocabWords.length; index += 1) {
		const word = vocabWords[index]
		const chars = [...word]
		const cells: Array<{ r: number; c: number }> = []

		if (fillDirection === 'horizontal') {
			if (cursorCol >= cols) {
				moveToNextLane()
			}

			if (cursorRow >= rows) {
				pushPageIfNeeded()
			}

			if (chars.length <= cols && cursorCol + chars.length > cols) {
				moveToNextLane()
			}

			for (let i = 0; i < chars.length; i += 1) {
				if (cursorRow >= rows) {
					pushPageIfNeeded()
				}

				if (cursorCol >= cols) {
					moveToNextLane()
				}

				if (cursorRow >= rows) {
					pushPageIfNeeded()
				}

				cells.push({ r: cursorRow, c: cursorCol })
				cursorCol += 1
			}
		} else {
			if (cursorRow >= rows) {
				moveToNextLane()
			}

			if (cursorCol >= cols) {
				pushPageIfNeeded()
			}

			if (chars.length <= rows && cursorRow + chars.length > rows) {
				moveToNextLane()
			}

			for (let i = 0; i < chars.length; i += 1) {
				if (cursorCol >= cols) {
					pushPageIfNeeded()
				}

				if (cursorRow >= rows) {
					moveToNextLane()
				}

				if (cursorCol >= cols) {
					pushPageIfNeeded()
				}

				cells.push({ r: cursorRow, c: cursorCol })
				cursorRow += 1
			}
		}

		currentPage.words.push({
			word,
			chars,
			cells,
			colorIdx: index % WORD_BG_COLORS.length,
		})
	}

	if (currentPage.words.length > 0) {
		pages.push(currentPage)
	}

	return pages
}

function drawPage(
	canvas: HTMLCanvasElement,
	page: PageLayout,
	options: Omit<DrawOptions, 'pages'>,
): { placedWords: number; placedChars: number } {
	const {
		cellMm,
		pxPerMm,
		templateStyle,
		fontFamily,
		fontWeight,
		orientation,
	} = options

	const { pageWmm, pageHmm } = getPageSizeMm(orientation)
	const w = pageWmm * pxPerMm
	const h = pageHmm * pxPerMm
	const cellPx = cellMm * pxPerMm
	const rows = Math.max(1, Math.floor(pageHmm / cellMm))
	const cols = Math.max(1, Math.floor(pageWmm / cellMm))
	const gridW = cols * cellPx
	const gridH = rows * cellPx
	const offsetX = (w - gridW) / 2
	const offsetY = (h - gridH) / 2

	canvas.width = w
	canvas.height = h

	const ctx = canvas.getContext('2d')
	if (!ctx) return { placedWords: 0, placedChars: 0 }

	ctx.fillStyle = BG_COLOR
	ctx.fillRect(0, 0, w, h)

	for (const { cells, colorIdx } of page.words) {
		ctx.fillStyle = WORD_BG_COLORS[colorIdx]
		for (const { r, c } of cells) {
			ctx.fillRect(offsetX + c * cellPx, offsetY + r * cellPx, cellPx, cellPx)
		}
	}

	for (let col = 0; col <= cols; col += 1) {
		let lineWidth = 0.5
		if (templateStyle === 'bold-5' && col % 5 === 0) lineWidth = 1.4
		ctx.beginPath()
		ctx.lineWidth = lineWidth
		ctx.strokeStyle = GRID_COLOR
		ctx.moveTo(offsetX + col * cellPx, offsetY)
		ctx.lineTo(offsetX + col * cellPx, offsetY + gridH)
		ctx.stroke()
	}

	for (let row = 0; row <= rows; row += 1) {
		let lineWidth = 0.5
		if (templateStyle === 'bold-5' && row % 5 === 0) lineWidth = 1.4
		ctx.beginPath()
		ctx.lineWidth = lineWidth
		ctx.strokeStyle = GRID_COLOR
		ctx.moveTo(offsetX, offsetY + row * cellPx)
		ctx.lineTo(offsetX + gridW, offsetY + row * cellPx)
		ctx.stroke()
	}

	if (templateStyle === 'cross') {
		ctx.strokeStyle = '#cbd5e1'
		ctx.lineWidth = 0.4
		for (let row = 0; row < rows; row += 1) {
			for (let col = 0; col < cols; col += 1) {
				const cx = offsetX + col * cellPx + cellPx / 2
				const cy = offsetY + row * cellPx + cellPx / 2
				const half = cellPx * 0.12
				ctx.beginPath()
				ctx.moveTo(cx - half, cy)
				ctx.lineTo(cx + half, cy)
				ctx.moveTo(cx, cy - half)
				ctx.lineTo(cx, cy + half)
				ctx.stroke()
			}
		}
	}

	const barH = Math.max(2, cellPx * 0.055)
	for (const { cells, colorIdx } of page.words) {
		ctx.fillStyle = WORD_BAR_COLORS[colorIdx]
		for (const { r, c } of cells) {
			ctx.fillRect(offsetX + c * cellPx + 1, offsetY + r * cellPx + 1, cellPx - 2, barH)
		}
	}

	ctx.textAlign = 'center'
	ctx.textBaseline = 'middle'
	ctx.font = `${fontWeight} ${Math.max(9, cellPx * 0.58)}px ${fontFamily}`
	ctx.fillStyle = TEXT_COLOR

	let placedChars = 0
	for (const { chars, cells } of page.words) {
		for (let i = 0; i < chars.length && i < cells.length; i += 1) {
			const { r, c } = cells[i]
			ctx.fillText(
				chars[i],
				offsetX + c * cellPx + cellPx / 2,
				offsetY + r * cellPx + cellPx / 2,
			)
			placedChars += 1
		}
	}

	return { placedWords: page.words.length, placedChars }
}

function exportPdf(options: DrawOptions) {
	const dpi = 150
	const pxPerMm = dpi / 25.4

	const imageUrls = options.pages.map((page) => {
		const canvas = document.createElement('canvas')
		drawPage(canvas, page, { ...options, pxPerMm })
		return canvas.toDataURL('image/png')
	})

	const { pageWmm, pageHmm } = getPageSizeMm(options.orientation)
	const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<style>
  @page { size: ${options.orientation === 'landscape' ? 'A4 landscape' : 'A4 portrait'}; margin: 0; }
  body { margin: 0; padding: 0; }
  img { display: block; width: ${pageWmm}mm; height: ${pageHmm}mm; page-break-after: always; }
  img:last-child { page-break-after: auto; }
</style>
</head>
<body>${imageUrls.map((url) => `<img src="${url}"/>`).join('')}</body>
</html>`

	const win = window.open('', '_blank')
	if (!win) {
		alert('Allow pop-ups to export as PDF.')
		return
	}

	win.document.write(html)
	win.document.close()
	win.onload = () => {
		win.print()
	}
}

export default function PutVocabularyInGrid() {
	const location = useLocation()
	const importState = location.state as GridImportState | null
	const importedWords = useMemo(
		() => (Array.isArray(importState?.vocabWords) ? importState.vocabWords : []),
		[importState],
	)

	const [cellMm, setCellMm] = useState(10)
	const [inputVal, setInputVal] = useState('10')
	const [vocabInput, setVocabInput] = useState(
		importedWords.length > 0 ? importedWords.join('\n') : '大学 花火 展覧会',
	)
	const [customFonts, setCustomFonts] = useState<FontOption[]>([])
	const [selectedFont, setSelectedFont] = useState(BUNDLED_FONT_OPTIONS[0].value)
	const [selectedWeight, setSelectedWeight] = useState(BUNDLED_FONT_OPTIONS[0].weight)
	const [templateStyle, setTemplateStyle] = useState<TemplateStyle>('classic')
	const [orientation, setOrientation] = useState<PageOrientation>('portrait')
	const [fillDirection, setFillDirection] = useState<FillDirection>('horizontal')
	const [laneMode, setLaneMode] = useState<LaneMode>('half')
	const [filterKatakana, setFilterKatakana] = useState(false)
	const [filterKanjiOnly, setFilterKanjiOnly] = useState(false)
	const [startRow, setStartRow] = useState(1)
	const [startCol, setStartCol] = useState(1)
	const [placedWords, setPlacedWords] = useState(0)
	const [placedChars, setPlacedChars] = useState(0)
	const previewRefs = useRef<Array<HTMLCanvasElement | null>>([])

	function handleCellChange(raw: string) {
		setInputVal(raw)
		const next = parseFloat(raw)
		if (Number.isNaN(next) || next < 1 || next > 50) {
			return
		}
		setCellMm(next)
	}

	const { pageWmm, pageHmm } = getPageSizeMm(orientation)
	const cols = Math.max(1, Math.floor(pageWmm / cellMm))
	const rows = Math.max(1, Math.floor(pageHmm / cellMm))
	const previewW = pageWmm * PREVIEW_PX_PER_MM
	const previewH = pageHmm * PREVIEW_PX_PER_MM
	const vocabWords = useMemo(() => {
		const words = parseVocab(vocabInput)
		let filtered = words
		if (filterKatakana) {
			filtered = filtered.filter((word) => !isKatakanaWord(word))
		}
		if (filterKanjiOnly) {
			filtered = filtered.filter((word) => isKanjiOnlyWord(word))
		}
		return filtered
	}, [vocabInput, filterKatakana, filterKanjiOnly])
	const fontOptions = useMemo(
		() => [...BUNDLED_FONT_OPTIONS, ...FONT_OPTIONS, ...customFonts],
		[customFonts],
	)
	const totalChars = useMemo(
		() => vocabWords.reduce((sum, word) => sum + [...word].length, 0),
		[vocabWords],
	)
	const pageLayouts = useMemo(
		() =>
			buildPages(vocabWords, rows, cols, fillDirection, startRow, startCol, laneMode),
		[vocabWords, rows, cols, fillDirection, startRow, startCol, laneMode],
	)

	useEffect(() => {
		if (importedWords.length > 0) {
			setVocabInput(importedWords.join('\n'))
		}
	}, [importedWords])

	useEffect(() => {
		let active = true

		async function loadBundledFonts() {
			await Promise.all(
				BUNDLED_FONT_OPTIONS.map(async (font) => {
					try {
						const face = new FontFace(font.family, `url(${font.source})`)
						await face.load()
						if (active) {
							document.fonts.add(face)
						}
					} catch {
						// Keep bundled dropdown options even if preload fails.
					}
				}),
			)
		}

		void loadBundledFonts()

		return () => {
			active = false
		}
	}, [])

	async function handleImportFont(fileList: FileList | null) {
		const file = fileList?.[0]
		if (!file) return

		const ext = file.name.toLowerCase().split('.').pop() ?? ''
		if (!['ttf', 'otf', 'woff', 'woff2'].includes(ext)) {
			alert('Unsupported font file. Use .ttf, .otf, .woff, or .woff2')
			return
		}

		const family = `Imported_${file.name
			.replace(/\.[^.]+$/, '')
			.replace(/[^a-zA-Z0-9_-]/g, '_')}_${Date.now()}`
		const url = URL.createObjectURL(file)

		try {
			const face = new FontFace(family, `url(${url})`)
			await face.load()
			document.fonts.add(face)

			const option: FontOption = {
				label: `Imported: ${file.name}`,
				value: `"${family}", sans-serif`,
				weight: '600',
			}

			setCustomFonts((prev) => [...prev, option])
			setSelectedFont(option.value)
			setSelectedWeight(option.weight)
		} catch {
			alert('Could not load font file.')
		} finally {
			URL.revokeObjectURL(url)
		}
	}

	useEffect(() => {
		let words = 0
		let chars = 0

		pageLayouts.forEach((page, index) => {
			const canvas = previewRefs.current[index]
			if (!canvas) return

			const result = drawPage(canvas, page, {
				cellMm,
				pxPerMm: PREVIEW_PX_PER_MM,
				templateStyle,
				fontFamily: selectedFont,
				fontWeight: selectedWeight,
				orientation,
			})

			words += result.placedWords
			chars += result.placedChars
		})

		setPlacedWords(words)
		setPlacedChars(chars)
	}, [pageLayouts, cellMm, templateStyle, selectedFont, selectedWeight, orientation])

	return (
		<div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(71,85,105,0.22),transparent_32%),linear-gradient(180deg,#1f2937_0%,#111827_52%,#030712_100%)] px-6 py-10 text-slate-100">
			<div className="mx-auto max-w-7xl">
				<div className="mb-8">
					<h1 className="text-3xl font-bold text-slate-100">Put Vocabulary in Grid</h1>
					<p className="mt-2 text-sm text-slate-300">
						Place vocabulary across A4 practice grids, leave copy space with 1/2 or
						1/3 row jumps, and continue onto a new page automatically when full.
					</p>
				</div>

				<div className="grid gap-8 lg:grid-cols-[340px_1fr]">
					<aside className="h-fit rounded-3xl border border-slate-700/80 bg-slate-900/75 p-6 shadow-xl shadow-black/20 ring-1 ring-white/5">
						<h2 className="mb-5 text-lg font-semibold text-slate-100">Settings</h2>

						<label className="block">
							<span className="mb-2 block text-sm font-medium text-slate-300">
								Square size (mm)
							</span>
							<input
								type="number"
								min={1}
								max={50}
								step={0.5}
								value={inputVal}
								onChange={(event) => handleCellChange(event.target.value)}
								className="w-full rounded-xl border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-sky-400"
							/>
							<input
								type="range"
								min={1}
								max={50}
								step={0.5}
								value={cellMm}
								onChange={(event) => handleCellChange(event.target.value)}
								className="mt-3 w-full accent-sky-400"
							/>
						</label>

						<label className="mt-5 block">
							<span className="mb-2 block text-sm font-medium text-slate-300">
								Vocabulary words
							</span>
							<textarea
								rows={8}
								value={vocabInput}
								onChange={(event) => setVocabInput(event.target.value)}
								placeholder="大学 花火 展覧会&#10;or one word per line"
								className="w-full rounded-xl border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-sky-400"
							/>
							<p className="mt-1 text-xs text-slate-400">
								Separate words by space, comma, Japanese comma, or new line.
							</p>
						</label>

						<label className="mt-5 block">
							<span className="mb-2 block text-sm font-medium text-slate-300">Font</span>
							<select
								value={selectedFont}
								onChange={(event) => {
									const selected = fontOptions.find(
										(font) => font.value === event.target.value,
									)
									setSelectedFont(event.target.value)
									if (selected) {
										setSelectedWeight(selected.weight)
									}
								}}
								className="w-full rounded-xl border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-sky-400"
							>
								{fontOptions.map((font) => (
									<option key={font.value} value={font.value}>
										{font.label}
									</option>
								))}
							</select>
							<input
								type="file"
								accept=".ttf,.otf,.woff,.woff2"
								onChange={(event) => handleImportFont(event.target.files)}
								className="mt-3 block w-full text-xs text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-700 file:px-3 file:py-2 file:text-xs file:font-medium file:text-slate-100 hover:file:bg-slate-600"
							/>
						</label>

						<label className="mt-5 block">
							<span className="mb-2 block text-sm font-medium text-slate-300">
								Template style
							</span>
							<select
								value={templateStyle}
								onChange={(event) => setTemplateStyle(event.target.value as TemplateStyle)}
								className="w-full rounded-xl border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-sky-400"
							>
								<option value="classic">Classic Square</option>
								<option value="bold-5">Bold Every 5 Lines</option>
								<option value="cross">Center Cross Marks</option>
							</select>
						</label>

						<div className="mt-5">
							<span className="mb-2 block text-sm font-medium text-slate-300">
								Paper orientation
							</span>
							<div className="grid grid-cols-2 gap-2">
								<button
									type="button"
									onClick={() => setOrientation('portrait')}
									className={`rounded-xl border px-3 py-2 text-sm transition ${
										orientation === 'portrait'
											? 'border-sky-400 bg-sky-500/20 text-sky-300'
											: 'border-slate-600 bg-slate-950 text-slate-200'
									}`}
								>
									Portrait
								</button>
								<button
									type="button"
									onClick={() => setOrientation('landscape')}
									className={`rounded-xl border px-3 py-2 text-sm transition ${
										orientation === 'landscape'
											? 'border-sky-400 bg-sky-500/20 text-sky-300'
											: 'border-slate-600 bg-slate-950 text-slate-200'
									}`}
								>
									Landscape
								</button>
							</div>
						</div>

						<div className="mt-5">
							<span className="mb-2 block text-sm font-medium text-slate-300">
								Word direction
							</span>
							<div className="grid grid-cols-2 gap-2">
								<button
									type="button"
									onClick={() => setFillDirection('horizontal')}
									className={`rounded-xl border px-3 py-2 text-sm transition ${
										fillDirection === 'horizontal'
											? 'border-sky-400 bg-sky-500/20 text-sky-300'
											: 'border-slate-600 bg-slate-950 text-slate-200'
									}`}
								>
									Horizontal
								</button>
								<button
									type="button"
									onClick={() => setFillDirection('vertical')}
									className={`rounded-xl border px-3 py-2 text-sm transition ${
										fillDirection === 'vertical'
											? 'border-sky-400 bg-sky-500/20 text-sky-300'
											: 'border-slate-600 bg-slate-950 text-slate-200'
									}`}
								>
									Vertical
								</button>
							</div>
						</div>

						<div className="mt-5">
							<span className="mb-2 block text-sm font-medium text-slate-300">
								Katakana filter
							</span>
							<div className="grid grid-cols-2 gap-2">
								<button
									type="button"
									onClick={() => setFilterKatakana(false)}
									className={`rounded-xl border px-3 py-2 text-sm transition ${
										!filterKatakana
											? 'border-sky-400 bg-sky-500/20 text-sky-300'
											: 'border-slate-600 bg-slate-950 text-slate-200'
									}`}
								>
									OFF
								</button>
								<button
									type="button"
									onClick={() => setFilterKatakana(true)}
									className={`rounded-xl border px-3 py-2 text-sm transition ${
										filterKatakana
											? 'border-sky-400 bg-sky-500/20 text-sky-300'
											: 'border-slate-600 bg-slate-950 text-slate-200'
									}`}
								>
									ON
								</button>
							</div>
							<p className="mt-1 text-xs text-slate-400">
								When ON, words written only in katakana will be removed before placing
								them into the grid.
							</p>
						</div>

						<div className="mt-5">
							<span className="mb-2 block text-sm font-medium text-slate-300">
								Kanji only filter
							</span>
							<div className="grid grid-cols-2 gap-2">
								<button
									type="button"
									onClick={() => setFilterKanjiOnly(false)}
									className={`rounded-xl border px-3 py-2 text-sm transition ${
										!filterKanjiOnly
											? 'border-sky-400 bg-sky-500/20 text-sky-300'
											: 'border-slate-600 bg-slate-950 text-slate-200'
									}`}
								>
									OFF
								</button>
								<button
									type="button"
									onClick={() => setFilterKanjiOnly(true)}
									className={`rounded-xl border px-3 py-2 text-sm transition ${
										filterKanjiOnly
											? 'border-sky-400 bg-sky-500/20 text-sky-300'
											: 'border-slate-600 bg-slate-950 text-slate-200'
									}`}
								>
									ON
								</button>
							</div>
							<p className="mt-1 text-xs text-slate-400">
								When ON, only words made entirely of kanji will be placed into the
								grid.
							</p>
						</div>

						<div className="mt-5">
							<span className="mb-2 block text-sm font-medium text-slate-300">
								New lane spacing
							</span>
							<div className="grid grid-cols-3 gap-2">
								{([
									['next-line', 'Next line'],
									['half', '1/2 page'],
									['third', '1/3 page'],
								] as const).map(([value, label]) => (
									<button
										key={value}
										type="button"
										onClick={() => setLaneMode(value)}
										className={`rounded-xl border px-3 py-2 text-sm transition ${
											laneMode === value
												? 'border-sky-400 bg-sky-500/20 text-sky-300'
												: 'border-slate-600 bg-slate-950 text-slate-200'
										}`}
									>
										{label}
									</button>
								))}
							</div>
							<p className="mt-1 text-xs text-slate-400">
								When a word no longer fits the remaining cells, start the next word on
								the next line, halfway down the page, or one-third down the page.
							</p>
						</div>

						<div className="mt-5 grid grid-cols-2 gap-3">
							<label>
								<span className="mb-2 block text-sm font-medium text-slate-300">
									Start row
								</span>
								<input
									type="number"
									min={1}
									max={rows}
									value={startRow}
									onChange={(event) =>
										setStartRow(clamp(Number(event.target.value) || 1, 1, rows))
									}
									className="w-full rounded-xl border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-sky-400"
								/>
							</label>
							<label>
								<span className="mb-2 block text-sm font-medium text-slate-300">
									Start col
								</span>
								<input
									type="number"
									min={1}
									max={cols}
									value={startCol}
									onChange={(event) =>
										setStartCol(clamp(Number(event.target.value) || 1, 1, cols))
									}
									className="w-full rounded-xl border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-sky-400"
								/>
							</label>
						</div>

						<div className="mt-6 space-y-1 rounded-2xl border border-slate-700 bg-slate-950/60 px-4 py-3 text-xs text-slate-400">
							<p>
								Page size: A4 ({pageWmm} x {pageHmm} mm)
							</p>
							<p>Grid: {cols}x{rows}</p>
							<p>Words: {vocabWords.length}</p>
							<p>Total chars: {totalChars}</p>
							<p>Filter katakana: {filterKatakana ? 'ON' : 'OFF'}</p>
							<p>Filter kanji only: {filterKanjiOnly ? 'ON' : 'OFF'}</p>
							<p>Pages: {pageLayouts.length}</p>
							<p>
								Placed in preview: {placedWords} words / {placedChars} chars
							</p>
						</div>

						<button
							type="button"
							onClick={() =>
								exportPdf({
									cellMm,
									pxPerMm: PREVIEW_PX_PER_MM,
									templateStyle,
									fontFamily: selectedFont,
									fontWeight: selectedWeight,
									orientation,
									pages: pageLayouts,
								})
							}
							className="mt-6 w-full rounded-xl bg-sky-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-sky-400"
						>
							Export as PDF
						</button>
					</aside>

					<div className="space-y-6">
						<div className="text-xs text-slate-400">
							Preview (scaled) - {cols}x{rows} grid
						</div>
						{pageLayouts.length === 0 ? (
							<div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/50 px-6 py-10 text-center text-sm text-slate-400">
								Add vocabulary words to generate grid pages.
							</div>
						) : (
							pageLayouts.map((_, index) => (
								<div key={`page-${index}`} className="space-y-2">
									<div className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">
										Page {index + 1}
									</div>
									<div
										className="overflow-auto rounded-2xl border border-slate-700 shadow-xl shadow-black/30"
										style={{ maxWidth: '100%', maxHeight: '80vh' }}
									>
										<canvas
											ref={(element) => {
												previewRefs.current[index] = element
											}}
											width={previewW}
											height={previewH}
											style={{ display: 'block', width: previewW, height: previewH }}
										/>
									</div>
								</div>
							))
						)}
					</div>
				</div>
			</div>
		</div>
	)
}
