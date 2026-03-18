import { Grid2x2, Search } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { AppFont } from '../App'
import { Link } from 'react-router-dom'
import { toolRoutes, tools } from '../data/tools'
import { lookupDictionaryApi, type DictionaryEntry } from '../api_caller/dictionary'

type NavbarProps = {
	appFont: AppFont
	onFontChange: (font: AppFont) => void
}

type SearchMode = 'words' | 'tools'

const WORD_SEARCH_DELAY_MS = 250

function Navbar({ appFont, onFontChange }: NavbarProps) {
	const [searchTerm, setSearchTerm] = useState('')
	const [searchMode, setSearchMode] = useState<SearchMode>('tools')
	const [isSearchOpen, setIsSearchOpen] = useState(false)
	const [wordResults, setWordResults] = useState<DictionaryEntry[]>([])
	const [isWordLoading, setIsWordLoading] = useState(false)
	const [wordErrorMessage, setWordErrorMessage] = useState<string | null>(null)
	const [isComposing, setIsComposing] = useState(false)
	const searchContainerRef = useRef<HTMLDivElement | null>(null)

	const filteredTools = useMemo(() => {
		const normalizedSearch = searchTerm.trim().toLowerCase()

		if (!normalizedSearch) {
			return []
		}

		return tools
			.filter((tool) => tool.toLowerCase().includes(normalizedSearch))
			.slice(0, 8)
	}, [searchTerm])

	useEffect(() => {
		function handlePointerDown(event: MouseEvent) {
			if (!searchContainerRef.current?.contains(event.target as Node)) {
				setIsSearchOpen(false)
			}
		}

		document.addEventListener('mousedown', handlePointerDown)
		return () => {
			document.removeEventListener('mousedown', handlePointerDown)
		}
	}, [])

	useEffect(() => {
		if (searchMode !== 'words') {
			setWordResults([])
			setIsWordLoading(false)
			setWordErrorMessage(null)
			return
		}

		if (isComposing) {
			return
		}

		const trimmedSearch = searchTerm.trim()
		if (!trimmedSearch) {
			setWordResults([])
			setIsWordLoading(false)
			setWordErrorMessage(null)
			return
		}

		let isCancelled = false
		const timeoutId = window.setTimeout(async () => {
			setIsWordLoading(true)
			setWordErrorMessage(null)

			try {
				const response = await lookupDictionaryApi(trimmedSearch)
				if (isCancelled) {
					return
				}
				setWordResults(response.results.slice(0, 6))
			} catch (error) {
				if (isCancelled) {
					return
				}
				setWordResults([])
				setWordErrorMessage(
					error instanceof Error ? error.message : 'Unable to search words right now.',
				)
			} finally {
				if (!isCancelled) {
					setIsWordLoading(false)
				}
			}
		}, WORD_SEARCH_DELAY_MS)

		return () => {
			isCancelled = true
			window.clearTimeout(timeoutId)
		}
	}, [isComposing, searchMode, searchTerm])

	const shouldShowDropdown = isSearchOpen

	return (
		<header className="sticky top-0 z-50 border-b border-slate-700/80 bg-slate-950/85 backdrop-blur">
			<div className="mx-auto flex min-h-16 w-full max-w-7xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
				<Link
					to="/"
					className="text-2xl font-bold tracking-tight text-slate-100 transition hover:text-sky-400 sm:text-3xl"
				>
					Converter Tool
				</Link>
				<Link
					to="/all-tools"
					className="inline-flex items-center gap-2 text-sm font-medium text-slate-300 transition hover:text-sky-300"
				>
					<Grid2x2 className="h-4 w-4" />
					All Tools
				</Link>
				<div ref={searchContainerRef} className="relative ml-auto w-full max-w-md">
					<div className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm text-slate-200 transition focus-within:border-sky-400">
						<Search className="h-4 w-4 text-slate-400" />
						<input
							type="text"
							value={searchTerm}
							onChange={(e) => setSearchTerm(e.target.value)}
							onCompositionStart={() => setIsComposing(true)}
							onCompositionEnd={(e) => {
								setIsComposing(false)
								setSearchTerm(e.currentTarget.value)
							}}
							onFocus={() => setIsSearchOpen(true)}
							lang="ja"
							autoCorrect="off"
							autoCapitalize="none"
							spellCheck={false}
							enterKeyHint="search"
							placeholder={searchMode === 'tools' ? 'Search tools' : 'Search words'}
							className="w-full bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500"
						/>
					</div>
					{shouldShowDropdown ? (
						<div className="absolute left-0 right-0 top-12 rounded-2xl border border-slate-700/80 bg-slate-900/95 p-2 shadow-2xl shadow-black/30 ring-1 ring-white/5">
							<div className="mb-2 flex rounded-xl border border-slate-700 bg-slate-950/70 p-1">
								<button
									type="button"
									onClick={() => setSearchMode('words')}
									className={`flex-1 rounded-lg px-3 py-1.5 text-sm transition ${
										searchMode === 'words'
											? 'bg-sky-500 text-slate-950'
											: 'text-slate-300 hover:bg-slate-800'
									}`}
								>
									Words
								</button>
								<button
									type="button"
									onClick={() => setSearchMode('tools')}
									className={`flex-1 rounded-lg px-3 py-1.5 text-sm transition ${
										searchMode === 'tools'
											? 'bg-sky-500 text-slate-950'
											: 'text-slate-300 hover:bg-slate-800'
									}`}
								>
									Tools
								</button>
							</div>

							{searchMode === 'tools' ? (
								filteredTools.length > 0 ? (
									filteredTools.map((tool) => {
										const route = toolRoutes[tool]

										if (route) {
											return (
												<Link
													key={tool}
													to={route}
													onClick={() => {
														setSearchTerm('')
														setIsSearchOpen(false)
													}}
													className="flex items-center justify-between rounded-xl px-3 py-2 text-sm text-slate-200 transition hover:bg-slate-800 hover:text-sky-300"
												>
													<span>{tool}</span>
													<span className="text-xs uppercase tracking-[0.2em] text-slate-500">Open</span>
												</Link>
											)
										}

										return (
											<div
												key={tool}
												className="flex items-center justify-between rounded-xl px-3 py-2 text-sm text-slate-500"
											>
												<span>{tool}</span>
												<span className="text-xs uppercase tracking-[0.2em]">Coming soon</span>
											</div>
										)
									})
								) : (
									<div className="rounded-xl px-3 py-2 text-sm text-slate-500">
										No matching tools found.
									</div>
								)
							) : (
								<>
									{isWordLoading ? (
										<div className="rounded-xl px-3 py-2 text-sm text-slate-400">
											Searching words...
										</div>
									) : null}
									{!isWordLoading && wordErrorMessage ? (
										<div className="rounded-xl px-3 py-2 text-sm text-rose-300">
											{wordErrorMessage}
										</div>
									) : null}
									{!isWordLoading && !wordErrorMessage && wordResults.length > 0 ? (
										wordResults.map((entry, index) => (
											<Link
												key={`${entry.word}-${entry.furigana}-${index}`}
												to={`/dictionary?query=${encodeURIComponent(entry.word)}`}
												onClick={() => {
													setSearchTerm('')
													setIsSearchOpen(false)
												}}
												className="block rounded-xl px-3 py-2 text-sm text-slate-200 transition hover:bg-slate-800 hover:text-sky-300"
											>
												<div className="flex items-center justify-between gap-3">
													<span className="font-medium text-slate-100">{entry.word}</span>
													<span className="text-xs text-emerald-300">{entry.furigana}</span>
												</div>
												<div className="mt-1 text-xs text-slate-400">
													{entry.pos.join(' | ')}
												</div>
												<div className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-300">
													{entry.meanings.join(', ')}
												</div>
											</Link>
										))
									) : null}
									{!isWordLoading && !wordErrorMessage && searchTerm.trim() && wordResults.length === 0 ? (
										<div className="rounded-xl px-3 py-2 text-sm text-slate-500">
											No matching words found.
										</div>
									) : null}
									{!searchTerm.trim() ? (
										<div className="rounded-xl px-3 py-2 text-sm text-slate-500">
											Type a Japanese word to search the dictionary.
										</div>
									) : null}
								</>
							)}
						</div>
					) : null}
				</div>
				<details className="relative">
					<summary className="cursor-pointer list-none rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm text-slate-200 transition hover:border-sky-400 hover:text-sky-300">
						Settings
					</summary>
					<div className="absolute right-0 top-12 w-64 rounded-2xl border border-slate-700/80 bg-slate-900/95 p-4 shadow-2xl shadow-black/30 ring-1 ring-white/5">
						<label className="block">
							<span className="mb-2 block text-xs font-medium uppercase tracking-[0.2em] text-slate-400">App Font</span>
							<select
								value={appFont}
								onChange={(e) => onFontChange(e.target.value as AppFont)}
								className="w-full rounded-xl border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-sky-400"
							>
								<option value="klee-regular">Klee One Regular</option>
								<option value="klee-semibold">Klee One SemiBold</option>
							</select>
						</label>
					</div>
				</details>
			</div>
		</header>
	)
}

export default Navbar
