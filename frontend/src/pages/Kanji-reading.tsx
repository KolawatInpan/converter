import { Eraser, ExternalLink, PenTool, Search, Undo2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import {
	kanjiReadingApi,
	type KanjiCandidate,
	type KanjiReadingResponse,
} from '../api_caller/kanji_reading'
import {
	lookupDictionaryApi,
	type DictionaryEntry,
	type DictionarySegment,
} from '../api_caller/dictionary'

type Point = {
	x: number
	y: number
}

type Stroke = {
	points: Point[]
	width: number
}

function RubyText({ segments }: { segments?: DictionarySegment[] }) {
	if (!segments || segments.length === 0) {
		return null
	}

	return (
		<div className="flex flex-wrap items-end gap-x-2 gap-y-4 text-4xl font-semibold tracking-wide text-amber-50">
			{segments.map((segment, index) => (
				<ruby key={`${segment.text}-${index}`} className="ruby-word">
					{segment.text}
					{segment.furigana ? (
						<rt className="ruby-reading text-sm font-medium text-amber-200/80">
							{segment.furigana}
						</rt>
					) : null}
				</ruby>
			))}
		</div>
	)
}

function DictionaryCard({ entry }: { entry: DictionaryEntry }) {
	return (
		<div className="rounded-3xl border border-amber-400/20 bg-stone-950/50 p-5">
			<RubyText segments={entry.segments} />
			<div className="mt-4 text-sm text-stone-200">
				<span className="text-stone-400">Reading:</span> {entry.furigana || '-'}
			</div>
			{entry.pos.length > 0 ? (
				<div className="mt-4 flex flex-wrap gap-2">
					{entry.pos.map((pos) => (
						<span
							key={pos}
							className="rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs text-amber-100"
						>
							{pos}
						</span>
					))}
				</div>
			) : null}
			{entry.meanings.length > 0 ? (
				<div className="mt-5 space-y-2 text-sm leading-relaxed text-stone-100">
					{entry.meanings.slice(0, 4).map((meaning, index) => (
						<div key={`${entry.word}-${index}`} className="rounded-2xl bg-stone-900/80 px-4 py-3">
							{meaning}
						</div>
					))}
				</div>
			) : null}
		</div>
	)
}

function getCanvasContext(canvas: HTMLCanvasElement) {
	const context = canvas.getContext('2d')
	if (!context) {
		throw new Error('Unable to prepare the handwriting canvas.')
	}

	context.lineCap = 'round'
	context.lineJoin = 'round'
	return context
}

function drawCanvas(
	canvas: HTMLCanvasElement,
	strokes: Stroke[],
	activeStroke: Stroke | null,
	background = true,
) {
	const context = getCanvasContext(canvas)
	context.clearRect(0, 0, canvas.width, canvas.height)

	if (background) {
		context.fillStyle = '#fffdf8'
		context.fillRect(0, 0, canvas.width, canvas.height)
		context.strokeStyle = 'rgba(120, 113, 108, 0.18)'
		context.lineWidth = 2
		context.strokeRect(20, 20, canvas.width - 40, canvas.height - 40)

		context.beginPath()
		context.moveTo(canvas.width / 2, 20)
		context.lineTo(canvas.width / 2, canvas.height - 20)
		context.moveTo(20, canvas.height / 2)
		context.lineTo(canvas.width - 20, canvas.height / 2)
		context.stroke()
	}

	const allStrokes = activeStroke ? [...strokes, activeStroke] : strokes

	for (const stroke of allStrokes) {
		if (stroke.points.length === 0) {
			continue
		}

		context.strokeStyle = '#1c1917'
		context.lineWidth = stroke.width
		context.beginPath()
		context.moveTo(stroke.points[0].x, stroke.points[0].y)

		for (const point of stroke.points.slice(1)) {
			context.lineTo(point.x, point.y)
		}

		if (stroke.points.length === 1) {
			context.lineTo(stroke.points[0].x + 0.01, stroke.points[0].y + 0.01)
		}

		context.stroke()
	}
}

function useCanvasSize() {
	return useMemo(() => ({ width: 520, height: 520 }), [])
}

export default function KanjiReadingPage() {
	const canvasRef = useRef<HTMLCanvasElement | null>(null)
	const wrapperRef = useRef<HTMLDivElement | null>(null)
	const activeStrokeRef = useRef<Stroke | null>(null)

	const canvasSize = useCanvasSize()
	const [strokes, setStrokes] = useState<Stroke[]>([])
	const [activeStroke, setActiveStroke] = useState<Stroke | null>(null)
	const [brushSize, setBrushSize] = useState(22)
	const [isWriting, setIsWriting] = useState(false)
	const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null)
	const [isReading, setIsReading] = useState(false)
	const [readingResult, setReadingResult] = useState<KanjiReadingResponse | null>(null)
	const [selectedCandidate, setSelectedCandidate] = useState<KanjiCandidate | null>(null)
	const [dictionaryResults, setDictionaryResults] = useState<DictionaryEntry[]>([])
	const [isLookingUp, setIsLookingUp] = useState(false)
	const [statusMessage, setStatusMessage] = useState(
		'Write one kanji in the board, then search for close candidates.',
	)
	const [errorMessage, setErrorMessage] = useState<string | null>(null)

	useEffect(() => {
		const canvas = canvasRef.current
		if (!canvas) {
			return
		}

		const dpr = window.devicePixelRatio || 1
		canvas.width = canvasSize.width * dpr
		canvas.height = canvasSize.height * dpr
		canvas.style.width = `${canvasSize.width}px`
		canvas.style.height = `${canvasSize.height}px`

		const context = getCanvasContext(canvas)
		context.scale(dpr, dpr)
		drawCanvas(canvas, [], null)
	}, [canvasSize])

	useEffect(() => {
		const canvas = canvasRef.current
		if (!canvas) {
			return
		}

		drawCanvas(canvas, strokes, activeStroke)
	}, [strokes, activeStroke])

	async function loadDictionaryPreview(character: string) {
		setIsLookingUp(true)
		try {
			const result = await lookupDictionaryApi(character)
			setDictionaryResults(result.results)
		} catch (error) {
			setDictionaryResults([])
			setErrorMessage(error instanceof Error ? error.message : 'Unable to load dictionary preview.')
		} finally {
			setIsLookingUp(false)
		}
	}

	function getPoint(event: React.PointerEvent<HTMLCanvasElement>): Point | null {
		const canvas = canvasRef.current
		if (!canvas) {
			return null
		}

		const rect = canvas.getBoundingClientRect()
		return {
			x: ((event.clientX - rect.left) / rect.width) * canvasSize.width,
			y: ((event.clientY - rect.top) / rect.height) * canvasSize.height,
		}
	}

	function handlePointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
		const point = getPoint(event)
		if (!point) {
			return
		}

		event.preventDefault()
		const nextStroke: Stroke = {
			points: [point],
			width: brushSize,
		}

		activeStrokeRef.current = nextStroke
		setActiveStroke(nextStroke)
		setIsWriting(true)
		canvasRef.current?.setPointerCapture(event.pointerId)
	}

	function handlePointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
		if (!isWriting || !activeStrokeRef.current) {
			return
		}

		const point = getPoint(event)
		if (!point) {
			return
		}

		const nextStroke: Stroke = {
			...activeStrokeRef.current,
			points: [...activeStrokeRef.current.points, point],
		}
		activeStrokeRef.current = nextStroke
		setActiveStroke(nextStroke)
	}

	function finishStroke(pointerId: number) {
		if (!isWriting) {
			return
		}

		const latestStroke = activeStrokeRef.current
		activeStrokeRef.current = null
		setIsWriting(false)
		canvasRef.current?.releasePointerCapture(pointerId)

		if (latestStroke && latestStroke.points.length > 0) {
			setStrokes((current) => [...current, latestStroke])
			setActiveStroke(null)
			setStatusMessage('Stroke saved. Add more strokes or search candidates now.')
			setErrorMessage(null)
			return
		}

		setActiveStroke(null)
	}

	function handlePointerUp(event: React.PointerEvent<HTMLCanvasElement>) {
		finishStroke(event.pointerId)
	}

	function handlePointerLeave(event: React.PointerEvent<HTMLCanvasElement>) {
		finishStroke(event.pointerId)
	}

	function handleClear() {
		setStrokes([])
		setActiveStroke(null)
		setPreviewDataUrl(null)
		setReadingResult(null)
		setSelectedCandidate(null)
		setDictionaryResults([])
		setErrorMessage(null)
		setStatusMessage('Board cleared. Write a new kanji to search again.')
	}

	function handleUndo() {
		setStrokes((current) => current.slice(0, -1))
		setPreviewDataUrl(null)
		setReadingResult(null)
		setSelectedCandidate(null)
		setDictionaryResults([])
		setErrorMessage(null)
		setStatusMessage('Removed the latest stroke.')
	}

	async function handleRecognize() {
		const canvas = canvasRef.current
		if (!canvas || strokes.length === 0) {
			setErrorMessage('Write at least one stroke before searching for kanji candidates.')
			return
		}

		try {
			setIsReading(true)
			setErrorMessage(null)
			setStatusMessage('Searching for close kanji candidates...')

			const previewUrl = canvas.toDataURL('image/png')
			setPreviewDataUrl(previewUrl)

			const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
			if (!blob) {
				throw new Error('Unable to export the handwriting board as an image.')
			}

			const file = new File([blob], `kanji-handwriting-${Date.now()}.png`, { type: 'image/png' })
			const result = await kanjiReadingApi(file)
			setReadingResult(result)

			const firstCandidate = result.candidates[0] ?? null
			setSelectedCandidate(firstCandidate)

			if (firstCandidate) {
				await loadDictionaryPreview(firstCandidate.character)
				setStatusMessage(
					`Found ${result.candidate_count} candidate${result.candidate_count === 1 ? '' : 's'}.`,
				)
			} else {
				setDictionaryResults([])
				setStatusMessage('No kanji candidates found. Try writing larger and more centered.')
			}
		} catch (error) {
			setReadingResult(null)
			setSelectedCandidate(null)
			setDictionaryResults([])
			setErrorMessage(error instanceof Error ? error.message : 'Kanji reading failed.')
		} finally {
			setIsReading(false)
		}
	}

	async function handleCandidateSelect(candidate: KanjiCandidate) {
		setSelectedCandidate(candidate)
		setErrorMessage(null)
		setStatusMessage(`Selected ${candidate.character}. Loading dictionary preview...`)
		await loadDictionaryPreview(candidate.character)
		setStatusMessage(`Selected ${candidate.character}.`)
	}

	return (
		<main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(245,158,11,0.14),transparent_28%),linear-gradient(180deg,#1c1917_0%,#111827_46%,#020617_100%)] px-6 py-10 text-stone-100">
			<div className="mx-auto max-w-7xl">
				<header className="max-w-3xl">
					<div className="inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-400/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.24em] text-amber-200">
						<Search className="h-3.5 w-3.5" />
						Kanji Reading
					</div>
					<h1 className="mt-5 text-4xl font-bold tracking-tight text-stone-50">Write one kanji, then pick the closest match</h1>
					<p className="mt-4 text-base leading-8 text-stone-300">
						Draw a single kanji on the board. The app will suggest nearby candidates, and once you choose one it will open that character in the dictionary flow.
					</p>
				</header>

				<div className="mt-10 grid gap-8 xl:grid-cols-[1.05fr_0.95fr]">
					<section className="rounded-[2rem] border border-stone-700/70 bg-stone-900/65 p-6 shadow-2xl shadow-black/20 ring-1 ring-white/5">
						<div className="flex flex-wrap items-start justify-between gap-4">
							<div>
								<h2 className="text-xl font-semibold text-stone-50">Writing board</h2>
								<p className="mt-2 text-sm text-stone-400">
									Best for one large kanji in the middle of the board.
								</p>
							</div>
							<div className="rounded-2xl border border-stone-700 bg-stone-950/70 px-4 py-3 text-sm text-stone-300">
								<div className="text-xs uppercase tracking-[0.2em] text-stone-500">Brush Size</div>
								<input
									type="range"
									min={10}
									max={34}
									step={2}
									value={brushSize}
									onChange={(event) => setBrushSize(Number(event.target.value))}
									className="mt-3 w-44 accent-amber-400"
								/>
								<div className="mt-2 text-right text-xs text-amber-200">{brushSize}px</div>
							</div>
						</div>

						<div ref={wrapperRef} className="mt-6 overflow-hidden rounded-[2rem] border border-stone-700 bg-[#fffdf8] p-4">
							<canvas
								ref={canvasRef}
								onPointerDown={handlePointerDown}
								onPointerMove={handlePointerMove}
								onPointerUp={handlePointerUp}
								onPointerLeave={handlePointerLeave}
								className="mx-auto block max-w-full cursor-crosshair touch-none rounded-[1.5rem] bg-[#fffdf8] shadow-[inset_0_0_0_1px_rgba(41,37,36,0.08)]"
							/>
						</div>

						<div className="mt-5 flex flex-wrap gap-3">
							<button
								type="button"
								onClick={() => void handleRecognize()}
								disabled={strokes.length === 0 || isReading}
								className="inline-flex items-center gap-2 rounded-2xl bg-amber-400 px-5 py-3 text-sm font-semibold text-stone-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
							>
								<Search className="h-4 w-4" />
								{isReading ? 'Searching...' : 'Find Candidates'}
							</button>
							<button
								type="button"
								onClick={handleUndo}
								disabled={strokes.length === 0}
								className="inline-flex items-center gap-2 rounded-2xl border border-stone-600 px-4 py-3 text-sm font-medium text-stone-200 transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-50"
							>
								<Undo2 className="h-4 w-4" />
								Undo Stroke
							</button>
							<button
								type="button"
								onClick={handleClear}
								disabled={strokes.length === 0 && !readingResult}
								className="inline-flex items-center gap-2 rounded-2xl border border-stone-600 px-4 py-3 text-sm font-medium text-stone-200 transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-50"
							>
								<Eraser className="h-4 w-4" />
								Clear Board
							</button>
						</div>

						<div className="mt-5 grid gap-4 lg:grid-cols-[0.62fr_0.38fr]">
							<div className="rounded-3xl border border-amber-400/15 bg-amber-500/8 px-4 py-4 text-sm text-amber-50">
								<div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-amber-200/80">
									<PenTool className="h-4 w-4" />
									Tips
								</div>
								<ul className="mt-3 space-y-2 leading-6 text-amber-50/90">
									<li>Write one character only.</li>
									<li>Keep it centered and leave some margin.</li>
									<li>Use thicker strokes if the candidate list is weak.</li>
								</ul>
							</div>

							<div className="rounded-3xl border border-stone-700 bg-stone-950/70 p-4">
								<div className="text-xs uppercase tracking-[0.2em] text-stone-500">Snapshot</div>
								<div className="mt-3 flex aspect-square items-center justify-center overflow-hidden rounded-[1.5rem] border border-stone-700 bg-stone-900/70">
									{previewDataUrl ? (
										<img src={previewDataUrl} alt="Handwriting preview" className="h-full w-full object-contain" />
									) : (
										<div className="px-6 text-center text-sm text-stone-500">Search once to keep the latest handwriting preview here.</div>
									)}
								</div>
							</div>
						</div>

						{statusMessage ? (
							<div className="mt-5 rounded-2xl border border-amber-400/15 bg-amber-400/10 px-4 py-4 text-sm text-amber-50">
								{statusMessage}
							</div>
						) : null}

						{errorMessage ? (
							<div className="mt-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-4 text-sm text-rose-100">
								{errorMessage}
							</div>
						) : null}
					</section>

					<section className="space-y-6">
						<div className="rounded-[2rem] border border-stone-700/70 bg-stone-900/65 p-6 shadow-2xl shadow-black/20 ring-1 ring-white/5">
							<div className="flex items-center justify-between gap-3">
								<div>
									<h2 className="text-xl font-semibold text-stone-50">Candidates</h2>
									<p className="mt-2 text-sm text-stone-400">Choose the kanji that looks closest to what you wrote.</p>
								</div>
								<span className="rounded-full border border-stone-700 bg-stone-950/70 px-3 py-1 text-xs text-stone-300">
									{readingResult?.candidate_count ?? 0} items
								</span>
							</div>

							<div className="mt-5 space-y-3">
								{readingResult?.candidates.length ? (
									readingResult.candidates.map((candidate, index) => {
										const isActive = candidate.character === selectedCandidate?.character

										return (
											<button
												key={`${candidate.character}-${index}`}
												type="button"
												onClick={() => void handleCandidateSelect(candidate)}
												className={`w-full rounded-3xl border p-4 text-left transition ${
													isActive
														? 'border-amber-400 bg-amber-500/12'
														: 'border-stone-700 bg-stone-950/70 hover:border-stone-500'
												}`}
											>
												<div className="flex items-start justify-between gap-4">
													<div className="min-w-0">
														<div className="text-4xl font-semibold text-stone-50">{candidate.character}</div>
														<div className="mt-2 text-sm text-amber-200">
															{candidate.dictionary.reading || 'No reading preview yet'}
														</div>
														<div className="mt-3 text-sm leading-relaxed text-stone-300">
															{candidate.dictionary.meanings.length > 0
																? candidate.dictionary.meanings.join(', ')
																: 'No quick meaning preview from dictionary.'}
														</div>
													</div>

													<div className="space-y-2 text-right text-xs text-stone-400">
														<div>#{index + 1}</div>
														<div>{Math.round(candidate.confidence * 100)}%</div>
														<div>{candidate.hits} hits</div>
													</div>
												</div>
											</button>
										)
									})
								) : (
									<div className="rounded-3xl border border-dashed border-stone-700 bg-stone-950/60 px-5 py-8 text-sm text-stone-400">
										Write a kanji and run candidate search to see suggestions here.
									</div>
								)}
							</div>
						</div>

						<div className="rounded-[2rem] border border-stone-700/70 bg-stone-900/65 p-6 shadow-2xl shadow-black/20 ring-1 ring-white/5">
							<div className="flex flex-wrap items-center justify-between gap-4">
								<div>
									<h2 className="text-xl font-semibold text-stone-50">Dictionary Preview</h2>
									<p className="mt-2 text-sm text-stone-400">
										After selecting a candidate, the character is looked up in the dictionary automatically.
									</p>
								</div>

								{selectedCandidate ? (
									<Link
										to={`/dictionary?query=${encodeURIComponent(selectedCandidate.character)}`}
										className="inline-flex items-center gap-2 rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm font-semibold text-amber-100 transition hover:bg-amber-500/20"
									>
										<ExternalLink className="h-4 w-4" />
										Open Dictionary
									</Link>
								) : null}
							</div>

							{selectedCandidate ? (
								<div className="mt-5 rounded-3xl border border-stone-700 bg-stone-950/70 p-5">
									<div className="text-xs uppercase tracking-[0.2em] text-stone-500">Selected Kanji</div>
									<div className="mt-3 flex items-center gap-4">
										<div className="rounded-[1.5rem] border border-amber-400/20 bg-amber-500/10 px-5 py-4 text-5xl font-semibold text-amber-50">
											{selectedCandidate.character}
										</div>
										<div className="text-sm text-stone-300">
											<div>Confidence: {Math.round(selectedCandidate.confidence * 100)}%</div>
											<div className="mt-1">Recognition hits: {selectedCandidate.hits}</div>
										</div>
									</div>
								</div>
							) : null}

							{isLookingUp ? (
								<div className="mt-5 rounded-2xl border border-amber-400/15 bg-amber-400/10 px-4 py-4 text-sm text-amber-50">
									Loading dictionary preview...
								</div>
							) : null}

							{!isLookingUp && dictionaryResults.length > 0 ? (
								<div className="mt-5 space-y-4">
									{dictionaryResults.slice(0, 2).map((entry, index) => (
										<DictionaryCard key={`${entry.word}-${index}`} entry={entry} />
									))}
								</div>
							) : null}

							{selectedCandidate && !isLookingUp && dictionaryResults.length === 0 ? (
								<div className="mt-5 rounded-2xl border border-dashed border-stone-700 bg-stone-950/60 px-4 py-6 text-sm text-stone-400">
									No dictionary preview found for this candidate yet. You can still open the full dictionary search.
								</div>
							) : null}

							{!selectedCandidate ? (
								<div className="mt-5 rounded-2xl border border-dashed border-stone-700 bg-stone-950/60 px-4 py-6 text-sm text-stone-400">
									Select a candidate first to load readings and meanings.
								</div>
							) : null}
						</div>
					</section>
				</div>
			</div>
		</main>
	)
}
