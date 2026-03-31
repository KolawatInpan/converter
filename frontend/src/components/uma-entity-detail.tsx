import { ExternalLink } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import {
	fetchUmaEntityDetail,
	type UmaDbItem,
	type UmaEntityType,
} from '../api_caller/uma_database'

type UmaEntityDetailProps = {
	entity: UmaEntityType
	title: string
	description: string
	backTo: string
	backLabel: string
}

function entityLabel(entity: UmaEntityType) {
	if (entity === 'skills') return 'Skill'
	if (entity === 'supports') return 'Support Card'
	return 'Character'
}

export default function UmaEntityDetail({
	entity,
	title,
	description,
	backTo,
	backLabel,
}: UmaEntityDetailProps) {
	const { id } = useParams<{ id: string }>()
	const [item, setItem] = useState<UmaDbItem | null>(null)
	const [isLoading, setIsLoading] = useState(true)
	const [errorMessage, setErrorMessage] = useState<string | null>(null)

	useEffect(() => {
		const loadDetail = async () => {
			if (!id) {
				setErrorMessage('Missing item ID.')
				setIsLoading(false)
				return
			}

			setIsLoading(true)
			setErrorMessage(null)
			try {
				const detail = await fetchUmaEntityDetail(entity, id)
				setItem(detail)
			} catch (error) {
				setItem(null)
				setErrorMessage(
					error instanceof Error ? error.message : `Failed to load ${entityLabel(entity)} detail.`,
				)
			} finally {
				setIsLoading(false)
			}
		}

		void loadDetail()
	}, [entity, id])

	return (
		<div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.14),transparent_28%),linear-gradient(180deg,#020617_0%,#0f172a_45%,#111827_100%)] px-6 py-10 text-slate-100">
			<div className="mx-auto max-w-5xl">
				<div className="mb-6 flex flex-wrap items-center gap-3">
					<Link
						to={backTo}
						className="inline-flex rounded-xl border border-slate-600 px-4 py-2 text-sm text-slate-200 transition hover:bg-slate-800"
					>
						{backLabel}
					</Link>
					{item?.url ? (
						<a
							href={item.url}
							target="_blank"
							rel="noreferrer"
							className="inline-flex items-center gap-2 rounded-xl border border-sky-500/40 bg-sky-500/10 px-4 py-2 text-sm font-semibold text-sky-200 transition hover:bg-sky-500/20"
						>
							Open on GameTora
							<ExternalLink className="h-4 w-4" />
						</a>
					) : null}
				</div>

				{isLoading ? (
					<div className="rounded-3xl border border-slate-700/80 bg-slate-900/60 px-6 py-12 text-center text-slate-400">
						Loading {title.toLowerCase()} detail...
					</div>
				) : errorMessage || !item ? (
					<div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-4 text-sm text-rose-100">
						{errorMessage || `${entityLabel(entity)} not found.`}
					</div>
				) : (
					<div className="rounded-3xl border border-slate-700/80 bg-slate-900/75 p-6 shadow-xl shadow-black/20 ring-1 ring-white/5">
						<div className="mb-6 text-xs font-semibold uppercase tracking-[0.22em] text-sky-300">
							GameTora Source
						</div>
						<div className="grid gap-6 lg:grid-cols-[220px,1fr]">
							<div className="overflow-hidden rounded-3xl border border-slate-700 bg-slate-950">
								{item.imageUrl ? (
									<img
										src={item.imageUrl}
										alt={item.name}
										loading="lazy"
										className="h-full w-full object-cover"
									/>
								) : (
									<div className="flex min-h-[220px] items-center justify-center px-6 text-center text-sm uppercase tracking-[0.3em] text-slate-500">
										{entityLabel(entity)}
									</div>
								)}
							</div>

							<div>
								<div className="text-sm uppercase tracking-[0.22em] text-slate-400">{title}</div>
								<h1 className="mt-2 text-3xl font-bold text-slate-50">{item.name}</h1>
								{item.jpName ? (
									<div className="mt-2 text-lg text-slate-300">{item.jpName}</div>
								) : null}
								<p className="mt-4 max-w-3xl text-sm leading-relaxed text-slate-300">
									{description}
								</p>

								<div className="mt-6 grid gap-4 md:grid-cols-2">
									<div className="rounded-2xl border border-slate-700 bg-slate-950/70 p-4">
										<div className="text-xs uppercase tracking-[0.2em] text-slate-400">Subtitle</div>
										<div className="mt-2 text-base font-semibold text-slate-100">
											{item.subtitle || '-'}
										</div>
									</div>
									<div className="rounded-2xl border border-slate-700 bg-slate-950/70 p-4">
										<div className="text-xs uppercase tracking-[0.2em] text-slate-400">Rarity</div>
										<div className="mt-2 text-base font-semibold text-slate-100">
											{item.rarity || '-'}
										</div>
									</div>
									<div className="rounded-2xl border border-slate-700 bg-slate-950/70 p-4">
										<div className="text-xs uppercase tracking-[0.2em] text-slate-400">Type</div>
										<div className="mt-2 text-base font-semibold text-slate-100">
											{item.typeLabel || '-'}
										</div>
									</div>
									<div className="rounded-2xl border border-slate-700 bg-slate-950/70 p-4">
										<div className="text-xs uppercase tracking-[0.2em] text-slate-400">ID</div>
										<div className="mt-2 break-all text-base font-semibold text-slate-100">
											{item.id || '-'}
										</div>
									</div>
								</div>

								<div className="mt-4 rounded-2xl border border-slate-700 bg-slate-950/70 p-4">
									<div className="text-xs uppercase tracking-[0.2em] text-slate-400">Description</div>
									<p className="mt-2 text-sm leading-relaxed text-slate-200">
										{item.description || 'No summary description available in the cached GameTora data yet.'}
									</p>
								</div>

								<div className="mt-4 rounded-2xl border border-slate-700 bg-slate-950/70 p-4">
									<div className="text-xs uppercase tracking-[0.2em] text-slate-400">Source</div>
									<div className="mt-2 text-sm text-slate-300">
										{item.source || 'GameTora'} cached in the app for faster search and browsing.
									</div>
								</div>
							</div>
						</div>
					</div>
				)}
			</div>
		</div>
	)
}
