import { useMemo, useState } from 'react'

import { radicals, type RadicalEntry } from '../data/radicals'

function RadicalCard({ radical }: { radical: RadicalEntry }) {
	return (
		<div className="rounded-3xl border border-amber-400/25 bg-amber-500/8 p-5 shadow-lg shadow-black/10">
			<div className="flex items-start justify-between gap-4">
				<div>
					<div className="text-4xl font-semibold text-amber-100">{radical.symbol}</div>
					<div className="mt-2 text-sm text-amber-200/85">{radical.meaning}</div>
				</div>
				<div className="rounded-full border border-amber-300/25 bg-slate-950/40 px-3 py-1 text-xs uppercase tracking-[0.2em] text-amber-200/80">
					{radical.strokes} strokes
				</div>
			</div>

			<div className="mt-5 space-y-3 text-sm text-slate-100">
				<div>
					<span className="text-slate-400">Name:</span> {radical.names.join('、')}
				</div>
				{radical.variantOf ? (
					<div>
						<span className="text-slate-400">Variant of:</span> {radical.variantOf}
					</div>
				) : null}
				<div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/30 px-4 py-3 text-slate-300">
					Most common kanji with this radical
				</div>
			</div>
		</div>
	)
}

export default function RadicalChartPage() {
	const strokeOptions = useMemo(
		() => Array.from(new Set(radicals.map((radical) => radical.strokes))).sort((a, b) => a - b),
		[],
	)
	const [selectedStroke, setSelectedStroke] = useState<number | 'all'>('all')

	const filteredRadicals = useMemo(() => {
		if (selectedStroke === 'all') {
			return radicals
		}
		return radicals.filter((radical) => radical.strokes === selectedStroke)
	}, [selectedStroke])

	return (
		<div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(245,158,11,0.14),transparent_30%),linear-gradient(180deg,#0f172a_0%,#111827_48%,#020617_100%)] px-6 py-10 text-slate-100">
			<div className="mx-auto max-w-7xl">
				<div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
					<div>
						<h1 className="text-3xl font-bold text-slate-100">Radical Chart</h1>
						<p className="mt-2 max-w-3xl text-sm text-slate-300">
							Review common radicals with Japanese names, stroke counts, meanings, and variant forms.
						</p>
					</div>
					<div className="flex flex-wrap gap-2">
						<button
							type="button"
							onClick={() => setSelectedStroke('all')}
							className={`rounded-full px-4 py-2 text-sm transition ${
								selectedStroke === 'all'
									? 'bg-amber-400 text-slate-950'
									: 'border border-slate-700 bg-slate-900/80 text-slate-300 hover:bg-slate-800'
							}`}
						>
							All
						</button>
						{strokeOptions.map((stroke) => (
							<button
								key={stroke}
								type="button"
								onClick={() => setSelectedStroke(stroke)}
								className={`rounded-full px-4 py-2 text-sm transition ${
									selectedStroke === stroke
										? 'bg-amber-400 text-slate-950'
										: 'border border-slate-700 bg-slate-900/80 text-slate-300 hover:bg-slate-800'
								}`}
							>
								{stroke}
							</button>
						))}
					</div>
				</div>

				<div className="mb-4 text-sm text-slate-400">
					{filteredRadicals.length} radicals
				</div>

				<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
					{filteredRadicals.map((radical) => (
						<RadicalCard key={`${radical.symbol}-${radical.strokes}`} radical={radical} />
					))}
				</div>
			</div>
		</div>
	)
}
