import { useEffect, useMemo, useRef, useState } from 'react'

const A4_PORTRAIT_W_MM = 210
const A4_PORTRAIT_H_MM = 297
const PREVIEW_PX_PER_MM = 2.5

const GRID_COLOR = '#94a3b8'
const BG_COLOR = '#ffffff'
const TEXT_COLOR = '#0f172a'

type FillDirection = 'horizontal' | 'vertical'
type TemplateStyle = 'classic' | 'bold-5' | 'cross'
type PageOrientation = 'portrait' | 'landscape'

function getPageSizeMm(orientation: PageOrientation) {
	if (orientation === 'landscape') {
		return { pageWmm: A4_PORTRAIT_H_MM, pageHmm: A4_PORTRAIT_W_MM }
	}
	return { pageWmm: A4_PORTRAIT_W_MM, pageHmm: A4_PORTRAIT_H_MM }
}

type DrawOptions = {
	cellMm: number
	pxPerMm: number
	templateStyle: TemplateStyle
	fontFamily: string
	fontWeight: string
	fillDirection: FillDirection
	startRow: number
	startCol: number
	tokens: string[]
	orientation: PageOrientation
}

type FontOption = {
	label: string
	value: string
	weight: string
}

const FONT_OPTIONS: FontOption[] = [
	{ label: 'Arial', value: 'Arial, sans-serif', weight: '600' },
	{ label: 'Times New Roman', value: '"Times New Roman", serif', weight: '600' },
	{ label: 'Courier New', value: '"Courier New", monospace', weight: '700' },
	{ label: 'Georgia', value: 'Georgia, serif', weight: '600' },
	{ label: 'Trebuchet MS', value: '"Trebuchet MS", sans-serif', weight: '600' },
]

function parseTokens(text: string): string[] {
	return text
		.split(/[\s,、]+/)
		.map((t) => t.trim())
		.filter((t) => t.length > 0)
}

function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, value))
}

function drawTemplate(canvas: HTMLCanvasElement, options: DrawOptions): number {
	const {
		cellMm,
		pxPerMm,
		templateStyle,
		fontFamily,
		fontWeight,
		fillDirection,
		startRow,
		startCol,
		tokens,
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
	if (!ctx) return 0

	ctx.fillStyle = BG_COLOR
	ctx.fillRect(0, 0, w, h)

	for (let c = 0; c <= cols; c += 1) {
		const x = offsetX + c * cellPx
		let lineWidth = 0.5
		if (templateStyle === 'bold-5' && c % 5 === 0) lineWidth = 1.4
		ctx.beginPath()
		ctx.lineWidth = lineWidth
		ctx.strokeStyle = GRID_COLOR
		ctx.moveTo(x, offsetY)
		ctx.lineTo(x, offsetY + gridH)
		ctx.stroke()
	}

	for (let r = 0; r <= rows; r += 1) {
		const y = offsetY + r * cellPx
		let lineWidth = 0.5
		if (templateStyle === 'bold-5' && r % 5 === 0) lineWidth = 1.4
		ctx.beginPath()
		ctx.lineWidth = lineWidth
		ctx.strokeStyle = GRID_COLOR
		ctx.moveTo(offsetX, y)
		ctx.lineTo(offsetX + gridW, y)
		ctx.stroke()
	}

	if (templateStyle === 'cross') {
		ctx.strokeStyle = '#cbd5e1'
		ctx.lineWidth = 0.4
		for (let r = 0; r < rows; r += 1) {
			for (let c = 0; c < cols; c += 1) {
				const cx = offsetX + c * cellPx + cellPx / 2
				const cy = offsetY + r * cellPx + cellPx / 2
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

	ctx.fillStyle = TEXT_COLOR
	ctx.textAlign = 'center'
	ctx.textBaseline = 'middle'
	ctx.font = `${fontWeight} ${Math.max(9, cellPx * 0.58)}px ${fontFamily}`

	let r = clamp(startRow, 1, rows) - 1
	let c = clamp(startCol, 1, cols) - 1
	const originR = r
	const originC = c
	let placed = 0

	for (const token of tokens) {
		if (r < 0 || r >= rows || c < 0 || c >= cols) break

		const x = offsetX + c * cellPx + cellPx / 2
		const y = offsetY + r * cellPx + cellPx / 2
		ctx.fillText(token, x, y)
		placed += 1

		if (fillDirection === 'horizontal') {
			c += 1
			if (c >= cols) {
				c = originC
				r += 1
			}
		} else {
			r += 1
			if (r >= rows) {
				r = originR
				c += 1
			}
		}
	}

	return placed
}

function exportPdf(options: Omit<DrawOptions, 'pxPerMm'>) {
	const canvas = document.createElement('canvas')
	const dpi = 150
	const pxPerMm = dpi / 25.4
	drawTemplate(canvas, { ...options, pxPerMm })

	canvas.toBlob((blob) => {
		if (!blob) return

		const url = URL.createObjectURL(blob)
		const { pageWmm, pageHmm } = getPageSizeMm(options.orientation)
	const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<style>
  @page { size: ${options.orientation === 'landscape' ? 'A4 landscape' : 'A4 portrait'}; margin: 0; }
  body  { margin: 0; padding: 0; }
  img   { display: block; width: ${pageWmm}mm; height: ${pageHmm}mm; }
</style>
</head>
<body><img src="${url}"/></body>
</html>`

		const win = window.open('', '_blank')
		if (!win) {
			alert('Allow pop-ups to export as PDF.')
			URL.revokeObjectURL(url)
			return
		}

		win.document.write(html)
		win.document.close()
		win.onload = () => {
			win.print()
			URL.revokeObjectURL(url)
		}
	}, 'image/png')
}

export default function PutCharacterInGrid() {
	const [cellMm, setCellMm] = useState(5)
	const [inputVal, setInputVal] = useState('5')
	const [charInput, setCharInput] = useState('A B C D E F')
	const [customFonts, setCustomFonts] = useState<FontOption[]>([])
	const [selectedFont, setSelectedFont] = useState(FONT_OPTIONS[0].value)
	const [selectedWeight, setSelectedWeight] = useState(FONT_OPTIONS[0].weight)
	const [templateStyle, setTemplateStyle] = useState<TemplateStyle>('classic')
	const [orientation, setOrientation] = useState<PageOrientation>('portrait')
	const [fillDirection, setFillDirection] = useState<FillDirection>('horizontal')
	const [startRow, setStartRow] = useState(1)
	const [startCol, setStartCol] = useState(1)
	const [placedCount, setPlacedCount] = useState(0)
	const previewRef = useRef<HTMLCanvasElement>(null)

	function handleCellChange(raw: string) {
		setInputVal(raw)
		const n = parseFloat(raw)
		if (isNaN(n) || n < 1 || n > 50) return
		setCellMm(n)
	}

	const { pageWmm, pageHmm } = getPageSizeMm(orientation)
	const cols = Math.max(1, Math.floor(pageWmm / cellMm))
	const rows = Math.max(1, Math.floor(pageHmm / cellMm))
	const previewW = pageWmm * PREVIEW_PX_PER_MM
	const previewH = pageHmm * PREVIEW_PX_PER_MM
	const tokens = useMemo(() => parseTokens(charInput), [charInput])
	const fontOptions = useMemo(() => [...FONT_OPTIONS, ...customFonts], [customFonts])

	async function handleImportFont(fileList: FileList | null) {
		const file = fileList?.[0]
		if (!file) return

		const ext = file.name.toLowerCase().split('.').pop() ?? ''
		if (!['ttf', 'otf', 'woff', 'woff2'].includes(ext)) {
			alert('Unsupported font file. Use .ttf, .otf, .woff, or .woff2')
			return
		}

		const family = `Imported_${file.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_')}_${Date.now()}`
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
		if (!previewRef.current) return
		const placed = drawTemplate(previewRef.current, {
			cellMm,
			pxPerMm: PREVIEW_PX_PER_MM,
			templateStyle,
			fontFamily: selectedFont,
			fontWeight: selectedWeight,
			fillDirection,
			startRow,
			startCol,
			tokens,
			orientation,
		})
		setPlacedCount(placed)
	}, [cellMm, templateStyle, selectedFont, selectedWeight, fillDirection, startRow, startCol, tokens, orientation])

	return (
		<div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(71,85,105,0.22),transparent_32%),linear-gradient(180deg,#1f2937_0%,#111827_52%,#030712_100%)] px-6 py-10 text-slate-100">
			<div className="mx-auto max-w-7xl">
				<div className="mb-8">
					<h1 className="text-3xl font-bold text-slate-100">Put Character in Grid</h1>
					<p className="mt-2 text-sm text-slate-300">
						Place text tokens into template squares with horizontal or vertical flow.
					</p>
				</div>

				<div className="grid gap-8 lg:grid-cols-[340px_1fr]">
					<aside className="h-fit rounded-3xl border border-slate-700/80 bg-slate-900/75 p-6 shadow-xl shadow-black/20 ring-1 ring-white/5">
						<h2 className="mb-5 text-lg font-semibold text-slate-100">Settings</h2>

						<label className="block">
							<span className="mb-2 block text-sm font-medium text-slate-300">Square size (mm)</span>
							<input
								type="number"
								min={1}
								max={50}
								step={0.5}
								value={inputVal}
								onChange={(e) => handleCellChange(e.target.value)}
								className="w-full rounded-xl border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-sky-400"
							/>
							<input
								type="range"
								min={1}
								max={50}
								step={0.5}
								value={cellMm}
								onChange={(e) => handleCellChange(e.target.value)}
								className="mt-3 w-full accent-sky-400"
							/>
						</label>

						<label className="mt-5 block">
							<span className="mb-2 block text-sm font-medium text-slate-300">Characters / tokens</span>
							<textarea
								rows={4}
								value={charInput}
								onChange={(e) => setCharInput(e.target.value)}
								placeholder="A B C D or A,B,C or one token per line"
								className="w-full rounded-xl border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-sky-400"
							/>
							<p className="mt-1 text-xs text-slate-400">Separate by space, comma, or new line.</p>
						</label>

						<label className="mt-5 block">
							<span className="mb-2 block text-sm font-medium text-slate-300">Font</span>
							<select
								value={selectedFont}
								onChange={(e) => {
									const font = fontOptions.find((f) => f.value === e.target.value)
									setSelectedFont(e.target.value)
									if (font) setSelectedWeight(font.weight)
								}}
								className="w-full rounded-xl border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-sky-400"
							>
								{fontOptions.map((font) => (
									<option key={font.value} value={font.value}>{font.label}</option>
								))}
							</select>
							<input
								type="file"
								accept=".ttf,.otf,.woff,.woff2"
								onChange={(e) => handleImportFont(e.target.files)}
								className="mt-3 block w-full text-xs text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-700 file:px-3 file:py-2 file:text-xs file:font-medium file:text-slate-100 hover:file:bg-slate-600"
							/>
							<p className="mt-1 text-xs text-slate-400">Import your own font file or pick from dropdown.</p>
						</label>

						<label className="mt-5 block">
							<span className="mb-2 block text-sm font-medium text-slate-300">Template style</span>
							<select
								value={templateStyle}
								onChange={(e) => setTemplateStyle(e.target.value as TemplateStyle)}
								className="w-full rounded-xl border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-sky-400"
							>
								<option value="classic">Classic Square</option>
								<option value="bold-5">Bold Every 5 Lines</option>
								<option value="cross">Center Cross Marks</option>
							</select>
						</label>

						<div className="mt-5">
							<span className="mb-2 block text-sm font-medium text-slate-300">Paper orientation</span>
							<div className="grid grid-cols-2 gap-2">
								<button
									type="button"
									onClick={() => setOrientation('portrait')}
									className={`rounded-xl border px-3 py-2 text-sm transition ${orientation === 'portrait' ? 'border-sky-400 bg-sky-500/20 text-sky-300' : 'border-slate-600 bg-slate-950 text-slate-200'}`}
								>
									Portrait
								</button>
								<button
									type="button"
									onClick={() => setOrientation('landscape')}
									className={`rounded-xl border px-3 py-2 text-sm transition ${orientation === 'landscape' ? 'border-sky-400 bg-sky-500/20 text-sky-300' : 'border-slate-600 bg-slate-950 text-slate-200'}`}
								>
									Landscape
								</button>
							</div>
						</div>

						<div className="mt-5">
							<span className="mb-2 block text-sm font-medium text-slate-300">Fill direction</span>
							<div className="grid grid-cols-2 gap-2">
								<button
									type="button"
									onClick={() => setFillDirection('horizontal')}
									className={`rounded-xl border px-3 py-2 text-sm transition ${fillDirection === 'horizontal' ? 'border-sky-400 bg-sky-500/20 text-sky-300' : 'border-slate-600 bg-slate-950 text-slate-200'}`}
								>
									Horizontal
								</button>
								<button
									type="button"
									onClick={() => setFillDirection('vertical')}
									className={`rounded-xl border px-3 py-2 text-sm transition ${fillDirection === 'vertical' ? 'border-sky-400 bg-sky-500/20 text-sky-300' : 'border-slate-600 bg-slate-950 text-slate-200'}`}
								>
									Vertical
								</button>
							</div>
						</div>

						<div className="mt-5 grid grid-cols-2 gap-3">
							<label>
								<span className="mb-2 block text-sm font-medium text-slate-300">Start row</span>
								<input
									type="number"
									min={1}
									max={rows}
									value={startRow}
									onChange={(e) => setStartRow(clamp(Number(e.target.value) || 1, 1, rows))}
									className="w-full rounded-xl border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-sky-400"
								/>
							</label>
							<label>
								<span className="mb-2 block text-sm font-medium text-slate-300">Start col</span>
								<input
									type="number"
									min={1}
									max={cols}
									value={startCol}
									onChange={(e) => setStartCol(clamp(Number(e.target.value) || 1, 1, cols))}
									className="w-full rounded-xl border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-sky-400"
								/>
							</label>
						</div>

						<div className="mt-6 rounded-2xl border border-slate-700 bg-slate-950/60 px-4 py-3 text-xs text-slate-400 space-y-1">
							<p>Page size: A4 ({pageWmm} x {pageHmm} mm)</p>
							<p>Orientation: {orientation}</p>
							<p>Grid: {cols}x{rows}</p>
							<p>Square: {cellMm} x {cellMm} mm</p>
							<p>Tokens: {tokens.length}</p>
							<p>Placed in preview: {placedCount}</p>
						</div>

						<button
							type="button"
							onClick={() =>
								exportPdf({
									cellMm,
									templateStyle,
									fontFamily: selectedFont,
									fontWeight: selectedWeight,
									fillDirection,
									startRow,
									startCol,
									tokens,
									orientation,
								})
							}
							className="mt-6 w-full rounded-xl bg-sky-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-sky-400"
						>
							Export as PDF
						</button>
					</aside>

					<div className="flex flex-col items-center gap-4">
						<p className="text-xs text-slate-400">Preview (scaled) - {cols}x{rows}</p>
						<div className="overflow-auto rounded-2xl border border-slate-700 shadow-xl shadow-black/30" style={{ maxWidth: '100%', maxHeight: '80vh' }}>
							<canvas
								ref={previewRef}
								width={previewW}
								height={previewH}
								style={{ display: 'block', width: previewW, height: previewH }}
							/>
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}
