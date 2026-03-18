import { Link } from 'react-router-dom'
import ToolIcon from '../components/tool-icon'
import { toolCategories, toolRoutes } from '../data/tools'

export default function AllToolsPage() {
	return (
		<main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(71,85,105,0.2),_transparent_30%),linear-gradient(180deg,_#111827_0%,_#0f172a_50%,_#020617_100%)] text-slate-100">
			<div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
				<header className="max-w-3xl">
					<div className="text-sm font-semibold uppercase tracking-[0.3em] text-sky-300/80">
						All Tools
					</div>
					<h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-50 sm:text-5xl">
						Browse every tool by category
					</h1>
					<p className="mt-4 text-base text-slate-300 sm:text-lg">
						Explore all available tools grouped into PDF, Image, and Japanese.
					</p>
				</header>

				<div className="mt-10 grid gap-6 lg:grid-cols-3">
					{Object.entries(toolCategories).map(([category, categoryTools]) => (
						<section
							key={category}
							className="rounded-3xl border border-slate-700/70 bg-slate-900/60 p-6 shadow-xl shadow-black/10"
						>
							<div className="mb-4 flex items-center justify-between gap-3">
								<h2 className="text-2xl font-semibold text-slate-100">{category}</h2>
								<span className="rounded-full border border-slate-600 bg-slate-950/60 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-400">
									{categoryTools.length} tools
								</span>
							</div>

							<div className="space-y-2">
								{categoryTools.map((tool) => {
									const route = toolRoutes[tool]

									if (route) {
										return (
											<Link
												key={tool}
												to={route}
												className="flex items-center justify-between rounded-2xl border border-slate-700/70 bg-slate-950/40 px-4 py-3 text-sm text-slate-200 transition hover:border-sky-400/60 hover:bg-slate-800/80 hover:text-sky-300"
											>
												<div className="flex items-center gap-3">
													<div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800/80 ring-1 ring-slate-600/40">
														<ToolIcon tool={tool} className="h-5 w-5 text-slate-300" />
													</div>
													<span>{tool}</span>
												</div>
												<span className="text-xs uppercase tracking-[0.2em] text-slate-500">Open</span>
											</Link>
										)
									}

									return (
										<div
											key={tool}
											className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-950/30 px-4 py-3 text-sm text-slate-500"
										>
											<div className="flex items-center gap-3">
												<div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900/70 ring-1 ring-slate-800">
													<ToolIcon tool={tool} className="h-5 w-5 text-slate-500" />
												</div>
												<span>{tool}</span>
											</div>
											<span className="text-xs uppercase tracking-[0.2em]">Coming soon</span>
										</div>
									)
								})}
							</div>
						</section>
					))}
				</div>
			</div>
		</main>
	)
}
