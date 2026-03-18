import { ScissorsLineDashed, Upload, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { splitPdfApi, type SplitMode } from '../api_caller/split_pdf'

function formatFileSize(size: number) {
	const kb = size / 1024
	const mb = kb / 1024

	if (mb >= 1) {
		return `${mb.toFixed(2)} MB`
	}

	return `${kb.toFixed(2)} KB`
}

export default function SplitPdfPage() {
	const [file, setFile] = useState<File | null>(null)
	const [splitMode, setSplitMode] = useState<SplitMode>('every-page')
	const [pagesPerSplit, setPagesPerSplit] = useState(2)
	const [isDraggingOver, setIsDraggingOver] = useState(false)
	const [isSplitting, setIsSplitting] = useState(false)
	const [statusMessage, setStatusMessage] = useState<string | null>(null)
	const inputRef = useRef<HTMLInputElement | null>(null)

	function addFile(selectedFiles: FileList | null) {
		if (!selectedFiles?.length) {
			return
		}

		const selectedFile = Array.from(selectedFiles).find(
			(item) => item.type === 'application/pdf' || item.name.toLowerCase().endsWith('.pdf'),
		)

		if (!selectedFile) {
			alert('Please choose a PDF file only.')
			return
		}

		setFile(selectedFile)
		setStatusMessage(null)
	}

	function handleInputChange(event: React.ChangeEvent<HTMLInputElement>) {
		addFile(event.target.files)
		event.target.value = ''
	}

	function handleDrop(event: React.DragEvent<HTMLDivElement>) {
		event.preventDefault()
		setIsDraggingOver(false)
		addFile(event.dataTransfer.files)
	}

	async function handleSplitPdf() {
		if (!file) {
			alert('Please upload a PDF file first.')
			return
		}

		try {
			setIsSplitting(true)
			setStatusMessage('Splitting PDF and preparing ZIP...')

			const blob = await splitPdfApi(file, splitMode, pagesPerSplit)
			const url = window.URL.createObjectURL(new Blob([blob], { type: 'application/zip' }))
			const link = document.createElement('a')
			const safeName = file.name.toLowerCase().endsWith('.pdf') ? file.name.slice(0, -4) : file.name

			link.href = url
			link.download = `${safeName}.zip`
			document.body.appendChild(link)
			link.click()
			link.remove()
			window.URL.revokeObjectURL(url)

			setStatusMessage(`Downloaded ${safeName}.zip`)
		} catch (error) {
			setStatusMessage(error instanceof Error ? error.message : 'Split PDF failed.')
		} finally {
			setIsSplitting(false)
		}
	}

	return (
		<main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.16),_transparent_28%),linear-gradient(180deg,_#1f2937_0%,_#111827_52%,_#030712_100%)] px-6 py-10 text-slate-100">
			<div className="mx-auto max-w-7xl">
				<div className="mb-8">
					<div className="inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-400/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.3em] text-amber-200">
						<ScissorsLineDashed className="h-4 w-4" />
						Split PDF
					</div>
				</div>

				<div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
					<section className="space-y-6">
						<div
							onClick={() => inputRef.current?.click()}
							onDragOver={(event) => {
								event.preventDefault()
								setIsDraggingOver(true)
							}}
							onDragLeave={() => setIsDraggingOver(false)}
							onDrop={handleDrop}
							className={`flex min-h-[280px] cursor-pointer items-center justify-center rounded-3xl border-2 border-dashed bg-slate-900/70 p-8 text-center shadow-xl shadow-black/20 ring-1 ring-white/5 transition ${
								isDraggingOver
									? 'border-amber-400 bg-slate-800/80'
									: 'border-slate-600 hover:border-amber-400/80'
							}`}
						>
							<div>
								<div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-800 ring-1 ring-slate-600/80">
									<Upload className="h-8 w-8 text-amber-300" />
								</div>
								<h2 className="text-xl font-semibold text-slate-100">Drop a PDF file here</h2>
								<p className="mt-2 text-sm text-slate-300">or click to select file</p>
								<p className="mt-4 text-xs text-slate-400">One PDF at a time</p>
							</div>

							<input
								ref={inputRef}
								type="file"
								accept="application/pdf,.pdf"
								onChange={handleInputChange}
								className="hidden"
							/>
						</div>

						<section className="rounded-3xl border border-slate-700/80 bg-slate-900/75 p-6 shadow-xl shadow-black/20 ring-1 ring-white/5">
							<div className="mb-4 flex items-center justify-between gap-4">
								<div>
									<h3 className="text-lg font-semibold text-slate-100">Selected file</h3>
									<p className="text-sm text-slate-300">Upload a PDF, then choose how to split it</p>
								</div>

								<button
									type="button"
									onClick={() => {
										setFile(null)
										setStatusMessage(null)
									}}
									disabled={!file || isSplitting}
									className="rounded-xl border border-slate-600 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
								>
									Clear
								</button>
							</div>

							{!file ? (
								<div className="rounded-2xl border border-dashed border-slate-600 bg-slate-800/60 px-6 py-10 text-center text-sm text-slate-400">
									No PDF file selected yet
								</div>
							) : (
								<div className="rounded-2xl border border-slate-700 bg-slate-950/80 p-4 shadow-lg shadow-black/20 ring-1 ring-white/5">
									<div className="flex items-start justify-between gap-3">
										<div>
											<p className="text-xs font-semibold text-amber-300">PDF</p>
											<p className="mt-1 break-words text-sm font-medium text-slate-100">
												{file.name}
											</p>
											<p className="mt-1 text-xs text-slate-400">{formatFileSize(file.size)}</p>
										</div>

										<button
											type="button"
											onClick={() => setFile(null)}
											className="rounded-lg p-2 text-slate-400 transition hover:bg-rose-500/10 hover:text-rose-300"
											aria-label={`Remove ${file.name}`}
										>
											<X className="h-4 w-4" />
										</button>
									</div>
								</div>
							)}
						</section>
					</section>

					<aside className="rounded-3xl border border-slate-700/80 bg-slate-900/75 p-6 shadow-xl shadow-black/20 ring-1 ring-white/5">
						<h3 className="text-lg font-semibold text-slate-100">Split settings</h3>

						<div className="mt-5 space-y-5">
							<label className="block">
								<span className="mb-2 block text-sm font-medium text-slate-300">Split mode</span>
								<select
									value={splitMode}
									onChange={(event) => setSplitMode(event.target.value as SplitMode)}
									className="w-full rounded-xl border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-amber-400"
								>
									<option value="every-page">Split every page</option>
									<option value="page-count">Split every N pages</option>
								</select>
							</label>

							{splitMode === 'page-count' ? (
								<label className="block">
									<span className="mb-2 block text-sm font-medium text-slate-300">
										Pages per output file
									</span>
									<input
										type="number"
										min={1}
										value={pagesPerSplit}
										onChange={(event) => setPagesPerSplit(Number(event.target.value))}
										className="w-full rounded-xl border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-amber-400"
									/>
								</label>
							) : null}

							<div className="rounded-2xl border border-slate-700 bg-slate-950/60 p-4">
								<div className="text-sm font-medium text-slate-200">What happens next</div>
								<p className="mt-2 text-sm leading-relaxed text-slate-300">
									The split result will be bundled into one ZIP file and downloaded automatically.
								</p>
								{statusMessage ? (
									<p className="mt-3 text-sm leading-relaxed text-slate-300">{statusMessage}</p>
								) : null}
							</div>

							<button
								type="button"
								onClick={handleSplitPdf}
								disabled={!file || isSplitting || (splitMode === 'page-count' && pagesPerSplit < 1)}
								className="w-full rounded-xl bg-amber-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
							>
								{isSplitting ? 'Splitting PDF...' : 'Split PDF'}
							</button>
						</div>
					</aside>
				</div>
			</div>
		</main>
	)
}
