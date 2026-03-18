import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import {
	lookupDictionaryApi,
	type DictionaryEntry,
	type DictionarySegment,
} from '../api_caller/dictionary'
import {
	sentenceBreakdownApi,
	type SentenceToken,
} from '../api_caller/sentence_breakdown'

type ViewMode = 'reader' | 'words' | 'kanji'
type WordSortMode = 'order' | 'frequency'
type ExportStyle = 'compact' | 'study' | 'custom'
type WordSeparatorMode = 'line' | 'custom'

type FuriganaEntry = {
	word: string
	reading: string
}

type FuriganaStatus = {
	tone: 'info' | 'ok' | 'warn'
	text: string
}

type DictionaryPanelState = {
	query: string
	articleReading: string
	results: DictionaryEntry[]
}

type KuromojiToken = {
	surface_form?: string
	reading?: string
}

type WordCardData = {
	id: string
	word: string
	reading: string
	pos: string
	meanings: string[]
	count: number
}

type KanjiCardData = {
	id: string
	kanji: string
	reading: string
	meanings: string[]
}

type ExportFieldKey = 'kana' | 'kanji' | 'definition' | 'pos'

const DEFAULT_TOPIC = '\u9cf3\u51f0'
const DEFAULT_CONTENT = `\u9cf3\u51f0\u3068\u3044\u3046\u7279\u5225\u306a\u9ce5\u306e\u8a71\u3067\u3059\u3002
\u9cf3\u51f0\u306f\u3001\u6614\u306e\u4e2d\u56fd\u306e\u4f1d\u8aac\u306b\u51fa\u3066\u304f\u308b\u9ce5\u3067\u3059\u3002\u9cf3\u51f0\u306f\u3001\u5e73\u548c\u3067\u5e78\u305b\u306a\u3068\u304d\u3060\u3051\u73fe\u308c\u308b\u3068\u4fe1\u3058\u3089\u308c\u3066\u304d\u307e\u3057\u305f\u3002\u9cf3\u51f0\u306f\u3001\u5e73\u548c\u3084\u5e78\u305b\u306e\u8c61\u5fb4\u3067\u3059\u3002
\u65e5\u672c\u3067\u306f\u3001\u304a\u795d\u3044\u306e\u3068\u304d\u306b\u9cf3\u51f0\u306e\u7d75\u3092\u4f7f\u3044\u307e\u3059\u3002\u7740\u7269\u3084\u304a\u5bfa\u306e\u5efa\u7269\u306a\u3069\u306b\u3082\u9cf3\u51f0\u306e\u7d75\u3092\u4f7f\u3063\u3066\u3044\u307e\u3059\u3002\u5e78\u305b\u3092\u9858\u3046\u6c17\u6301\u3061\u304c\u5165\u3063\u3066\u3044\u307e\u3059\u3002`

const DEFAULT_FURIGANA = `\u9cf3\u51f0|\u307b\u3046\u304a\u3046
\u7279\u5225|\u3068\u304f\u3079\u3064
\u9ce5|\u3068\u308a
\u8a71|\u306f\u306a\u3057
\u6614|\u3080\u304b\u3057
\u4e2d\u56fd|\u3061\u3085\u3046\u3054\u304f
\u4f1d\u8aac|\u3067\u3093\u305b\u3064
\u5e73\u548c|\u3078\u3044\u308f
\u5e78\u305b|\u3057\u3042\u308f\u305b
\u73fe\u308c\u308b|\u3042\u3089\u308f\u308c\u308b
\u4fe1\u3058\u3089\u308c\u3066|\u3057\u3093\u3058\u3089\u308c\u3066
\u8c61\u5fb4|\u3057\u3087\u3046\u3061\u3087\u3046
\u65e5\u672c|\u306b\u307b\u3093
\u304a\u795d\u3044|\u304a\u3044\u308f\u3044
\u7d75|\u3048
\u4f7f\u3044\u307e\u3059|\u3064\u304b\u3044\u307e\u3059
\u7740\u7269|\u304d\u3082\u306e
\u304a\u5bfa|\u304a\u3066\u3089
\u5efa\u7269|\u305f\u3066\u3082\u306e
\u9858\u3046|\u306d\u304c\u3046
\u6c17\u6301\u3061|\u304d\u3082\u3061
\u5165\u3063\u3066\u3044\u307e\u3059|\u306f\u3044\u3063\u3066\u3044\u307e\u3059`

function escapeRegExp(text: string): string {
	return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function containsKanji(text: string): boolean {
	return /[\u4e00-\u9faf々〆ヵヶ]/.test(text)
}

function hasJapaneseText(text: string): boolean {
	return /[\u3040-\u30ff\u4e00-\u9faf々〆ヵヶ]/.test(text)
}

function parseEntries(input: string): FuriganaEntry[] {
	return input
		.split('\n')
		.map((line) => line.trim())
		.filter((line) => line.length > 0)
		.map((line) => {
			const [word, reading] = line.split('|').map((part) => part?.trim() ?? '')
			return { word, reading }
		})
		.filter((entry) => entry.word.length > 0)
		.sort((a, b) => b.word.length - a.word.length)
}

function parseWordsOnly(input: string): string[] {
	return Array.from(
		new Set(
			input
				.split('\n')
				.map((line) => line.trim())
				.filter((line) => line.length > 0)
				.map((line) => line.split('|')[0]?.trim() ?? '')
				.filter((word) => word.length > 0),
		),
	)
}

function mergeEntries(existing: FuriganaEntry[], generated: FuriganaEntry[]): FuriganaEntry[] {
	const merged = new Map<string, string>()
	for (const entry of existing) merged.set(entry.word, entry.reading)
	for (const entry of generated) {
		if (!merged.has(entry.word) || !merged.get(entry.word)) {
			merged.set(entry.word, entry.reading)
		}
	}

	return Array.from(merged.entries())
		.map(([word, reading]) => ({ word, reading }))
		.filter((entry) => entry.word.length > 0)
		.sort((a, b) => b.word.length - a.word.length)
}

function toEntryLines(entries: FuriganaEntry[]): string {
	return entries.map((entry) => `${entry.word}|${entry.reading}`).join('\n')
}

function katakanaToHiragana(text: string): string {
	return text.replace(/[\u30A1-\u30F6]/g, (char) =>
		String.fromCharCode(char.charCodeAt(0) - 0x60),
	)
}

function extractKanjiWords(content: string): string[] {
	const matches = content.match(/[\u4e00-\u9faf々〆ヵヶ][\u4e00-\u9faf々〆ヵヶぁ-んー]*/g) ?? []
	return Array.from(new Set(matches)).sort((a, b) => b.length - a.length)
}

function extractUniqueKanji(text: string): string[] {
	const matches = text.match(/[\u4e00-\u9faf々〆ヵヶ]/g) ?? []
	return Array.from(new Set(matches))
}

function getPreferredReading(
	token: SentenceToken,
	entryMap: Map<string, string>,
): string {
	return (
		entryMap.get(token.surface) ||
		entryMap.get(token.dictionary_word) ||
		entryMap.get(token.base) ||
		token.base_reading ||
		token.reading ||
		''
	)
}

function getPreferredPos(token: SentenceToken): string {
	if (token.dictionary_pos.length > 0) {
		return token.dictionary_pos.join(', ')
	}

	return token.pos || '-'
}

async function generateWithKuromoji(content: string): Promise<FuriganaEntry[]> {
	const moduleUrls = [
		'https://cdn.jsdelivr.net/npm/kuromoji@0.1.2/+esm',
		'https://esm.sh/kuromoji@0.1.2',
	]
	const dictPaths = [
		'https://cdn.jsdelivr.net/npm/kuromoji@0.1.2/dict/',
		'https://unpkg.com/kuromoji@0.1.2/dict/',
	]

	type KuromojiModule = {
		builder: (opts: { dicPath: string }) => {
			build: (
				cb: (
					err: Error | null,
					tokenizer?: { tokenize: (text: string) => KuromojiToken[] },
				) => void,
			) => void
		}
	}

	let kuromojiModule: KuromojiModule | null = null
	for (const moduleUrl of moduleUrls) {
		try {
			kuromojiModule = (await import(/* @vite-ignore */ moduleUrl)) as KuromojiModule
			break
		} catch {
			// Try the next CDN module URL.
		}
	}

	if (!kuromojiModule) {
		throw new Error('Unable to load kuromoji module from CDN')
	}

	let tokenizer: { tokenize: (text: string) => KuromojiToken[] } | null = null
	for (const dicPath of dictPaths) {
		try {
			tokenizer = await new Promise<{ tokenize: (text: string) => KuromojiToken[] }>(
				(resolve, reject) => {
					kuromojiModule
						?.builder({ dicPath })
						.build((err, tk) => {
							if (err || !tk) {
								reject(err ?? new Error('Tokenizer init failed'))
								return
							}
							resolve(tk)
						})
				},
			)
			break
		} catch {
			// Try the next dictionary host.
		}
	}

	if (!tokenizer) {
		throw new Error('Unable to initialize tokenizer dictionary')
	}

	const tokens = tokenizer.tokenize(content)
	const entries = new Map<string, string>()

	for (const token of tokens) {
		const word = token.surface_form?.trim() ?? ''
		const reading = token.reading?.trim() ?? ''
		if (!word || !reading) continue
		if (!containsKanji(word)) continue
		if (reading === '*') continue

		const hira = katakanaToHiragana(reading)
		if (!entries.has(word)) entries.set(word, hira)
	}

	return Array.from(entries.entries())
		.map(([word, reading]) => ({ word, reading }))
		.sort((a, b) => b.word.length - a.word.length)
}

function DictionaryRubyText({ segments }: { segments?: DictionarySegment[] }) {
	if (!segments || segments.length === 0) {
		return null
	}

	return (
		<div className="flex flex-wrap items-end gap-x-2 gap-y-4 text-3xl font-semibold tracking-wide text-slate-100">
			{segments.map((segment, index) => (
				<ruby key={`${segment.text}-${index}`} className="ruby-word">
					{segment.text}
					{segment.furigana ? (
						<rt className="ruby-reading text-sm font-medium text-sky-200/90">
							{segment.furigana}
						</rt>
					) : null}
				</ruby>
			))}
		</div>
	)
}

function StatCard({ label, value }: { label: string; value: string }) {
	return (
		<div className="rounded-2xl border border-slate-700 bg-slate-950/60 px-4 py-3">
			<div className="text-xs uppercase tracking-[0.2em] text-slate-400">{label}</div>
			<div className="mt-2 text-lg font-semibold text-slate-100">{value}</div>
		</div>
	)
}

function renderInteractiveContent(
	text: string,
	entries: FuriganaEntry[],
	showFurigana: boolean,
	activeWord: string | null,
	onWordClick: (entry: FuriganaEntry) => void,
) {
	if (entries.length === 0) return [text]

	const pattern = entries.map((entry) => escapeRegExp(entry.word)).join('|')
	if (!pattern) return [text]

	const regex = new RegExp(`(${pattern})`, 'g')
	const chunks = text.split(regex)
	const entryMap = new Map(entries.map((entry) => [entry.word, entry]))

	return chunks.map((chunk, index) => {
		const entry = entryMap.get(chunk)
		if (!entry) {
			return <span key={`${chunk}-${index}`}>{chunk}</span>
		}

		const isActive = activeWord === entry.word

		return (
			<button
				key={`${chunk}-${index}`}
				type="button"
				onClick={() => onWordClick(entry)}
				className={`mx-0.5 inline rounded-lg px-1 align-baseline transition ${
					isActive
						? 'bg-sky-500/20 text-sky-200'
						: 'hover:bg-slate-800/80 hover:text-sky-200'
				}`}
			>
				{showFurigana && entry.reading ? (
					<ruby>
						{entry.word}
						<rt className="text-[10px] text-sky-300">{entry.reading}</rt>
					</ruby>
				) : (
					entry.word
				)}
			</button>
		)
	})
}

function triggerTextDownload(content: string, filename: string) {
	const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
	const url = window.URL.createObjectURL(blob)
	const link = document.createElement('a')
	link.href = url
	link.download = filename
	document.body.appendChild(link)
	link.click()
	link.remove()
	window.URL.revokeObjectURL(url)
}

export default function NewsReading() {
	const navigate = useNavigate()
	const [topic, setTopic] = useState(DEFAULT_TOPIC)
	const [content, setContent] = useState(DEFAULT_CONTENT)
	const [furiganaInput, setFuriganaInput] = useState(DEFAULT_FURIGANA)
	const [showFurigana, setShowFurigana] = useState(true)
	const [fontSizePx, setFontSizePx] = useState(28)
	const [viewMode, setViewMode] = useState<ViewMode>('reader')
	const [wordSortMode, setWordSortMode] = useState<WordSortMode>('order')
	const [showExportForm, setShowExportForm] = useState(false)
	const [exportStyle, setExportStyle] = useState<ExportStyle>('study')
	const [separatorMode, setSeparatorMode] = useState<WordSeparatorMode>('line')
	const [customSeparator, setCustomSeparator] = useState(', ')
	const [includeKana, setIncludeKana] = useState(true)
	const [includeKanji, setIncludeKanji] = useState(true)
	const [includeDefinition, setIncludeDefinition] = useState(true)
	const [includePos, setIncludePos] = useState(true)
	const [isGenerating, setIsGenerating] = useState(false)
	const [status, setStatus] = useState<FuriganaStatus | null>(null)
	const [selectedWord, setSelectedWord] = useState<string | null>(null)
	const [selectedDictionaryIndex, setSelectedDictionaryIndex] = useState(0)
	const [dictionaryState, setDictionaryState] = useState<DictionaryPanelState | null>(null)
	const [isLookingUp, setIsLookingUp] = useState(false)
	const [lookupError, setLookupError] = useState<string | null>(null)
	const [analysisTokens, setAnalysisTokens] = useState<SentenceToken[]>([])
	const [analysisError, setAnalysisError] = useState<string | null>(null)
	const [isAnalyzing, setIsAnalyzing] = useState(false)
	const [kanjiCards, setKanjiCards] = useState<KanjiCardData[]>([])
	const [isLoadingKanji, setIsLoadingKanji] = useState(false)
	const popupRef = useRef<HTMLDivElement | null>(null)

	const entries = useMemo(() => parseEntries(furiganaInput), [furiganaInput])
	const entryMap = useMemo(
		() => new Map(entries.filter((entry) => entry.reading).map((entry) => [entry.word, entry.reading])),
		[entries],
	)
	const displayEntries = useMemo(
		() => entries.filter((entry) => entry.reading.length > 0),
		[entries],
	)
	const paragraphs = useMemo(
		() => content.split('\n').map((line) => line.trim()).filter(Boolean),
		[content],
	)
	const selectedDictionaryEntry = dictionaryState?.results[selectedDictionaryIndex] ?? null
	const effectiveSeparator = separatorMode === 'line' ? '\n' : customSeparator

	const wordTokens = useMemo(
		() =>
			analysisTokens.filter(
				(token) =>
					hasJapaneseText(token.surface) &&
					token.pos !== '記号' &&
					token.pos !== '助詞' &&
					token.pos !== '助動詞' &&
					token.surface.trim().length > 0,
			),
		[analysisTokens],
	)

	const uniqueWordCount = useMemo(
		() =>
			new Set(
				wordTokens.map((token) => token.dictionary_word || token.base || token.surface),
			).size,
		[wordTokens],
	)

	const wordCards = useMemo<WordCardData[]>(() => {
		const grouped = new Map<string, WordCardData>()
		for (const token of wordTokens) {
			const key = token.dictionary_word || token.base || token.surface
			const existing = grouped.get(key)

			if (existing) {
				existing.count += 1
				continue
			}

			grouped.set(key, {
				id: key,
				word: key,
				reading: containsKanji(key) ? getPreferredReading(token, entryMap) : '',
				pos: getPreferredPos(token),
				meanings: token.meanings,
				count: 1,
			})
		}

		const uniqueCards = Array.from(grouped.values())
		if (wordSortMode === 'order') {
			return uniqueCards
		}

		return uniqueCards.sort((a, b) => {
			if (b.count !== a.count) return b.count - a.count
			return a.word.localeCompare(b.word, 'ja')
		})
	}, [wordTokens, entryMap, wordSortMode])

	useEffect(() => {
		if (exportStyle === 'compact') {
			setIncludeKana(false)
			setIncludeKanji(true)
			setIncludeDefinition(false)
			setIncludePos(false)
			setSeparatorMode('custom')
			setCustomSeparator(', ')
			return
		}

		if (exportStyle === 'study') {
			setIncludeKana(true)
			setIncludeKanji(true)
			setIncludeDefinition(true)
			setIncludePos(true)
			setSeparatorMode('line')
			return
		}
	}, [exportStyle])

	useEffect(() => {
		if (!selectedWord) {
			return
		}

		function handlePointerDown(event: MouseEvent) {
			if (!popupRef.current) {
				return
			}

			const target = event.target
			if (target instanceof Node && !popupRef.current.contains(target)) {
				setSelectedWord(null)
				setDictionaryState(null)
				setLookupError(null)
				setSelectedDictionaryIndex(0)
			}
		}

		document.addEventListener('mousedown', handlePointerDown)
		return () => document.removeEventListener('mousedown', handlePointerDown)
	}, [selectedWord])

	useEffect(() => {
		const trimmed = content.trim()
		if (!trimmed) {
			setAnalysisTokens([])
			setAnalysisError(null)
			setKanjiCards([])
			return
		}

		let cancelled = false
		setIsAnalyzing(true)
		setAnalysisError(null)

		const timer = window.setTimeout(async () => {
			try {
				const response = await sentenceBreakdownApi(trimmed)
				if (cancelled) return
				setAnalysisTokens(response.tokens)
			} catch (error) {
				if (cancelled) return
				setAnalysisTokens([])
				setAnalysisError(
					error instanceof Error ? error.message : 'Unable to analyze article content right now.',
				)
			} finally {
				if (!cancelled) {
					setIsAnalyzing(false)
				}
			}
		}, 250)

		return () => {
			cancelled = true
			window.clearTimeout(timer)
		}
	}, [content])

	useEffect(() => {
		const chars = extractUniqueKanji(content)
		if (chars.length === 0) {
			setKanjiCards([])
			setIsLoadingKanji(false)
			return
		}

		let cancelled = false
		setIsLoadingKanji(true)

		const timer = window.setTimeout(async () => {
			try {
				const results = await Promise.all(
					chars.map(async (kanji) => {
						try {
							const response = await lookupDictionaryApi(kanji)
							const first = response.results[0]
							return {
								id: kanji,
								kanji,
								reading: first?.furigana ?? '',
								meanings: first?.meanings ?? [],
							} satisfies KanjiCardData
						} catch {
							return {
								id: kanji,
								kanji,
								reading: '',
								meanings: [],
							} satisfies KanjiCardData
						}
					}),
				)

				if (!cancelled) {
					setKanjiCards(results)
				}
			} finally {
				if (!cancelled) {
					setIsLoadingKanji(false)
				}
			}
		}, 250)

		return () => {
			cancelled = true
			window.clearTimeout(timer)
		}
	}, [content])

	async function handleAutoGenerate(mode: 'merge' | 'replace') {
		const trimmed = content.trim()
		if (!trimmed) {
			setStatus({ tone: 'warn', text: 'Add content first, then generate furigana.' })
			return
		}

		setIsGenerating(true)
		setStatus({ tone: 'info', text: `Generating furigana list from content (${mode})...` })

		const existing = parseEntries(furiganaInput)
		const existingWords = new Set(parseWordsOnly(furiganaInput))

		try {
			const generated = await generateWithKuromoji(trimmed)
			const nextEntries = mode === 'replace' ? generated : mergeEntries(existing, generated)
			setFuriganaInput(toEntryLines(nextEntries))
			setStatus({
				tone: 'ok',
				text: `Generated ${generated.length} entries. Total list: ${nextEntries.length}.`,
			})
		} catch {
			const words = extractKanjiWords(trimmed)
			const nextEntries =
				mode === 'replace'
					? words.map((word) => `${word}|`)
					: words
							.filter((word) => !existingWords.has(word))
							.map((word) => `${word}|`)

			const prefix = mode === 'replace' ? '' : furiganaInput.trim()
			const nextText =
				prefix.length > 0 ? `${prefix}\n${nextEntries.join('\n')}` : nextEntries.join('\n')
			setFuriganaInput(nextText)
			setStatus({
				tone: 'warn',
				text: `Tokenizer unavailable. ${mode === 'replace' ? 'Rebuilt' : 'Added'} ${nextEntries.length} kanji words with blank readings for manual fill.`,
			})
		} finally {
			setIsGenerating(false)
		}
	}

	async function handleWordClick(entry: FuriganaEntry) {
		setSelectedWord(entry.word)
		setSelectedDictionaryIndex(0)
		setIsLookingUp(true)
		setLookupError(null)

		try {
			const response = await lookupDictionaryApi(entry.word)
			setDictionaryState({
				query: entry.word,
				articleReading: entry.reading,
				results: response.results,
			})
		} catch (error) {
			setDictionaryState({
				query: entry.word,
				articleReading: entry.reading,
				results: [],
			})
			setLookupError(
				error instanceof Error ? error.message : 'Unable to load dictionary details right now.',
			)
		} finally {
			setIsLookingUp(false)
		}
	}

	function buildExportLine(card: WordCardData): string {
		const parts: string[] = []
		const pushIfPresent = (value: string) => {
			if (value.trim()) {
				parts.push(value.trim())
			}
		}

		if (includeKanji) {
			pushIfPresent(card.word)
		}

		if (includeKana) {
			pushIfPresent(card.reading)
		}

		if (includeDefinition) {
			pushIfPresent(card.meanings.join(', '))
		}

		if (includePos) {
			pushIfPresent(card.pos)
		}

		if (parts.length === 0) {
			return card.word
		}

		return parts.join(' | ')
	}

	function handleExportWords() {
		if (wordCards.length === 0) {
			return
		}

		const lines = wordCards.map(buildExportLine)
		const separator = effectiveSeparator.length > 0 ? effectiveSeparator : '\n'
		const exportText = lines.join(separator)
		const safeTopic = (topic.trim() || 'news-reading-words')
			.replace(/[<>:"/\\|?*\x00-\x1f]/g, '-')
			.replace(/\s+/g, '-')
		triggerTextDownload(exportText, `${safeTopic}.txt`)
	}

	function handleSendToGrid() {
		if (wordCards.length === 0) {
			return
		}

		navigate('/put-vocabulary-grid', {
			state: {
				vocabWords: wordCards.map((card) => card.word),
			},
		})
	}

	const exportFieldOptions: Array<{ key: ExportFieldKey; label: string; checked: boolean; onChange: (checked: boolean) => void }> = [
		{
			key: 'kana',
			label: 'Kana',
			checked: includeKana,
			onChange: setIncludeKana,
		},
		{
			key: 'kanji',
			label: 'Kanji',
			checked: includeKanji,
			onChange: setIncludeKanji,
		},
		{
			key: 'definition',
			label: 'Definition',
			checked: includeDefinition,
			onChange: setIncludeDefinition,
		},
		{
			key: 'pos',
			label: 'Type of speech',
			checked: includePos,
			onChange: setIncludePos,
		},
	]

	return (
		<div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.15),transparent_35%),linear-gradient(180deg,#0f172a_0%,#111827_45%,#020617_100%)] px-6 pb-28 pt-10 text-slate-100">
			<div className="mx-auto max-w-[1500px]">
				<div className="mb-8">
					<h1 className="text-3xl font-bold">News Reading / Article Reading</h1>
					<p className="mt-2 text-sm text-slate-300">
						Add article content, manage a furigana list, and switch between Reader,
						Words, and Kanji views.
					</p>
				</div>

				<div className="grid gap-8 xl:grid-cols-[360px_minmax(0,1fr)]">
					<aside className="h-fit rounded-3xl border border-slate-700/80 bg-slate-900/75 p-6 shadow-xl shadow-black/20 ring-1 ring-white/5">
						<h2 className="mb-5 text-lg font-semibold">Settings</h2>

						<label className="block">
							<span className="mb-2 block text-sm font-medium text-slate-300">Topic</span>
							<input
								type="text"
								value={topic}
								onChange={(event) => setTopic(event.target.value)}
								className="w-full rounded-xl border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-sky-400"
							/>
						</label>

						<label className="mt-5 block">
							<span className="mb-2 block text-sm font-medium text-slate-300">
								Form Content
							</span>
							<textarea
								rows={10}
								value={content}
								onChange={(event) => setContent(event.target.value)}
								className="w-full rounded-xl border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-sky-400"
							/>
						</label>

						<label className="mt-5 block">
							<span className="mb-2 block text-sm font-medium text-slate-300">
								Furigana List (word|reading)
							</span>
							<div className="mb-2 flex items-center gap-2">
								<button
									type="button"
									onClick={() => handleAutoGenerate('merge')}
									disabled={isGenerating}
									className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-100 transition hover:border-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
								>
									{isGenerating ? 'Generating...' : 'Auto generate (merge)'}
								</button>
								<button
									type="button"
									onClick={() => handleAutoGenerate('replace')}
									disabled={isGenerating}
									className="rounded-lg border border-amber-500/50 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-200 transition hover:border-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
								>
									{isGenerating ? 'Generating...' : 'Regenerate (replace)'}
								</button>
							</div>
							<textarea
								rows={10}
								value={furiganaInput}
								onChange={(event) => setFuriganaInput(event.target.value)}
								className="w-full rounded-xl border border-slate-600 bg-slate-950 px-3 py-2 text-xs text-slate-100 outline-none transition focus:border-sky-400"
							/>
							<p className="mt-1 text-xs text-slate-400">
								One line per vocab, format: 漢字|かな
							</p>
							<div className="mt-3 rounded-xl border border-slate-700 bg-slate-950/60 p-3">
								<div className="mb-2 flex items-center justify-between text-xs text-slate-300">
									<span>Article font size</span>
									<span>{fontSizePx}px</span>
								</div>
								<input
									type="range"
									min={16}
									max={44}
									step={1}
									value={fontSizePx}
									onChange={(event) => setFontSizePx(Number(event.target.value))}
									className="w-full accent-sky-400"
								/>
							</div>
							{status ? (
								<p
									className={`mt-2 text-xs ${
										status.tone === 'ok'
											? 'text-emerald-300'
											: status.tone === 'warn'
												? 'text-amber-300'
												: 'text-sky-300'
									}`}
								>
									{status.text}
								</p>
							) : null}
						</label>

						<div className="mt-6 space-y-3">
							<StatCard label="Topic" value={topic || '-'} />
							<StatCard label="Paragraphs" value={`${paragraphs.length}`} />
							<StatCard label="List Entries" value={`${entries.length}`} />
							<StatCard label="Ready With Reading" value={`${displayEntries.length}`} />
						</div>
					</aside>

					<section className="rounded-3xl border border-slate-700/80 bg-slate-900/70 p-6 shadow-xl shadow-black/20 ring-1 ring-white/5">
						<div className="rounded-2xl border border-slate-700 bg-slate-950/60 p-6">
							<p className="text-xs uppercase tracking-[0.2em] text-sky-300">Topic</p>
							<h2 className="mt-2 text-3xl font-bold leading-tight text-slate-100">
								{topic || 'Untitled Topic'}
							</h2>

							<div className="mt-5 flex flex-wrap gap-3">
								{([
									['reader', 'Reader'],
									['words', 'Words'],
									['kanji', 'Kanji'],
								] as const).map(([value, label]) => (
									<button
										key={value}
										type="button"
										onClick={() => setViewMode(value)}
										className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
											viewMode === value
												? 'border-sky-400 bg-sky-500/20 text-sky-200'
												: 'border-slate-600 bg-slate-950 text-slate-300 hover:border-slate-400'
										}`}
									>
										{label}
									</button>
								))}
							</div>

							{viewMode === 'reader' ? (
								<>
									<div className="mt-4 rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-3 text-sm text-slate-300">
										Reader shows the article content with furigana. Click highlighted
										vocabulary to open the dictionary popup.
									</div>

									<div
										className="mt-6 space-y-4 text-slate-100"
										style={{
											fontSize: `${fontSizePx}px`,
											lineHeight: `${Math.round(fontSizePx * 1.9)}px`,
										}}
									>
										{paragraphs.map((paragraph, index) => (
											<p key={`${index}-${paragraph.slice(0, 12)}`}>
												{renderInteractiveContent(
													paragraph,
													entries,
													showFurigana,
													selectedWord,
													handleWordClick,
												)}
											</p>
										))}
									</div>
								</>
							) : null}

							{viewMode === 'words' ? (
								<div className="mt-6">
									<div className="mb-4 flex flex-wrap items-center justify-between gap-3">
										<div className="text-sm text-slate-300">
											Number of words: {wordTokens.length} ({uniqueWordCount} unique)
										</div>
										<div className="flex items-center gap-2">
											<button
												type="button"
												onClick={() => setWordSortMode('order')}
												className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
													wordSortMode === 'order'
														? 'border-sky-400 bg-sky-500/20 text-sky-200'
														: 'border-slate-600 bg-slate-950 text-slate-300'
												}`}
											>
												In order
											</button>
											<button
												type="button"
												onClick={() => setWordSortMode('frequency')}
												className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
													wordSortMode === 'frequency'
														? 'border-sky-400 bg-sky-500/20 text-sky-200'
														: 'border-slate-600 bg-slate-950 text-slate-300'
												}`}
											>
												By frequency
											</button>
										</div>
									</div>

									<div className="mb-5 rounded-2xl border border-slate-700 bg-slate-950/60 p-4">
										<div className="flex flex-wrap items-center justify-between gap-3">
											<div>
												<div className="text-sm font-semibold text-slate-100">Export</div>
												<div className="mt-1 text-xs text-slate-400">
													Open the export form only when you need to download `.txt` or
													send words to the grid page.
												</div>
											</div>
											<div className="flex items-center gap-2">
												<button
													type="button"
													onClick={() => setShowExportForm((current) => !current)}
													disabled={wordCards.length === 0}
													className="rounded-xl border border-slate-600 bg-slate-950 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-50"
												>
													{showExportForm ? 'Hide export form' : 'Open export form'}
												</button>
												{showExportForm ? (
													<>
														<button
															type="button"
															onClick={handleExportWords}
															disabled={wordCards.length === 0}
															className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
														>
															Export .txt
														</button>
														<button
															type="button"
															onClick={handleSendToGrid}
															disabled={wordCards.length === 0}
															className="rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-100 transition hover:border-emerald-300 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
														>
															Send to grid
														</button>
													</>
												) : null}
											</div>
										</div>

										{showExportForm ? (
											<div className="mt-4 grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
												<div>
													<label className="block">
														<span className="mb-2 block text-xs font-medium uppercase tracking-[0.16em] text-slate-400">
															Export Style
														</span>
														<select
															value={exportStyle}
															onChange={(event) =>
																setExportStyle(event.target.value as ExportStyle)
															}
															className="w-full rounded-xl border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-sky-400"
														>
															<option value="compact">Compact</option>
															<option value="study">Study</option>
															<option value="custom">Custom</option>
														</select>
													</label>

													<div className="mt-4">
														<div className="mb-2 text-xs font-medium uppercase tracking-[0.16em] text-slate-400">
															How to separate words
														</div>
														<div className="space-y-2">
															<label className="flex items-center gap-2 text-sm text-slate-200">
																<input
																	type="radio"
																	name="word-separator"
																	checked={separatorMode === 'line'}
																	onChange={() => setSeparatorMode('line')}
																	className="accent-sky-400"
																/>
																<span>1 word per line</span>
															</label>
															<label className="flex items-center gap-2 text-sm text-slate-200">
																<input
																	type="radio"
																	name="word-separator"
																	checked={separatorMode === 'custom'}
																	onChange={() => setSeparatorMode('custom')}
																	className="accent-sky-400"
																/>
																<span>Custom separator</span>
															</label>
														</div>

														{separatorMode === 'custom' ? (
															<input
																type="text"
																value={customSeparator}
																onChange={(event) => setCustomSeparator(event.target.value)}
																placeholder=", "
																className="mt-3 w-full rounded-xl border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-sky-400"
															/>
														) : null}
													</div>
												</div>

												<div>
													<div className="mb-2 text-xs font-medium uppercase tracking-[0.16em] text-slate-400">
														Custom Format
													</div>
													<div className="grid gap-2 sm:grid-cols-2">
														{exportFieldOptions.map((field) => (
															<label
																key={field.key}
																className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-200"
															>
																<input
																	type="checkbox"
																	checked={field.checked}
																	onChange={(event) => {
																		field.onChange(event.target.checked)
																		setExportStyle('custom')
																	}}
																	className="accent-sky-400"
																/>
																<span>{field.label}</span>
															</label>
														))}
													</div>

													<div className="mt-4 rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-3 text-xs text-slate-400">
														Preview format:
														<div className="mt-2 rounded-lg bg-slate-900 px-3 py-2 font-mono text-slate-200">
															{buildExportLine(wordCards[0] ?? {
																id: 'preview',
																word: '漢字',
																reading: 'かんじ',
																pos: '名詞',
																meanings: ['meaning'],
																count: 1,
															})}
														</div>
														<div className="mt-2">
															Separator:{' '}
															{separatorMode === 'line'
																? 'newline'
																: effectiveSeparator || '(empty -> newline)'}
														</div>
													</div>
												</div>
											</div>
										) : null}
									</div>

									{isAnalyzing ? (
										<div className="rounded-2xl border border-sky-500/20 bg-sky-500/10 px-4 py-4 text-sm text-sky-100">
											Analyzing words...
										</div>
									) : null}

									{analysisError ? (
										<div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-4 text-sm text-rose-100">
											{analysisError}
										</div>
									) : null}

									{!isAnalyzing && !analysisError && wordCards.length === 0 ? (
										<div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/50 px-4 py-6 text-sm text-slate-400">
											Add article content to see the word list here.
										</div>
									) : null}

									{wordCards.length > 0 ? (
										<div className="grid gap-4 md:grid-cols-2">
											{wordCards.map((card) => (
												<button
													key={card.id}
													type="button"
													onClick={() =>
														handleWordClick({
															word: card.word,
															reading: card.reading,
														})
													}
													className="rounded-2xl border border-slate-700 bg-slate-950/70 p-4 text-left transition hover:border-sky-400/60 hover:bg-slate-900/90"
												>
													<div className="text-2xl font-semibold text-slate-100">
														{card.word}
													</div>
													<div className="mt-1 text-sm text-sky-300">
														{card.reading || '-'}
													</div>
													<div className="mt-4 text-sm text-slate-200">
														<span className="text-slate-400">POS:</span> {card.pos}
													</div>
													{wordSortMode === 'frequency' ? (
														<div className="mt-2 text-sm text-slate-200">
															<span className="text-slate-400">Frequency:</span> {card.count}
														</div>
													) : null}
													<div className="mt-2 text-sm leading-relaxed text-slate-200">
														<span className="text-slate-400">Meaning:</span>{' '}
														{card.meanings.length > 0 ? card.meanings.join(', ') : '-'}
													</div>
												</button>
											))}
										</div>
									) : null}
								</div>
							) : null}

							{viewMode === 'kanji' ? (
								<div className="mt-6">
									<div className="mb-4 text-sm text-slate-300">
										Number of kanji: {kanjiCards.length}
									</div>

									{isLoadingKanji ? (
										<div className="rounded-2xl border border-sky-500/20 bg-sky-500/10 px-4 py-4 text-sm text-sky-100">
											Loading kanji meanings...
										</div>
									) : null}

									{!isLoadingKanji && kanjiCards.length === 0 ? (
										<div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/50 px-4 py-6 text-sm text-slate-400">
											Add article content with kanji to see kanji meanings here.
										</div>
									) : null}

									{kanjiCards.length > 0 ? (
										<div className="grid gap-4 md:grid-cols-2">
											{kanjiCards.map((card) => (
												<div
													key={card.id}
													className="rounded-2xl border border-slate-700 bg-slate-950/70 p-4"
												>
													<div className="text-3xl font-semibold text-slate-100">
														{card.kanji}
													</div>
													<div className="mt-1 text-sm text-sky-300">
														{card.reading || '-'}
													</div>
													<div className="mt-4 text-sm leading-relaxed text-slate-200">
														<span className="text-slate-400">Kanji meaning:</span>{' '}
														{card.meanings.length > 0 ? card.meanings.join(', ') : '-'}
													</div>
												</div>
											))}
										</div>
									) : null}
								</div>
							) : null}
						</div>
					</section>
				</div>
			</div>

			{selectedWord ? (
				<div className="fixed bottom-24 right-4 z-50 w-[min(92vw,380px)]">
					<div
						ref={popupRef}
						className="rounded-3xl border border-slate-600/80 bg-slate-900/95 p-5 shadow-2xl shadow-black/50 ring-1 ring-white/5 backdrop-blur"
					>
						<div className="flex items-start justify-between gap-3">
							<div className="min-w-0">
								<div className="text-xs uppercase tracking-[0.2em] text-slate-400">
									Dictionary
								</div>
								<div className="mt-2 truncate text-2xl font-semibold text-slate-100">
									{selectedWord}
								</div>
								<div className="mt-1 text-sm text-sky-300">
									{dictionaryState?.articleReading || 'No furigana in list yet'}
								</div>
							</div>

							<button
								type="button"
								onClick={() => {
									setSelectedWord(null)
									setDictionaryState(null)
									setLookupError(null)
									setSelectedDictionaryIndex(0)
								}}
								className="rounded-full border border-slate-600 bg-slate-950 px-3 py-1 text-xs text-slate-300 transition hover:border-slate-400 hover:text-slate-100"
							>
								Close
							</button>
						</div>

						{isLookingUp ? (
							<div className="mt-4 rounded-2xl border border-sky-500/20 bg-sky-500/10 px-4 py-3 text-sm text-sky-100">
								Loading dictionary entry...
							</div>
						) : null}

						{lookupError ? (
							<div className="mt-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
								{lookupError}
							</div>
						) : null}

						{dictionaryState && dictionaryState.results.length > 0 ? (
							<>
								{dictionaryState.results.length > 1 ? (
									<div className="mt-4 flex flex-wrap gap-2">
										{dictionaryState.results.map((entry, index) => (
											<button
												key={`${entry.word}-${entry.furigana}-${index}`}
												type="button"
												onClick={() => setSelectedDictionaryIndex(index)}
												className={`rounded-full border px-3 py-1 text-xs transition ${
													selectedDictionaryIndex === index
														? 'border-sky-400 bg-sky-500/20 text-sky-200'
														: 'border-slate-600 bg-slate-950 text-slate-300'
												}`}
											>
												{entry.word}
												{entry.furigana ? ` / ${entry.furigana}` : ''}
											</button>
										))}
									</div>
								) : null}

								{selectedDictionaryEntry ? (
									<div className="mt-4 rounded-3xl border border-sky-400/20 bg-sky-500/10 p-4">
										<DictionaryRubyText segments={selectedDictionaryEntry.segments} />
										<div className="mt-4 text-sm text-slate-200">
											<span className="text-slate-400">Reading:</span>{' '}
											{selectedDictionaryEntry.furigana || dictionaryState.articleReading}
										</div>

										{selectedDictionaryEntry.pos.length > 0 ? (
											<div className="mt-3 flex flex-wrap gap-2">
												{selectedDictionaryEntry.pos.map((pos) => (
													<span
														key={pos}
														className="rounded-full border border-sky-400/30 bg-sky-500/10 px-3 py-1 text-xs font-medium text-sky-100"
													>
														{pos}
													</span>
												))}
											</div>
										) : null}

										{selectedDictionaryEntry.meanings.length > 0 ? (
											<div className="mt-4 text-sm leading-relaxed text-slate-100">
												<span className="text-slate-400">Meaning:</span>{' '}
												{selectedDictionaryEntry.meanings.join(', ')}
											</div>
										) : null}
									</div>
								) : null}
							</>
						) : null}

						{dictionaryState &&
						!isLookingUp &&
						dictionaryState.query === selectedWord &&
						dictionaryState.results.length === 0 &&
						!lookupError ? (
							<div className="mt-4 rounded-2xl border border-dashed border-slate-700 bg-slate-950/50 px-4 py-4 text-sm text-slate-400">
								No dictionary entries found for &ldquo;{selectedWord}&rdquo;.
							</div>
						) : null}
					</div>
				</div>
			) : null}

			<div className="fixed bottom-4 left-1/2 z-50 w-[min(92vw,460px)] -translate-x-1/2 rounded-2xl border border-slate-600/80 bg-slate-900/90 p-3 shadow-2xl shadow-black/40 backdrop-blur">
				<div className="mb-2 text-center text-xs font-medium text-slate-300">
					Furigana Display
				</div>
				<div className="grid grid-cols-2 gap-2">
					<button
						type="button"
						onClick={() => setShowFurigana(true)}
						className={`rounded-xl border px-3 py-2 text-sm transition ${
							showFurigana
								? 'border-sky-400 bg-sky-500/20 text-sky-300'
								: 'border-slate-600 bg-slate-950 text-slate-200'
						}`}
					>
						ON
					</button>
					<button
						type="button"
						onClick={() => setShowFurigana(false)}
						className={`rounded-xl border px-3 py-2 text-sm transition ${
							!showFurigana
								? 'border-sky-400 bg-sky-500/20 text-sky-300'
								: 'border-slate-600 bg-slate-950 text-slate-200'
						}`}
					>
						OFF
					</button>
				</div>
			</div>
		</div>
	)
}
