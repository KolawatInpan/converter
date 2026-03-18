import { useRef, useState } from 'react'
import axios from 'axios'
import { compressPdfApi, type CompressPhase } from '../api_caller/compress_pdf'

type PdfItem = {
	id: string
	file: File
}

type CompressionResult = {
	compressedSize: number
	percentChange: number
}

const dpiOptions = [72, 96, 150, 200, 300]

function formatFileSize(size: number): string {
	const kb = size / 1024
	const mb = kb / 1024

	if (mb >= 1) return `${mb.toFixed(2)} MB`
	return `${kb.toFixed(2)} KB`
}

function formatPercent(value: number): string {
	return `${Math.abs(value).toFixed(1)}%`
}

function toBackendQuality(dpi: number, imageQuality: number) {
	if (dpi <= 96 || imageQuality <= 50) return 'low' as const
	if (dpi <= 150 || imageQuality <= 75) return 'medium' as const
	if (dpi <= 200 || imageQuality <= 90) return 'high' as const
	return 'prepress' as const
}

export default function CompressPdf() {
	const [files, setFiles] = useState<PdfItem[]>([])
	const [isDraggingOver, setIsDraggingOver] = useState(false)
	const [selectedDpi, setSelectedDpi] = useState<number>(150)
	const [imageQuality, setImageQuality] = useState<number>(80)
	const [isCompressing, setIsCompressing] = useState(false)
	const [processedCount, setProcessedCount] = useState(0)
	const [currentFileName, setCurrentFileName] = useState('')
	const [progressPercent, setProgressPercent] = useState(0)
	const [progressPhase, setProgressPhase] = useState<CompressPhase>('uploading')
	const [compressionResults, setCompressionResults] = useState<
		Record<string, CompressionResult>
	>({})
	const inputRef = useRef<HTMLInputElement | null>(null)
	const compressTimerRef = useRef<number | undefined>(undefined)

	function addFiles(selectedFiles: FileList | null) {
		if (!selectedFiles) return

		const pdfFiles = Array.from(selectedFiles).filter(
			(file) =>
				file.type === 'application/pdf' ||
				file.name.toLowerCase().endsWith('.pdf'),
		)

		if (pdfFiles.length === 0) return

		const mapped: PdfItem[] = pdfFiles.map((file) => ({
			id: `${file.name}-${file.size}-${crypto.randomUUID()}`,
			file,
		}))

		setFiles((prev) => [...prev, ...mapped])
	}

	function handleInputChange(event: React.ChangeEvent<HTMLInputElement>) {
		addFiles(event.target.files)
		event.target.value = ''
	}

	function handleDrop(event: React.DragEvent<HTMLDivElement>) {
		event.preventDefault()
		setIsDraggingOver(false)
		addFiles(event.dataTransfer.files)
	}

	function handleRemove(id: string) {
		setFiles((prev) => prev.filter((item) => item.id !== id))
		setCompressionResults((prev) => {
			const next = { ...prev }
			delete next[id]
			return next
		})
	}

	async function handleCompress() {
		if (files.length === 0) {
			alert('Please upload at least 1 PDF file.')
			return
		}

		try {
			setIsCompressing(true)
			const quality = toBackendQuality(selectedDpi, imageQuality)
			setCompressionResults({})
			setProcessedCount(0)
			setCurrentFileName('')
			setProgressPercent(0)

			for (const [index, item] of files.entries()) {
				setCurrentFileName(item.file.name)
				const startPercent = Math.round((index / files.length) * 100)
				const endPercent = Math.round(((index + 1) / files.length) * 100)
				setProgressPercent(startPercent)
				setProgressPhase('uploading')

				function toOverall(local: number) {
					return startPercent + (local / 100) * (endPercent - startPercent)
				}

				function startCompressingDrift() {
					setProgressPhase('compressing')
					compressTimerRef.current = window.setInterval(() => {
						setProgressPercent((prev) => {
							const target = toOverall(90)
							if (prev >= target) return prev
							return Math.min(target, prev + Math.max(0.15, (target - prev) * 0.04))
						})
					}, 200)
				}

				function stopDrift() {
					if (compressTimerRef.current !== undefined) {
						window.clearInterval(compressTimerRef.current)
						compressTimerRef.current = undefined
					}
				}

				try {
					const fileSizeMb = item.file.size / (1024 * 1024)
					const timeoutMs = Math.max(
						180000,
						Math.min(1800000, Math.ceil(fileSizeMb * 15000)),
					)

					const blob = await compressPdfApi(
						item.file,
						quality,
						(phase, percent) => {
							if (phase === 'uploading') {
								stopDrift()
								setProgressPhase('uploading')
								setProgressPercent(toOverall(percent * 0.5))
								if (percent === 100) startCompressingDrift()
							} else if (phase === 'downloading') {
								stopDrift()
								setProgressPhase('downloading')
								setProgressPercent(toOverall(90 + percent * 0.1))
							}
						},
						timeoutMs,
					)
					const percentChange =
						((item.file.size - blob.size) / item.file.size) * 100

					setCompressionResults((prev) => ({
						...prev,
						[item.id]: {
							compressedSize: blob.size,
							percentChange,
						},
					}))

					const safeName = item.file.name.toLowerCase().endsWith('.pdf')
						? item.file.name.slice(0, -4)
						: item.file.name

					const url = window.URL.createObjectURL(
						new Blob([blob], { type: 'application/pdf' }),
					)

					const link = document.createElement('a')
					link.href = url
					link.download = `${safeName}-compressed.pdf`
					document.body.appendChild(link)
					link.click()
					link.remove()
					window.URL.revokeObjectURL(url)

					setProcessedCount(index + 1)
					setProgressPercent(endPercent)
				} finally {
					stopDrift()
				}
			}
		} catch (error) {
			console.error(error)
			setCurrentFileName('Compression failed')
			setProgressPercent(0)

			if (axios.isAxiosError(error) && error.code === 'ECONNABORTED') {
				alert(
					'Compression timed out for a large file. Try lower DPI/quality or split the file.',
				)
			} else if (error instanceof Error && error.message) {
				alert(`Compression failed: ${error.message}`)
			} else {
				alert(
					'Compression failed. Make sure backend is running and retry with lower settings for large files.',
				)
			}
		} finally {
			setIsCompressing(false)
			setCurrentFileName('')
		}
	}

	return (
		<div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(71,85,105,0.22),_transparent_32%),linear-gradient(180deg,_#1f2937_0%,_#111827_52%,_#030712_100%)] px-6 py-10 text-slate-100">
			<div className="mx-auto max-w-7xl">
				<div className="mb-8">
					<h1 className="text-3xl font-bold text-slate-100">Compress PDF</h1>
					<p className="mt-2 text-sm text-slate-300">
						Upload one or more PDF files, tune compression settings, and start
						compression.
					</p>
				</div>

				<div
					onClick={() => inputRef.current?.click()}
					onDragOver={(event) => {
						event.preventDefault()
						setIsDraggingOver(true)
					}}
					onDragLeave={() => setIsDraggingOver(false)}
					onDrop={handleDrop}
					className={`flex min-h-[300px] cursor-pointer items-center justify-center rounded-3xl border-2 border-dashed bg-slate-900/70 p-8 text-center shadow-xl shadow-black/20 ring-1 ring-white/5 transition ${
						isDraggingOver
							? 'border-sky-400 bg-slate-800/80'
							: 'border-slate-600 hover:border-sky-400/80'
					}`}
				>
					<div>
						<div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-800 text-2xl ring-1 ring-slate-600/80">
							🗜️
						</div>
						<h2 className="text-xl font-semibold text-slate-100">
							Drop PDF files here
						</h2>
						<p className="mt-2 text-sm text-slate-300">or click to select</p>
						<p className="mt-4 text-xs text-slate-400">
							Multiple files are supported
						</p>
					</div>

					<input
						ref={inputRef}
						type="file"
						accept="application/pdf,.pdf"
						multiple
						onChange={handleInputChange}
						className="hidden"
					/>
				</div>

				<div className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
					<section className="rounded-3xl border border-slate-700/80 bg-slate-900/75 p-6 shadow-xl shadow-black/20 ring-1 ring-white/5">
						<div className="mb-4 flex items-center justify-between gap-4">
							<div>
								<h3 className="text-lg font-semibold text-slate-100">
									Selected files
								</h3>
								<p className="text-sm text-slate-300">
									{files.length} file(s) ready for compression
								</p>
							</div>

							<button
								type="button"
								onClick={() => {
									setFiles([])
									setCompressionResults({})
									setProcessedCount(0)
									setCurrentFileName('')
									setProgressPercent(0)
								}}
								disabled={files.length === 0 || isCompressing}
								className="rounded-xl border border-slate-600 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
							>
								Clear all
							</button>
						</div>

						{(isCompressing || processedCount > 0) && (
							<div className="mb-4 rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3 ring-1 ring-white/5">
								<div className="flex items-center justify-between text-xs text-slate-300">
									<span>
										{isCompressing
											? `${{ uploading: 'Uploading', compressing: 'Compressing', downloading: 'Downloading' }[progressPhase]}: ${currentFileName || 'Preparing...'}`
											: 'Compression completed'}
									</span>
									<span>{Math.round(progressPercent)}%</span>
								</div>
								<div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-800">
									<div
										className="h-full bg-sky-400 transition-all duration-500"
										style={{ width: `${Math.min(100, progressPercent)}%` }}
									/>
									{isCompressing && (
										<div className="relative -mt-2 h-2 overflow-hidden rounded-full">
											<div className="absolute left-0 top-0 h-full w-1/3 animate-[pulse_1.2s_ease-in-out_infinite] rounded-full bg-sky-300/70" />
										</div>
									)}
								</div>
								<p className="mt-2 text-xs text-slate-400">
									{processedCount} / {files.length} file(s) completed
								</p>
							</div>
						)}

						{files.length === 0 ? (
							<div className="rounded-2xl border border-dashed border-slate-600 bg-slate-800/60 px-6 py-10 text-center text-sm text-slate-400">
								No PDF files selected yet
							</div>
						) : (
							<div className="space-y-3">
								{files.map((item, index) => (
									<div
										key={item.id}
										className="rounded-2xl border border-slate-700 bg-slate-950/80 p-4 shadow-lg shadow-black/20 ring-1 ring-white/5"
									>
										<div className="flex items-start justify-between gap-3">
											<div>
												<p className="text-xs font-semibold text-sky-400">
													PDF #{index + 1}
												</p>
												<p className="mt-1 break-words text-sm font-medium text-slate-100">
													{item.file.name}
												</p>
												<p className="mt-1 text-xs text-slate-400">
													{formatFileSize(item.file.size)}
												</p>
												{compressionResults[item.id] ? (
													<div className="mt-2 space-y-1 text-xs">
														<p className="text-slate-300">
															Compressed size:{' '}
															{formatFileSize(compressionResults[item.id].compressedSize)}
														</p>
														<p
															className={
																compressionResults[item.id].percentChange >= 0
																	? 'text-emerald-400'
																	: 'text-rose-400'
															}
														>
															{compressionResults[item.id].percentChange >= 0
																? `Reduced by ${formatPercent(compressionResults[item.id].percentChange)}`
																: `Increased by ${formatPercent(compressionResults[item.id].percentChange)}`}
														</p>
													</div>
												) : null}
											</div>

											<button
												type="button"
												onClick={() => handleRemove(item.id)}
												className="rounded-lg px-2 py-1 text-xs font-medium text-rose-400 hover:bg-rose-500/10"
											>
												Remove
											</button>
										</div>
									</div>
								))}
							</div>
						)}
					</section>

					<aside className="rounded-3xl border border-slate-700/80 bg-slate-900/75 p-6 shadow-xl shadow-black/20 ring-1 ring-white/5">
						<h3 className="text-lg font-semibold text-slate-100">
							Compression settings
						</h3>

						<div className="mt-5 space-y-5">
							<label className="block">
								<span className="mb-2 block text-sm font-medium text-slate-300">
									DPI
								</span>
								<select
									value={selectedDpi}
									onChange={(event) =>
										setSelectedDpi(Number(event.target.value))
									}
									className="w-full rounded-xl border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-sky-400"
								>
									{dpiOptions.map((dpi) => (
										<option key={dpi} value={dpi}>
											{dpi} DPI
										</option>
									))}
								</select>
							</label>

							<label className="block">
								<span className="mb-2 block text-sm font-medium text-slate-300">
									Image quality ({imageQuality}%)
								</span>
								<input
									type="range"
									min={30}
									max={100}
									step={5}
									value={imageQuality}
									onChange={(event) =>
										setImageQuality(Number(event.target.value))
									}
									className="w-full accent-sky-400"
								/>
								<div className="mt-2 flex justify-between text-xs text-slate-400">
									<span>Smaller file</span>
									<span>Higher quality</span>
								</div>
							</label>

							<button
								type="button"
								onClick={handleCompress}
								disabled={files.length === 0 || isCompressing}
								className="w-full rounded-xl bg-sky-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
							>
								{isCompressing ? 'Compressing...' : 'Compress PDF'}
							</button>
						</div>
					</aside>
				</div>
			</div>
		</div>
	)
}
