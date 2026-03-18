import { useState, type FormEvent } from 'react'

import {
	sentenceBreakdownApi,
	type SentenceBreakdownResponse,
	type SentenceToken,
} from '../api_caller/sentence_breakdown'

const DEFAULT_TEXT = 'これは一番人気の商品です。京都大学も東京大学に負けないくらい人気があります。'

function TokenCard({ token }: { token: SentenceToken }) {
	return (
		<div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/8 p-4">
			<div className="text-2xl font-semibold text-emerald-100">{token.surface}</div>
			<div className="mt-1 text-sm text-emerald-200/85">{token.reading}</div>
			<div className="mt-4 grid gap-2 text-sm text-slate-200">
				<div>
					<span className="text-slate-400">Base:</span> {token.base}
				</div>
				<div>
					<span className="text-slate-400">Base reading:</span> {token.base_reading}
				</div>
				<div>
					<span className="text-slate-400">POS:</span> {token.pos}
				</div>
				{token.dictionary_pos.length > 0 ? (
					<div>
						<span className="text-slate-400">Dictionary POS:</span> {token.dictionary_pos.join(', ')}
					</div>
				) : null}
				{token.meanings.length > 0 ? (
					<div>
						<span className="text-slate-400">Meaning:</span> {token.meanings.join(', ')}
					</div>
				) : null}
			</div>
		</div>
	)
}

export default function SentenceBreakdownPage() {
	const [input, setInput] = useState(DEFAULT_TEXT)
	const [result, setResult] = useState<SentenceBreakdownResponse | null>(null)
	const [isLoading, setIsLoading] = useState(false)
	const [errorMessage, setErrorMessage] = useState<string | null>(null)

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault()

		const trimmedInput = input.trim()
		if (!trimmedInput) {
			setResult(null)
			setErrorMessage('Please enter a Japanese sentence first.')
			return
		}

		setIsLoading(true)
		setErrorMessage(null)

		try {
			const response = await sentenceBreakdownApi(trimmedInput)
			setResult(response)
		} catch (error) {
			setResult(null)
			setErrorMessage(
				error instanceof Error ? error.message : 'Unable to analyze the sentence right now.',
			)
		} finally {
			setIsLoading(false)
		}
	}

	return (
		<div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.16),transparent_32%),linear-gradient(180deg,#0f172a_0%,#111827_52%,#020617_100%)] px-6 py-10 text-slate-100">
			<div className="mx-auto max-w-6xl">
				<div className="mb-8">
					<h1 className="text-3xl font-bold text-slate-100">Sentence Breakdown</h1>
					<p className="mt-2 max-w-3xl text-sm text-slate-300">
						Paste a Japanese sentence and break it down into surface form, dictionary form,
						reading, part of speech, and meaning.
					</p>
				</div>

				<div className="grid gap-8 lg:grid-cols-[1fr_1.2fr]">
					<section className="rounded-3xl border border-slate-700/80 bg-slate-900/75 p-6 shadow-xl shadow-black/20 ring-1 ring-white/5">
						<form onSubmit={handleSubmit}>
							<label className="block">
								<span className="mb-3 block text-sm font-medium text-slate-300">Japanese text</span>
								<textarea
									rows={12}
									value={input}
									onChange={(event) => setInput(event.target.value)}
									placeholder="これは一番人気の商品です。"
									className="w-full rounded-2xl border border-slate-600 bg-slate-950 px-4 py-3 text-base text-slate-100 outline-none transition focus:border-emerald-400"
								/>
							</label>

							<div className="mt-6 flex items-center gap-3">
								<button
									type="submit"
									disabled={isLoading}
									className="rounded-2xl bg-emerald-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-70"
								>
									{isLoading ? 'Analyzing...' : 'Break Down Sentence'}
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
							<h2 className="text-lg font-semibold text-slate-100">Tokens</h2>
							<span className="rounded-full border border-slate-700 bg-slate-950/70 px-3 py-1 text-xs text-slate-300">
								{result?.tokens.length ?? 0} items
							</span>
						</div>

						{result && result.tokens.length > 0 ? (
							<div className="mt-5 grid gap-4 sm:grid-cols-2">
								{result.tokens.map((token, index) => (
									<TokenCard key={`${token.surface}-${index}`} token={token} />
								))}
							</div>
						) : null}

						{!result && !errorMessage ? (
							<div className="mt-5 rounded-2xl border border-dashed border-slate-700 bg-slate-950/50 px-4 py-6 text-sm text-slate-400">
								Analyze a sentence to see token-by-token breakdown here.
							</div>
						) : null}
					</section>
				</div>
			</div>
		</div>
	)
}
