import { useEffect, useRef, useState } from 'react'

// A4 dimensions in mm
const A4_PORTRAIT_W_MM = 210
const A4_PORTRAIT_H_MM = 297

// How many px per mm on screen (screen preview scale)
const PREVIEW_PX_PER_MM = 2.5

const GRID_COLOR = '#94a3b8'
const BG_COLOR = '#ffffff'
type TemplateStyle = 'classic' | 'bold-5' | 'cross'
type PageOrientation = 'portrait' | 'landscape'

function getPageSizeMm(orientation: PageOrientation) {
	if (orientation === 'landscape') {
		return { pageWmm: A4_PORTRAIT_H_MM, pageHmm: A4_PORTRAIT_W_MM }
	}
	return { pageWmm: A4_PORTRAIT_W_MM, pageHmm: A4_PORTRAIT_H_MM }
}

function drawTemplate(
	canvas: HTMLCanvasElement,
	cellMm: number,
	pxPerMm: number,
	templateStyle: TemplateStyle,
	orientation: PageOrientation,
) {
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
	if (!ctx) return

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
		ctx.lineTo(x, offsetY + rows * cellPx)
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
		ctx.lineTo(offsetX + cols * cellPx, y)
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

}

function exportPdf(cellMm: number, templateStyle: TemplateStyle, orientation: PageOrientation) {
	// Use browser print as PDF: render a full-resolution canvas and print it
	const canvas = document.createElement('canvas')
	const DPI = 150
	const pxPerMm = DPI / 25.4
	const { pageWmm, pageHmm } = getPageSizeMm(orientation)
	drawTemplate(canvas, cellMm, pxPerMm, templateStyle, orientation)

	canvas.toBlob((blob) => {
		if (!blob) return

		const url = URL.createObjectURL(blob)

		// Build a minimal printable HTML page sized to A4
		const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<style>
  @page { size: ${orientation === 'landscape' ? 'A4 landscape' : 'A4 portrait'}; margin: 0; }
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

function getCenteredMarginsMm(cellMm: number, orientation: PageOrientation) {
	const { pageWmm, pageHmm } = getPageSizeMm(orientation)
	const cols = Math.max(1, Math.floor(pageWmm / cellMm))
	const rows = Math.max(1, Math.floor(pageHmm / cellMm))
	const marginX = (pageWmm - cols * cellMm) / 2
	const marginY = (pageHmm - rows * cellMm) / 2
	return { marginX, marginY }
}

export default function TemplateCreate() {
	const [cellMm, setCellMm] = useState(5)
	const [inputVal, setInputVal] = useState('5')
	const [templateStyle, setTemplateStyle] = useState<TemplateStyle>('classic')
	const [orientation, setOrientation] = useState<PageOrientation>('portrait')
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
	const { marginX, marginY } = getCenteredMarginsMm(cellMm, orientation)
	const previewW = pageWmm * PREVIEW_PX_PER_MM
	const previewH = pageHmm * PREVIEW_PX_PER_MM

	useEffect(() => {
		if (!previewRef.current) return
		drawTemplate(previewRef.current, cellMm, PREVIEW_PX_PER_MM, templateStyle, orientation)
	}, [cellMm, templateStyle, orientation])

	return (
		<div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(71,85,105,0.22),transparent_32%),linear-gradient(180deg,#1f2937_0%,#111827_52%,#030712_100%)] px-6 py-10 text-slate-100">
			<div className="mx-auto max-w-7xl">
				<div className="mb-8">
					<h1 className="text-3xl font-bold text-slate-100">Template Create</h1>
					<p className="mt-2 text-sm text-slate-300">
						Generate A4 grid paper with adjustable square size and export it.
					</p>
				</div>

				<div className="grid gap-8 lg:grid-cols-[300px_1fr]">
					{/* Settings panel */}
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
							<div className="mt-1 flex justify-between text-xs text-slate-400">
								<span>1 mm</span>
								<span>50 mm</span>
							</div>
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

						<label className="mt-5 block">
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
						</label>

						<div className="mt-6 rounded-2xl border border-slate-700 bg-slate-950/60 px-4 py-3 text-xs text-slate-400 space-y-1">
							<p>Page size: A4 ({pageWmm} x {pageHmm} mm)</p>
							<p>Orientation: {orientation}</p>
							<p>Auto margin: L/R {marginX.toFixed(2)} mm, T/B {marginY.toFixed(2)} mm</p>
							<p>Grid: {cols}x{rows}</p>
							<p>Square: {cellMm} x {cellMm} mm</p>
						</div>

						<button
							type="button"
							onClick={() => exportPdf(cellMm, templateStyle, orientation)}
							className="mt-6 w-full rounded-xl bg-sky-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-sky-400"
						>
							Export as PDF
						</button>
					</aside>

					{/* A4 preview */}
					<div className="flex flex-col items-center gap-4">
						<p className="text-xs text-slate-400">Preview (scaled) - {cols}x{rows}</p>
						<div
							className="overflow-auto rounded-2xl border border-slate-700 shadow-xl shadow-black/30"
							style={{ maxWidth: '100%', maxHeight: '80vh' }}
						>
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
