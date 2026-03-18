import { useEffect, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'

import {
	lookupDictionaryApi,
	type DictionaryEntry,
	type DictionaryLookupResponse,
	type DictionarySegment,
} from '../api_caller/dictionary'

function RubyText({ segments }: { segments?: DictionarySegment[] }) {
	const safeSegments = Array.isArray(segments) ? segments : []

	if (safeSegments.length === 0) {
		return null
	}

	return (
		<div className="flex flex-wrap items-end gap-x-2 gap-y-4 text-4xl font-semibold tracking-wide text-emerald-100">
			{safeSegments.map((segment, index) => (
				<ruby key={`${segment.text}-${index}`} className="ruby-word">
					{segment.text}
					{segment.furigana ? (
						<rt className="ruby-reading text-sm font-medium text-emerald-200/90">
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
		<div className="rounded-3xl border border-emerald-400/25 bg-emerald-500/8 p-5">
			<div className="text-xs uppercase tracking-[0.24em] text-emerald-200/70">Dictionary Entry</div>
			<div className="mt-6">
				<RubyText segments={entry.segments} />
			</div>
			<div className="mt-4 text-sm text-emerald-100/85">
				<span className="text-emerald-200/70">Word:</span> {entry.word}
			</div>
			<div className="mt-1 text-sm text-emerald-100/85">
				<span className="text-emerald-200/70">Reading:</span> {entry.furigana}
			</div>

			{entry.pos.length > 0 ? (
				<div className="mt-4 flex flex-wrap gap-2">
					{entry.pos.map((pos) => (
						<span
							key={pos}
							className="rounded-full border border-sky-400/30 bg-sky-500/10 px-3 py-1 text-xs font-medium text-sky-100"
						>
							{pos}
						</span>
					))}
				</div>
			) : null}

			{entry.meanings.length > 0 ? (
				<div className="mt-5 border-t border-emerald-300/12 pt-4">
					<div className="mb-3 text-xs uppercase tracking-[0.24em] text-emerald-200/70">
						Meanings
					</div>
					<ul className="space-y-2 text-sm leading-relaxed text-slate-100">
						{entry.meanings.map((meaning, index) => (
							<li
								key={`${entry.word}-meaning-${index}`}
								className="rounded-2xl bg-slate-950/35 px-4 py-3"
							>
								{meaning}
							</li>
						))}
					</ul>
				</div>
			) : null}
		</div>
	)
}

export default function DictionaryPage() {
	const [searchParams, setSearchParams] = useSearchParams()
	const [query, setQuery] = useState(searchParams.get('query') ?? '')
	const [result, setResult] = useState<DictionaryLookupResponse | null>(null)
	const [isLoading, setIsLoading] = useState(false)
	const [errorMessage, setErrorMessage] = useState<string | null>(null)

	async function runLookup(rawQuery: string) {
		const trimmedQuery = rawQuery.trim()
		if (!trimmedQuery) {
			setResult(null)
			setErrorMessage(null)
			setSearchParams({})
			return
		}

		setIsLoading(true)
		setErrorMessage(null)

		try {
			const response = await lookupDictionaryApi(trimmedQuery)
			setResult(response)
			setSearchParams({ query: trimmedQuery })
		} catch (error) {
			setResult(null)
			setErrorMessage(
				error instanceof Error ? error.message : 'Unable to search the dictionary right now.',
			)
		} finally {
			setIsLoading(false)
		}
	}

	useEffect(() => {
		const queryFromUrl = searchParams.get('query') ?? ''

		if (!queryFromUrl) {
			return
		}

		setQuery(queryFromUrl)
		void runLookup(queryFromUrl)
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [searchParams])

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault()
		await runLookup(query)
	}

	return (
		<div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(14,165,233,0.18),transparent_30%),linear-gradient(180deg,#0f172a_0%,#111827_45%,#020617_100%)] px-6 py-10 text-slate-100">
			<div className="mx-auto max-w-5xl">
				<div className="mb-8">
					<h1 className="text-3xl font-bold text-slate-100">Dictionary</h1>
					<p className="mt-2 max-w-3xl text-sm text-slate-300">
						Search a Japanese word and get dictionary-style results with furigana,
						part of speech, and meanings.
					</p>
				</div>

				<div className="grid gap-8 lg:grid-cols-[1fr_1.15fr]">
					<section className="rounded-3xl border border-slate-700/80 bg-slate-900/75 p-6 shadow-xl shadow-black/20 ring-1 ring-white/5">
						<form onSubmit={handleSubmit}>
							<label className="block">
								<span className="mb-3 block text-sm font-medium text-slate-300">Search word</span>
								<input
									type="text"
									value={query}
									onChange={(event) => setQuery(event.target.value)}
									placeholder="Search Japanese words"
									className="w-full rounded-2xl border border-slate-600 bg-slate-950 px-4 py-3 text-lg text-slate-100 outline-none transition focus:border-sky-400"
								/>
							</label>

							<div className="mt-6 flex items-center gap-3">
								<button
									type="submit"
									disabled={isLoading}
									className="rounded-2xl bg-sky-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-70"
								>
									{isLoading ? 'Searching...' : 'Search Dictionary'}
								</button>
							</div>
						</form>

						{errorMessage ? (
							<div className="mt-5 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-4 text-sm text-rose-100">
								{errorMessage}
							</div>
						) : null}
					</section>

					<section className="rounded-3xl border border-slate-700/80 bg-slate-900/75 p-6 shadow-xl shadow-black/20 ring-1 ring-white/5">
						<div className="flex items-center justify-between gap-3">
							<h2 className="text-lg font-semibold text-slate-100">Results</h2>
							<span className="rounded-full border border-slate-700 bg-slate-950/70 px-3 py-1 text-xs text-slate-300">
								{result?.results.length ?? 0} items
							</span>
						</div>

						{result && result.results.length > 0 ? (
							<div className="mt-5 space-y-4">
								{result.results.map((entry, index) => (
									<DictionaryCard key={`${entry.word}-${index}`} entry={entry} />
								))}
							</div>
						) : null}

						{result && result.results.length === 0 && !errorMessage ? (
							<div className="mt-5 rounded-2xl border border-dashed border-slate-700 bg-slate-950/50 px-4 py-6 text-sm text-slate-400">
								No dictionary entries found for &ldquo;{result.query}&rdquo;.
							</div>
						) : null}

						{!result && !errorMessage ? (
							<div className="mt-5 rounded-2xl border border-dashed border-slate-700 bg-slate-950/50 px-4 py-6 text-sm text-slate-400">
								Search a word to see dictionary results here.
							</div>
						) : null}
					</section>
				</div>
			</div>
		</div>
	)
}
