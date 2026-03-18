import { useMemo, useState } from 'react'

type ExamStyle = 'multiple-choice' | 'sentence-jumble' | 'star-selection'
type DragPayload =
	| { source: 'available'; pieceIndex: number }
	| { source: 'selected'; pieceIndex: number; fromSlot: number; fromPos: number }

type QuestionPart =
	| { type: 'text'; value: string }
	| { type: 'blank'; width: number }

type DragMarker = { slot: number; pos: number }

const DEFAULT_MC_QUESTION = '子供を選手に________のですか？'
const DEFAULT_MC_PROMPT = 'Choose the Japanese that best completes the sentence.'
const DEFAULT_MC_CHOICES = `させられたい
すれば
できれば
させたい`

const DEFAULT_JUMBLE_QUESTION = '彼女？？？？、根本的な解決にはなりません'
const DEFAULT_JUMBLE_PROMPT = 'Arrange the pieces to complete the sentence.'
const DEFAULT_JUMBLE_PIECES = `よ
。
と
しない
和解
限り`

const DEFAULT_STAR_QUESTION = '★のため、学校の授業'
const DEFAULT_STAR_PROMPT = 'Choose the term that fits in the space with the ★.'
const DEFAULT_STAR_TERMS = `学校
ため
台風
の`

function parseLines(input: string): string[] {
	return input
		.split('\n')
		.map((line) => line.trim())
		.filter((line) => line.length > 0)
}

function parseJumbleQuestionParts(text: string): QuestionPart[] {
	const regex = /[？?]+/g
	const parts: QuestionPart[] = []
	let last = 0

	for (const match of text.matchAll(regex)) {
		const index = match.index ?? 0
		if (index > last) {
			parts.push({ type: 'text', value: text.slice(last, index) })
		}
		parts.push({ type: 'blank', width: match[0].length })
		last = index + match[0].length
	}

	if (last < text.length) {
		parts.push({ type: 'text', value: text.slice(last) })
	}

	if (parts.length === 0) {
		return [{ type: 'text', value: text }]
	}

	return parts
}

export default function ExamMultipleChoices() {
	const [style, setStyle] = useState<ExamStyle>('multiple-choice')

	// 1) Multiple choices
	const [mcQuestion, setMcQuestion] = useState(DEFAULT_MC_QUESTION)
	const [mcPrompt, setMcPrompt] = useState(DEFAULT_MC_PROMPT)
	const [mcChoicesText, setMcChoicesText] = useState(DEFAULT_MC_CHOICES)
	const [selectedChoice, setSelectedChoice] = useState<number | null>(null)

	// 2) Sentence jumble
	const [jumbleQuestion, setJumbleQuestion] = useState(DEFAULT_JUMBLE_QUESTION)
	const [jumblePrompt, setJumblePrompt] = useState(DEFAULT_JUMBLE_PROMPT)
	const [jumblePiecesText, setJumblePiecesText] = useState(DEFAULT_JUMBLE_PIECES)
	const [slotOrders, setSlotOrders] = useState<number[][]>(() => {
		const initialBlankCount = parseJumbleQuestionParts(DEFAULT_JUMBLE_QUESTION).filter((part) => part.type === 'blank').length
		return Array.from({ length: initialBlankCount }, () => [])
	})
	const [dragMarker, setDragMarker] = useState<DragMarker | null>(null)

	// 3) Star selection
	const [starQuestion, setStarQuestion] = useState(DEFAULT_STAR_QUESTION)
	const [starPrompt, setStarPrompt] = useState(DEFAULT_STAR_PROMPT)
	const [starTermsText, setStarTermsText] = useState(DEFAULT_STAR_TERMS)
	const [selectedStarTerm, setSelectedStarTerm] = useState('')

	const mcChoices = useMemo(() => parseLines(mcChoicesText), [mcChoicesText])
	const jumblePieces = useMemo(() => parseLines(jumblePiecesText), [jumblePiecesText])
	const starTerms = useMemo(() => parseLines(starTermsText), [starTermsText])
	const jumbleParts = useMemo(() => parseJumbleQuestionParts(jumbleQuestion), [jumbleQuestion])
	const blankCount = useMemo(() => jumbleParts.filter((part) => part.type === 'blank').length, [jumbleParts])

	const availableIndices = useMemo(() => {
		const used = new Set(slotOrders.flat())
		return jumblePieces.map((_, idx) => idx).filter((idx) => !used.has(idx))
	}, [slotOrders, jumblePieces])

	const assembledText = useMemo(() => {
		let slotIdx = 0
		let output = ''
		for (const part of jumbleParts) {
			if (part.type === 'text') {
				output += part.value
				continue
			}
			const slotText = (slotOrders[slotIdx] ?? []).map((pieceIdx) => jumblePieces[pieceIdx]).join('')
			output += slotText || '□'.repeat(Math.max(1, part.width))
			slotIdx += 1
		}
		return output
	}, [jumbleParts, slotOrders, jumblePieces])

	const starPreview = useMemo(() => {
		if (!selectedStarTerm) return starQuestion
		return starQuestion.replace('★', selectedStarTerm)
	}, [starQuestion, selectedStarTerm])

	function addPiece(index: number) {
		setSlotOrders((prev) => {
			if (prev.length === 0) return prev
			if (prev.some((slot) => slot.includes(index))) return prev
			const next = prev.map((slot) => [...slot])
			next[0].push(index)
			return next
		})
	}

	function removePieceAt(slotIndex: number, position: number) {
		setSlotOrders((prev) => {
			if (!prev[slotIndex]) return prev
			const next = prev.map((slot) => [...slot])
			next[slotIndex] = next[slotIndex].filter((_, idx) => idx !== position)
			return next
		})
	}

	function onDragStartAvailable(event: React.DragEvent<HTMLButtonElement>, pieceIndex: number) {
		const payload: DragPayload = { source: 'available', pieceIndex }
		event.dataTransfer.setData('application/json', JSON.stringify(payload))
		event.dataTransfer.effectAllowed = 'move'
	}

	function onDragStartSelected(event: React.DragEvent<HTMLDivElement>, pieceIndex: number, fromSlot: number, fromPos: number) {
		const payload: DragPayload = { source: 'selected', pieceIndex, fromSlot, fromPos }
		event.dataTransfer.setData('application/json', JSON.stringify(payload))
		event.dataTransfer.effectAllowed = 'move'
	}

	function onDropToSentence(event: React.DragEvent<HTMLElement>, slotIndex: number, insertPos: number) {
		event.preventDefault()
		setDragMarker(null)

		let payload: DragPayload | null = null
		try {
			payload = JSON.parse(event.dataTransfer.getData('application/json')) as DragPayload
		} catch {
			return
		}
		if (!payload) return

		setSlotOrders((prev) => {
			if (!prev[slotIndex]) return prev
			const next = prev.map((slot) => [...slot])

			if (payload?.source === 'available') {
				if (next.some((slot) => slot.includes(payload.pieceIndex))) return prev
				next[slotIndex].splice(insertPos, 0, payload.pieceIndex)
				return next
			}

			const fromPos = payload.fromPos
			const fromSlot = payload.fromSlot
			if (!next[fromSlot] || fromPos < 0 || fromPos >= next[fromSlot].length) return prev

			const [item] = next[fromSlot].splice(fromPos, 1)
			let targetPos = insertPos
			if (fromSlot === slotIndex && fromPos < insertPos) {
				targetPos = Math.max(0, insertPos - 1)
			}
			next[slotIndex].splice(targetPos, 0, item)
			return next
		})
	}

	function onDropToAvailable(event: React.DragEvent<HTMLElement>) {
		event.preventDefault()
		setDragMarker(null)

		let payload: DragPayload | null = null
		try {
			payload = JSON.parse(event.dataTransfer.getData('application/json')) as DragPayload
		} catch {
			return
		}
		if (!payload) return

		if (payload.source === 'selected') {
			removePieceAt(payload.fromSlot, payload.fromPos)
		}
	}

	return (
		<div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(125,211,252,0.16),transparent_34%),linear-gradient(180deg,#0f172a_0%,#111827_50%,#020617_100%)] px-6 py-10 text-slate-100">
			<div className="mx-auto max-w-7xl">
				<div className="mb-8">
					<h1 className="text-3xl font-bold text-slate-100">Exam Multiple Choices</h1>
					<p className="mt-2 text-sm text-slate-300">
						Build question sets in three styles: Multiple Choices, Sentence Jumble, and Star Selection.
					</p>
				</div>

				<div className="grid gap-8 lg:grid-cols-[380px_1fr]">
					<aside className="h-fit rounded-3xl border border-slate-700/80 bg-slate-900/75 p-6 shadow-xl shadow-black/20 ring-1 ring-white/5">
						<h2 className="mb-5 text-lg font-semibold text-slate-100">Question Builder</h2>

						<div>
							<span className="mb-2 block text-sm font-medium text-slate-300">Style</span>
							<div className="grid grid-cols-1 gap-2">
								<button
									type="button"
									onClick={() => setStyle('multiple-choice')}
									className={`rounded-xl border px-3 py-2 text-left text-sm transition ${style === 'multiple-choice' ? 'border-sky-400 bg-sky-500/20 text-sky-300' : 'border-slate-600 bg-slate-950 text-slate-200'}`}
								>
									1. Multiple Choices
								</button>
								<button
									type="button"
									onClick={() => setStyle('sentence-jumble')}
									className={`rounded-xl border px-3 py-2 text-left text-sm transition ${style === 'sentence-jumble' ? 'border-sky-400 bg-sky-500/20 text-sky-300' : 'border-slate-600 bg-slate-950 text-slate-200'}`}
								>
									2. Sentence Jumble
								</button>
								<button
									type="button"
									onClick={() => setStyle('star-selection')}
									className={`rounded-xl border px-3 py-2 text-left text-sm transition ${style === 'star-selection' ? 'border-sky-400 bg-sky-500/20 text-sky-300' : 'border-slate-600 bg-slate-950 text-slate-200'}`}
								>
									3. Star Selection
								</button>
							</div>
						</div>

						{style === 'multiple-choice' ? (
							<div className="mt-5 space-y-4">
								<label className="block">
									<span className="mb-2 block text-sm font-medium text-slate-300">Question</span>
									<input
										type="text"
										value={mcQuestion}
										onChange={(e) => setMcQuestion(e.target.value)}
										className="w-full rounded-xl border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-sky-400"
									/>
								</label>
								<label className="block">
									<span className="mb-2 block text-sm font-medium text-slate-300">Prompt</span>
									<textarea
										rows={2}
										value={mcPrompt}
										onChange={(e) => setMcPrompt(e.target.value)}
										className="w-full rounded-xl border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-sky-400"
									/>
								</label>
								<label className="block">
									<span className="mb-2 block text-sm font-medium text-slate-300">Choices (one per line)</span>
									<textarea
										rows={6}
										value={mcChoicesText}
										onChange={(e) => {
											setMcChoicesText(e.target.value)
											setSelectedChoice(null)
										}}
										className="w-full rounded-xl border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-sky-400"
									/>
								</label>
							</div>
						) : null}

						{style === 'sentence-jumble' ? (
							<div className="mt-5 space-y-4">
								<label className="block">
									<span className="mb-2 block text-sm font-medium text-slate-300">Question</span>
									<input
										type="text"
										value={jumbleQuestion}
										onChange={(e) => {
											const nextQuestion = e.target.value
											setJumbleQuestion(nextQuestion)
											const nextBlankCount = parseJumbleQuestionParts(nextQuestion).filter((part) => part.type === 'blank').length
											setSlotOrders(Array.from({ length: nextBlankCount }, () => []))
											setDragMarker(null)
										}}
										className="w-full rounded-xl border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-sky-400"
									/>
								</label>
								<label className="block">
									<span className="mb-2 block text-sm font-medium text-slate-300">Prompt</span>
									<textarea
										rows={2}
										value={jumblePrompt}
										onChange={(e) => setJumblePrompt(e.target.value)}
										className="w-full rounded-xl border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-sky-400"
									/>
								</label>
								<label className="block">
									<span className="mb-2 block text-sm font-medium text-slate-300">Pieces (one per line)</span>
									<textarea
										rows={6}
										value={jumblePiecesText}
										onChange={(e) => {
											setJumblePiecesText(e.target.value)
											setSlotOrders((prev) => prev.map(() => []))
										}}
										className="w-full rounded-xl border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-sky-400"
									/>
								</label>
							</div>
						) : null}

						{style === 'star-selection' ? (
							<div className="mt-5 space-y-4">
								<label className="block">
									<span className="mb-2 block text-sm font-medium text-slate-300">Question (use ★ as space)</span>
									<input
										type="text"
										value={starQuestion}
										onChange={(e) => {
											setStarQuestion(e.target.value)
											setSelectedStarTerm('')
										}}
										className="w-full rounded-xl border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-sky-400"
									/>
								</label>
								<label className="block">
									<span className="mb-2 block text-sm font-medium text-slate-300">Prompt</span>
									<textarea
										rows={2}
										value={starPrompt}
										onChange={(e) => setStarPrompt(e.target.value)}
										className="w-full rounded-xl border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-sky-400"
									/>
								</label>
								<label className="block">
									<span className="mb-2 block text-sm font-medium text-slate-300">Terms (one per line)</span>
									<textarea
										rows={6}
										value={starTermsText}
										onChange={(e) => {
											setStarTermsText(e.target.value)
											setSelectedStarTerm('')
										}}
										className="w-full rounded-xl border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-sky-400"
									/>
								</label>
							</div>
						) : null}
					</aside>

					<section className="rounded-3xl border border-slate-700/80 bg-slate-900/70 p-6 shadow-xl shadow-black/20 ring-1 ring-white/5">
						{style === 'multiple-choice' ? (
							<div className="space-y-4">
								<p className="text-xs uppercase tracking-[0.2em] text-sky-300">Multiple Choices</p>
								<h2 className="text-2xl font-semibold text-slate-100">{mcQuestion}</h2>
								<p className="text-sm text-slate-300">{mcPrompt}</p>
								<div className="space-y-2">
									{mcChoices.map((choice, idx) => (
										<button
											key={`${choice}-${idx}`}
											type="button"
											onClick={() => setSelectedChoice(idx)}
											className={`w-full rounded-xl border px-4 py-3 text-left text-sm transition ${selectedChoice === idx ? 'border-sky-400 bg-sky-500/20 text-sky-200' : 'border-slate-700 bg-slate-950/60 text-slate-100 hover:border-slate-500'}`}
										>
											{choice}
										</button>
									))}
								</div>
							</div>
						) : null}

						{style === 'sentence-jumble' ? (
							<div className="space-y-4">
								<p className="text-xs uppercase tracking-[0.2em] text-sky-300">Sentence Jumble</p>
								<div
									className="rounded-2xl border border-slate-700 bg-slate-950/70 p-4"
									onDragOver={(e) => {
										e.preventDefault()
										e.dataTransfer.dropEffect = 'move'
									}}
									onDrop={onDropToAvailable}
								>
									<p className="mb-2 text-xs text-slate-400">Drag available pieces into each blank area. Drop a selected piece back to Available Pieces to remove it.</p>
									<h2 className="text-2xl font-semibold leading-relaxed text-slate-100">
										{(() => {
											let slotIdx = 0
											return jumbleParts.map((part, idx) => {
												if (part.type === 'text') {
													return <span key={`text-${idx}`}>{part.value}</span>
												}

												const thisSlot = slotIdx
												slotIdx += 1
												const selected = slotOrders[thisSlot] ?? []
												const minWidth = Math.max(2.8, part.width * 1.3)

												return (
													<span
														key={`blank-${idx}`}
														className="mx-1 inline-flex min-h-12 flex-wrap items-center gap-2 rounded-xl border border-dashed border-sky-500/60 bg-sky-500/10 px-2 py-1 align-middle"
														style={{ minWidth: `${minWidth}em` }}
														onDragOver={(e) => {
															e.preventDefault()
															e.dataTransfer.dropEffect = 'move'
															setDragMarker({ slot: thisSlot, pos: selected.length })
														}}
														onDrop={(e) => onDropToSentence(e, thisSlot, selected.length)}
													>
														<button
															type="button"
															onDragOver={(e) => {
																e.preventDefault()
																setDragMarker({ slot: thisSlot, pos: 0 })
															}}
															onDrop={(e) => onDropToSentence(e, thisSlot, 0)}
															className={`h-8 w-2 rounded-full transition ${dragMarker?.slot === thisSlot && dragMarker.pos === 0 ? 'bg-sky-300/70' : 'bg-transparent'}`}
															aria-label="Insert at beginning"
														/>

														{selected.map((pieceIdx, pos) => (
															<div key={`${thisSlot}-${pieceIdx}-${pos}`} className="inline-flex items-center gap-1">
																<div
																	draggable
																	onDragStart={(e) => onDragStartSelected(e, pieceIdx, thisSlot, pos)}
																	className="inline-flex cursor-grab items-center rounded-lg border border-amber-500/70 bg-amber-500/15 px-2 py-1 text-base text-amber-200"
																>
																	{jumblePieces[pieceIdx]}
																</div>
																<button
																	type="button"
																	onDragOver={(e) => {
																		e.preventDefault()
																		setDragMarker({ slot: thisSlot, pos: pos + 1 })
																	}}
																	onDrop={(e) => onDropToSentence(e, thisSlot, pos + 1)}
																	className={`h-8 w-2 rounded-full transition ${dragMarker?.slot === thisSlot && dragMarker.pos === pos + 1 ? 'bg-sky-300/70' : 'bg-transparent'}`}
																	aria-label="Insert position"
																/>
															</div>
														))}
													</span>
												)
											})
										})()}
									</h2>
									{blankCount > 0 ? null : (
										<p className="mt-2 text-xs text-amber-300">Tip: add ???? in the question where pieces should be dropped.</p>
									)}
								</div>
								<p className="text-sm text-slate-300">{jumblePrompt}</p>

								<div
									className="rounded-2xl border border-slate-700 bg-slate-950/60 p-4"
									onDragOver={(e) => {
										e.preventDefault()
										e.dataTransfer.dropEffect = 'move'
									}}
									onDrop={onDropToAvailable}
								>
									<p className="mb-2 text-xs text-slate-400">Available pieces (drag into sentence blank, or drop selected pieces here to remove):</p>
									<div className="flex flex-wrap gap-2">
										{availableIndices.map((idx) => (
											<button
												key={`avail-${idx}`}
												type="button"
												draggable
												onDragStart={(e) => onDragStartAvailable(e, idx)}
												onClick={() => addPiece(idx)}
												className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm text-slate-100 hover:border-sky-400"
											>
												{jumblePieces[idx]}
											</button>
										))}
									</div>
								</div>

								<p className="text-sm text-slate-300">Current sentence: {assembledText || '...'}</p>
							</div>
						) : null}

						{style === 'star-selection' ? (
							<div className="space-y-4">
								<p className="text-xs uppercase tracking-[0.2em] text-sky-300">Star Selection</p>
								<h2 className="text-2xl font-semibold text-slate-100">{starQuestion}</h2>
								<p className="text-sm text-slate-300">{starPrompt}</p>

								<div className="rounded-2xl border border-slate-700 bg-slate-950/60 p-4">
									<p className="mb-2 text-xs text-slate-400">Choose the term for ★:</p>
									<div className="flex flex-wrap gap-2">
										{starTerms.map((term, idx) => (
											<button
												key={`${term}-${idx}`}
												type="button"
												onClick={() => setSelectedStarTerm(term)}
												className={`rounded-lg border px-3 py-1.5 text-sm transition ${selectedStarTerm === term ? 'border-sky-400 bg-sky-500/20 text-sky-300' : 'border-slate-600 bg-slate-800 text-slate-100 hover:border-slate-400'}`}
											>
												{term}
											</button>
										))}
									</div>
									<p className="mt-3 text-sm text-slate-200">Result: {starPreview}</p>
								</div>
							</div>
						) : null}
					</section>
				</div>
			</div>
		</div>
	)
}
