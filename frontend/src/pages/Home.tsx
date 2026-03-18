import { Link } from 'react-router-dom'
import ToolIcon from '../components/tool-icon'
import { toolRoutes, tools } from '../data/tools'

const tileClassName =
	'group flex flex-col items-center rounded-xl border border-slate-700/80 bg-slate-900/70 p-4 text-center shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-sky-400/70 hover:bg-slate-800/80'

function Home() {
	return (
		<main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(71,85,105,0.22),_transparent_32%),linear-gradient(180deg,_#1f2937_0%,_#111827_52%,_#030712_100%)] text-slate-100">
			<div className="mx-auto w-full max-w-7xl px-4 pb-16 pt-10 sm:px-6 lg:px-8">
				<header className="mb-10 text-center">
					<h1 className="text-4xl font-bold tracking-tight text-slate-100 sm:text-5xl">
						Converter Tools
					</h1>
					<p className="mx-auto mt-4 max-w-2xl text-base text-slate-300 sm:text-lg">
						Free and easy-to-use online PDF tools that make you more productive.
					</p>
				</header>

				<section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
					{tools.map((tool) => (
						tool in toolRoutes ? (
							<Link key={tool} to={toolRoutes[tool]} className={tileClassName}>
								<div className="mb-3 flex h-14 w-14 items-center justify-center rounded-xl bg-slate-700/70 ring-1 ring-slate-500/30 transition group-hover:bg-sky-500/30">
									<ToolIcon tool={tool} className="h-7 w-7 text-slate-300 group-hover:text-sky-300" />
								</div>
								<p className="text-sm font-medium leading-snug text-slate-100">{tool}</p>
							</Link>
						) : (
							<button key={tool} type="button" className={tileClassName}>
								<div className="mb-3 h-14 w-14 rounded-xl bg-slate-700/70 ring-1 ring-slate-500/30 transition group-hover:bg-sky-500/30" />
								<p className="text-sm font-medium leading-snug text-slate-100">{tool}</p>
							</button>
						)
					))}
				</section>

				<div className="mt-10 flex justify-center">
					<Link
						to="/all-tools"
						className="rounded-full bg-amber-500 px-8 py-3 text-base font-semibold text-slate-950 shadow-lg shadow-amber-500/10 transition hover:bg-amber-400"
					>
						All tools
					</Link>
				</div>
			</div>
		</main>
	)
}

export default Home
