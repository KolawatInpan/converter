import { useEffect, useRef, useState } from 'react'

import { extractWordsApi, type WordEntry } from '../api_caller/extract_word'

const DEFAULT_TEXT = '今年は去年より寒いですけど、来年はもっと暖かくなるでしょう。'
const REQUEST_DELAY_MS = 350

function renderHighlighted(text: string, surfaces: string[]) {
	if (surfaces.length === 0) return [<span key="all">{text}</span>]
	const pattern = new RegExp(
		`(${surfaces.map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`,
		'g',
	)
	const parts = text.split(pattern)
	const surfaceSet = new Set(surfaces)
	return parts.map((part, i) =>
		surfaceSet.has(part) ? (
			<mark key={i} className="rounded bg-amber-400/75 px-0.5 text-slate-900 not-italic">
				{part}
			</mark>
		) : (
			<span key={i}>{part}</span>
		),
	)
}

export default function VocabExtract() {
	const [input, setInput] = useState(DEFAULT_TEXT)
	const [results, setResults] = useState<WordEntry[]>([])
	const [isLoading, setIsLoading] = useState(false)
	const [errorMessage, setErrorMessage] = useState<string | null>(null)
	const [hoveredWord, setHoveredWord] = useState<WordEntry | null>(null)
	const requestIdRef = useRef(0)

	useEffect(() => {
		const trimmedInput = input.trim()

		if (!trimmedInput) {
			setResults([])
			setIsLoading(false)
			setErrorMessage(null)
			return
		}

		const timeoutId = window.setTimeout(async () => {
			const requestId = requestIdRef.current + 1
			requestIdRef.current = requestId
			setIsLoading(true)
			setErrorMessage(null)

			try {
				const extractedWords = await extractWordsApi(trimmedInput)
				if (requestIdRef.current !== requestId) {
					return
				}

				setResults(extractedWords)
			} catch (error) {
				if (requestIdRef.current !== requestId) {
					return
				}

				setResults([])
				setErrorMessage(
					error instanceof Error ? error.message : 'Unable to extract vocabulary right now.',
				)
			} finally {
				if (requestIdRef.current === requestId) {
					setIsLoading(false)
				}
			}
		}, REQUEST_DELAY_MS)

		return () => {
			window.clearTimeout(timeoutId)
		}
	}, [input])

	return (
		<div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.12),transparent_34%),linear-gradient(180deg,#0f172a_0%,#111827_50%,#020617_100%)] px-6 py-10 text-slate-100">
			<div className="mx-auto max-w-6xl">
				<div className="mb-8">
					<h1 className="text-3xl font-bold text-slate-100">Vocab Extract</h1>
					<p className="mt-2 text-sm text-slate-300">
						Type a Japanese paragraph and the page will call the extractor API to build the vocabulary list, or search for UMA skills.
					</p>
				</div>

				<div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
					{/* ── Left: paragraph input ── */}
					<section className="rounded-3xl border border-slate-700/80 bg-slate-900/75 p-6 shadow-xl shadow-black/20 ring-1 ring-white/5">
						<label className="block">
							<span className="mb-3 block text-sm font-medium text-slate-300">Paragraph input</span>
							<textarea
								rows={12}
								value={input}
								onChange={(e) => setInput(e.target.value)}
								placeholder="鳳凰という特別な鳥の話です。"
								className="w-full rounded-2xl border border-slate-600 bg-slate-950 px-4 py-3 text-base text-slate-100 outline-none transition focus:border-sky-400"
							/>
						</label>
						<p className="mt-3 text-xs text-slate-400">
							Requests are sent automatically after you pause typing for a moment.
						</p>

						{hoveredWord !== null ? (
							<div className="mt-4 overflow-hidden rounded-2xl border border-amber-500/40 bg-slate-950/60">
								<div className="border-b border-amber-500/20 px-3 py-2 text-xs font-medium text-amber-400/80">
									Highlights for &ldquo;{hoveredWord.base}&rdquo;
								</div>
								<div className="whitespace-pre-wrap wrap-break-word px-4 py-3 text-base leading-relaxed text-slate-100">
									{renderHighlighted(input, hoveredWord.surfaces)}
								</div>
							</div>
						) : null}
					</section>

					{/* ── Right: extracted vocabulary ── */}
					<section className="rounded-3xl border border-slate-700/80 bg-slate-900/75 p-6 shadow-xl shadow-black/20 ring-1 ring-white/5">
						<div className="flex items-center justify-between gap-3">
							<h2 className="text-lg font-semibold text-slate-100">Extracted vocabulary</h2>
							<div className="flex items-center gap-3">
								{isLoading ? <span className="text-xs text-sky-300">Loading...</span> : null}
								<span className="rounded-full border border-slate-700 bg-slate-950/70 px-3 py-1 text-xs text-slate-300">
									{results.length} items
								</span>
							</div>
						</div>

						{errorMessage ? (
							<div className="mt-5 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-4 text-sm text-rose-100">
								{errorMessage}
							</div>
						) : null}

						{!errorMessage && results.length > 0 ? (
							<div className="mt-5 flex flex-wrap gap-3">
								{results.map((word) => (
									<div
										key={word.base}
										onMouseEnter={() => setHoveredWord(word)}
										onMouseLeave={() => setHoveredWord(null)}
										className="cursor-pointer rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-2 text-sm font-medium text-sky-100 transition-colors hover:border-amber-500/50 hover:bg-amber-500/10 hover:text-amber-100"
									>
										<div>{word.base}</div>
										{word.surfaces.some((surface) => surface !== word.base) ? (
											<div className="mt-1 text-xs font-normal text-sky-200/75">
												{word.surfaces.join(', ')}
											</div>
										) : null}
									</div>
								))}
							</div>
						) : null}

						{!errorMessage && !isLoading && results.length === 0 ? (
							<div className="mt-5 rounded-2xl border border-dashed border-slate-700 bg-slate-950/50 px-4 py-6 text-sm text-slate-400">
								No extracted vocabulary yet.
							</div>
						) : null}
					</section>
				</div>

			</div>
		</div>
	)
}
