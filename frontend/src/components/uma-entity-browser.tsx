import { ArrowDown, ArrowUp, ChevronRight, ExternalLink, RotateCcw } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import {
	fetchLegacySkillList,
	fetchUmaEntityList,
	getUmaEntityRoute,
	type UmaDbItem,
	type UmaEntityType,
} from '../api_caller/uma_database'

type UmaEntityBrowserProps = {
	entity: UmaEntityType
	title: string
	description: string
}

type SortKey = 'name' | 'rarity' | 'type'
type SortDirection = 'asc' | 'desc'

function entityLabel(entity: UmaEntityType) {
	if (entity === 'skills') return 'Skill'
	if (entity === 'supports') return 'Support'
	return 'Character'
}

function normalizeRarity(value?: string): string {
	const normalized = (value ?? '').trim().toLowerCase()
	if (!normalized) return 'Unknown'
	if (normalized === 'gold' || normalized === 'rare') return 'Rare'
	if (normalized === 'evolution') return 'Evolved'
	return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}

function getRarityRank(value?: string): number {
	const normalized = normalizeRarity(value)
	if (normalized === 'Unique') return 5
	if (normalized === 'Evolved') return 4
	if (normalized === 'Rare') return 3
	if (normalized === 'Normal') return 2
	if (normalized === 'Unknown') return 0
	return 1
}

function deriveCharacterFilter(item: UmaDbItem): string {
	const parts = (item.subtitle ?? '')
		.split('/')
		.map((part) => part.trim())
		.filter(Boolean)

	for (const part of parts) {
		if (!/^\d+\*$/.test(part)) {
			return part
		}
	}

	return 'Other'
}

function getFilterLabel(entity: UmaEntityType, item: UmaDbItem): string {
	if (entity === 'supports') {
		return item.typeLabel || 'Other'
	}
	if (entity === 'characters') {
		return deriveCharacterFilter(item)
	}
	return item.typeLabel || 'Other'
}

function getSearchPlaceholder(entity: UmaEntityType): string {
	if (entity === 'supports') return 'Search by character name'
	if (entity === 'characters') return 'Search characters'
	return 'Search by skill name'
}

function getSortLabel(entity: UmaEntityType, sortKey: SortKey): string {
	if (sortKey === 'rarity') return 'Rarity'
	if (sortKey === 'type') {
		return entity === 'supports' ? 'Support type' : entity === 'characters' ? 'Category' : 'Skill type'
	}
	return 'Name'
}

function getDefaultSortKey(entity: UmaEntityType): SortKey {
	return entity === 'skills' ? 'type' : 'rarity'
}

function getDefaultSortDirection(entity: UmaEntityType): SortDirection {
	return entity === 'skills' ? 'asc' : 'desc'
}

function getSortValue(item: UmaDbItem, sortKey: SortKey, entity: UmaEntityType): string | number {
	if (sortKey === 'rarity') {
		return getRarityRank(item.rarity)
	}
	if (sortKey === 'type') {
		return getFilterLabel(entity, item).toLowerCase()
	}
	return item.name.toLowerCase()
}

export default function UmaEntityBrowser({
	entity,
	title,
	description,
}: UmaEntityBrowserProps) {
	const [items, setItems] = useState<UmaDbItem[]>([])
	const [searchQuery, setSearchQuery] = useState('')
	const [sortKey, setSortKey] = useState<SortKey>(getDefaultSortKey(entity))
	const [sortDirection, setSortDirection] = useState<SortDirection>(getDefaultSortDirection(entity))
	const [selectedRarity, setSelectedRarity] = useState('All')
	const [selectedFilter, setSelectedFilter] = useState('All')
	const [useLegacySkillText, setUseLegacySkillText] = useState(false)
	const [isLoading, setIsLoading] = useState(true)
	const [errorMessage, setErrorMessage] = useState<string | null>(null)

	useEffect(() => {
		setSortKey(getDefaultSortKey(entity))
		setSortDirection(getDefaultSortDirection(entity))
		setSelectedRarity('All')
		setSelectedFilter('All')
	}, [entity])

	useEffect(() => {
		const loadItems = async () => {
			setIsLoading(true)
			setErrorMessage(null)
			try {
				const fetched =
					entity === 'skills' && useLegacySkillText
						? await fetchLegacySkillList()
						: await fetchUmaEntityList(entity)
				setItems(fetched)
			} catch (error) {
				setItems([])
				setErrorMessage(error instanceof Error ? error.message : `Failed to load ${entity}.`)
			} finally {
				setIsLoading(false)
			}
		}

		void loadItems()
	}, [entity, useLegacySkillText])

	const rarityOptions = useMemo(() => {
		const values = Array.from(new Set(items.map((item) => normalizeRarity(item.rarity)).filter(Boolean)))
		values.sort((a, b) => getRarityRank(b) - getRarityRank(a) || a.localeCompare(b))
		return ['All', ...values]
	}, [items])

	const filterOptions = useMemo(() => {
		const counts = new Map<string, number>()
		for (const item of items) {
			const label = getFilterLabel(entity, item)
			counts.set(label, (counts.get(label) ?? 0) + 1)
		}

		return Array.from(counts.entries())
			.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
			.slice(0, entity === 'characters' ? 8 : 10)
			.map(([label]) => label)
	}, [entity, items])

	const filteredItems = useMemo(() => {
		const normalizedQuery = searchQuery.trim().toLowerCase()

		const nextItems = items.filter((item) => {
			if (normalizedQuery) {
				const haystack = [
					item.name,
					item.jpName,
					item.subtitle,
					item.description,
					item.rarity,
					item.typeLabel,
				]
					.join(' ')
					.toLowerCase()

				if (!haystack.includes(normalizedQuery)) {
					return false
				}
			}

			if (selectedRarity !== 'All' && normalizeRarity(item.rarity) !== selectedRarity) {
				return false
			}

			if (selectedFilter !== 'All' && getFilterLabel(entity, item) !== selectedFilter) {
				return false
			}

			return true
		})

		nextItems.sort((left, right) => {
			const leftValue = getSortValue(left, sortKey, entity)
			const rightValue = getSortValue(right, sortKey, entity)

			if (typeof leftValue === 'number' && typeof rightValue === 'number') {
				return sortDirection === 'asc' ? leftValue - rightValue : rightValue - leftValue
			}

			const comparison = String(leftValue).localeCompare(String(rightValue))
			return sortDirection === 'asc' ? comparison : -comparison
		})

		return nextItems
	}, [entity, items, searchQuery, selectedFilter, selectedRarity, sortDirection, sortKey])

	const resetFilters = () => {
		setSearchQuery('')
		setSortKey(getDefaultSortKey(entity))
		setSortDirection(getDefaultSortDirection(entity))
		setSelectedRarity('All')
		setSelectedFilter('All')
	}

	return (
		<div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.14),transparent_30%),linear-gradient(180deg,#020617_0%,#0f172a_45%,#111827_100%)] px-6 py-10 text-slate-100">
			<div className="mx-auto max-w-7xl">
				<div className="mb-8">
					<div className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-300">
						GameTora Source
					</div>
					<h1 className="mt-2 text-3xl font-bold text-slate-50">{title}</h1>
					<p className="mt-2 max-w-4xl text-sm text-slate-300">{description}</p>
				</div>

				<div className="mb-6 rounded-3xl border border-slate-700/80 bg-slate-900/70 p-5 shadow-xl shadow-black/20 ring-1 ring-white/5">
					<div className="flex flex-wrap items-center justify-between gap-3">
						<div className="text-lg font-semibold text-slate-100">
							{entity === 'supports'
								? 'Support Card List'
								: entity === 'characters'
									? 'Character List'
									: 'Skill List'}
						</div>
						<button
							type="button"
							onClick={resetFilters}
							className="inline-flex items-center gap-2 rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200 transition hover:bg-rose-500/20"
						>
							<RotateCcw className="h-4 w-4" />
							Reset filters
						</button>
					</div>

					{entity === 'skills' ? (
						<div className="mt-5 rounded-2xl border border-slate-700 bg-slate-950/60 p-4">
							<div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
								Settings
							</div>
							<label className="mt-3 flex items-center gap-3 text-sm text-slate-200">
								<input
									type="checkbox"
									checked={useLegacySkillText}
									onChange={(event) => setUseLegacySkillText(event.target.checked)}
									className="h-4 w-4 rounded border-slate-600 bg-slate-950 text-sky-400"
								/>
								<span>Use old names and descriptions (ignore Global)</span>
							</label>
						</div>
					) : null}

					<div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto]">
						<div>
							<div className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
								Search
							</div>
							<input
								type="text"
								value={searchQuery}
								onChange={(event) => setSearchQuery(event.target.value)}
								placeholder={getSearchPlaceholder(entity)}
								className="w-full rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-sky-400"
							/>
						</div>

						<div>
							<div className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
								Sort by
							</div>
							<select
								value={sortKey}
								onChange={(event) => setSortKey(event.target.value as SortKey)}
								className="w-full rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-sky-400"
							>
								<option value="rarity">Rarity</option>
								<option value="type">{getSortLabel(entity, 'type')}</option>
								<option value="name">Name</option>
							</select>
						</div>

						<div>
							<div className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
								Direction
							</div>
							<button
								type="button"
								onClick={() =>
									setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'))
								}
								className="inline-flex h-[50px] w-full items-center justify-center gap-2 rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-sm text-slate-100 transition hover:border-sky-400"
							>
								{sortDirection === 'asc' ? (
									<>
										Ascending
										<ArrowUp className="h-4 w-4" />
									</>
								) : (
									<>
										Descending
										<ArrowDown className="h-4 w-4" />
									</>
								)}
							</button>
						</div>
					</div>

					<div className="mt-4 grid gap-4 md:grid-cols-2">
						<div>
							<div className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
								Rarity
							</div>
							<select
								value={selectedRarity}
								onChange={(event) => setSelectedRarity(event.target.value)}
								className="w-full rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-sky-400"
							>
								{rarityOptions.map((option) => (
									<option key={option} value={option}>
										{option}
									</option>
								))}
							</select>
						</div>

						<div>
							<div className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
								Filters
							</div>
							<div className="flex flex-wrap gap-2">
								<button
									type="button"
									onClick={() => setSelectedFilter('All')}
									className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
										selectedFilter === 'All'
											? 'border-sky-400 bg-sky-500/20 text-sky-200'
											: 'border-slate-700 bg-slate-950/70 text-slate-300 hover:border-slate-500'
									}`}
								>
									All
								</button>
								{filterOptions.map((option) => (
									<button
										key={option}
										type="button"
										onClick={() => setSelectedFilter(option)}
										className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
											selectedFilter === option
												? 'border-emerald-400 bg-emerald-500/20 text-emerald-200'
												: 'border-slate-700 bg-slate-950/70 text-slate-300 hover:border-slate-500'
										}`}
									>
										{option}
									</button>
								))}
							</div>
						</div>
					</div>
				</div>

				{errorMessage ? (
					<div className="mb-6 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-4 text-sm text-rose-100">
						{errorMessage}
					</div>
				) : null}

				{isLoading ? (
					<div className="rounded-3xl border border-slate-700/80 bg-slate-900/60 px-6 py-12 text-center text-slate-400">
						Loading {title.toLowerCase()}...
					</div>
				) : (
					<>
						<div className="mb-4 text-sm text-slate-400">
							Showing {filteredItems.length} of {items.length} {title.toLowerCase()}
						</div>
						<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
							{filteredItems.map((item) => (
								<Link
									key={`${entity}-${item.id}`}
									to={getUmaEntityRoute(entity, item.id)}
									className="group flex gap-4 rounded-3xl border border-slate-700/80 bg-slate-900/70 p-4 shadow-xl shadow-black/20 ring-1 ring-white/5 transition hover:border-sky-400/40 hover:bg-slate-900"
								>
									<div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-700 bg-slate-950">
										{item.imageUrl ? (
											<img
												src={item.imageUrl}
												alt={item.name}
												loading="lazy"
												className="h-full w-full object-cover"
											/>
										) : (
											<span className="px-2 text-center text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
												{entityLabel(entity)}
											</span>
										)}
									</div>
									<div className="min-w-0 flex-1">
										<div className="flex items-start justify-between gap-3">
											<div className="min-w-0">
												<h2 className="truncate text-lg font-semibold text-slate-100 group-hover:text-sky-200">
													{item.name}
												</h2>
												<div className="mt-1 text-sm text-slate-400">{item.jpName || '-'}</div>
											</div>
											<ChevronRight className="mt-1 h-4 w-4 shrink-0 text-slate-500 group-hover:text-sky-300" />
										</div>
										<div className="mt-3 flex flex-wrap gap-2">
											{item.rarity ? (
												<div className="inline-flex rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-xs font-medium text-sky-200">
													{normalizeRarity(item.rarity)}
												</div>
											) : null}
											{getFilterLabel(entity, item) ? (
												<div className="inline-flex rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-200">
													{getFilterLabel(entity, item)}
												</div>
											) : null}
										</div>
										{item.description ? (
											<p className="mt-3 line-clamp-3 text-sm leading-relaxed text-slate-300">
												{item.description}
											</p>
										) : null}
										<div className="mt-4 flex items-center justify-between text-xs text-slate-500">
											<span>Open detail in app</span>
											{item.url ? (
												<span className="inline-flex items-center gap-1 text-sky-300/80">
													GameTora available
													<ExternalLink className="h-3.5 w-3.5" />
												</span>
											) : null}
										</div>
									</div>
								</Link>
							))}
						</div>
						{!filteredItems.length ? (
							<div className="mt-6 rounded-3xl border border-slate-700/80 bg-slate-900/60 px-6 py-10 text-center text-slate-400">
								No matching {title.toLowerCase()} found.
							</div>
						) : null}
					</>
				)}
			</div>
		</div>
	)
}
