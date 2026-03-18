import { FileImage, ImageDown, Upload, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { convertPdfApi, triggerBlobDownload } from '../api_caller/pdf_converter'

type SelectedFile = {
	id: string
	file: File
}

function formatFileSize(size: number) {
	const kb = size / 1024
	const mb = kb / 1024

	if (mb >= 1) {
		return `${mb.toFixed(2)} MB`
	}

	return `${kb.toFixed(2)} KB`
}

export default function PdfToImagesPage() {
	const [files, setFiles] = useState<SelectedFile[]>([])
	const [selectedFormat, setSelectedFormat] = useState<'PNG' | 'JPG'>('PNG')
	const [isDraggingOver, setIsDraggingOver] = useState(false)
	const [isConverting, setIsConverting] = useState(false)
	const [statusMessage, setStatusMessage] = useState<string | null>(null)
	const inputRef = useRef<HTMLInputElement | null>(null)

	function addFiles(selectedFiles: FileList | null) {
		if (!selectedFiles) {
			return
		}

		const pdfFiles = Array.from(selectedFiles).filter(
			(file) => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'),
		)

		if (pdfFiles.length === 0) {
			alert('Please choose PDF files only.')
			return
		}

		setFiles((previousFiles) => [
			...previousFiles,
			...pdfFiles.map((file) => ({
				id: `${file.name}-${file.size}-${crypto.randomUUID()}`,
				file,
			})),
		])
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

	async function handleConvert() {
		if (files.length === 0) {
			alert('Please upload at least 1 PDF file first.')
			return
		}

		try {
			setIsConverting(true)
			setStatusMessage('Converting PDF pages to images...')

			const response = await convertPdfApi(
				files.map((item) => item.file),
				'from-pdf',
				selectedFormat,
			)

			triggerBlobDownload(response.blob, response.filename)
			setStatusMessage(`Downloaded ${response.filename}`)
		} catch (error) {
			setStatusMessage(error instanceof Error ? error.message : 'Conversion failed.')
		} finally {
			setIsConverting(false)
		}
	}

	return (
		<main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.18),_transparent_28%),linear-gradient(180deg,_#0f172a_0%,_#111827_48%,_#020617_100%)] text-slate-100">
			<div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
				<header>
					<div className="inline-flex items-center gap-2 rounded-full border border-sky-400/20 bg-sky-400/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.3em] text-sky-200">
						<ImageDown className="h-4 w-4" />
						PDF to Images
					</div>
				</header>

				<div className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
					<div className="space-y-6">
						<div
							onClick={() => inputRef.current?.click()}
							onDragOver={(event) => {
								event.preventDefault()
								setIsDraggingOver(true)
							}}
							onDragLeave={() => setIsDraggingOver(false)}
							onDrop={handleDrop}
							className={`flex min-h-[260px] cursor-pointer items-center justify-center rounded-3xl border-2 border-dashed bg-slate-900/50 p-8 text-center transition ${
								isDraggingOver
									? 'border-sky-400 bg-slate-900/80'
									: 'border-slate-600 hover:border-sky-400/80'
							}`}
						>
							<div>
								<div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-800 ring-1 ring-slate-600/80">
									<Upload className="h-8 w-8 text-sky-300" />
								</div>
								<h2 className="text-xl font-semibold text-slate-100">Drop PDF files here</h2>
								<p className="mt-2 text-sm text-slate-300">or click to select files</p>
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

						<section className="rounded-3xl border border-slate-700/80 bg-slate-900/60 p-6">
							<div className="mb-4 flex items-center justify-between gap-4">
								<div>
									<h3 className="text-lg font-semibold text-slate-100">Selected files</h3>
									<p className="text-sm text-slate-300">{files.length} file(s) ready</p>
								</div>
								<button
									type="button"
									onClick={() => setFiles([])}
									disabled={files.length === 0}
									className="rounded-xl border border-slate-600 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
								>
									Clear all
								</button>
							</div>

							{files.length === 0 ? (
								<div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/50 px-6 py-10 text-center text-sm text-slate-400">
									No PDF files selected yet
								</div>
							) : (
								<div className="space-y-3">
									{files.map((item, index) => (
										<div
											key={item.id}
											className="flex items-start justify-between gap-4 rounded-2xl border border-slate-700 bg-slate-950/80 p-4"
										>
											<div>
												<div className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-400">
													PDF #{index + 1}
												</div>
												<div className="mt-1 break-words text-sm font-medium text-slate-100">
													{item.file.name}
												</div>
												<div className="mt-1 text-xs text-slate-400">
													{formatFileSize(item.file.size)}
												</div>
											</div>

											<button
												type="button"
												onClick={() =>
													setFiles((previousFiles) =>
														previousFiles.filter((file) => file.id !== item.id),
													)
												}
												className="rounded-lg p-2 text-slate-400 transition hover:bg-rose-500/10 hover:text-rose-300"
												aria-label={`Remove ${item.file.name}`}
											>
												<X className="h-4 w-4" />
											</button>
										</div>
									))}
								</div>
							)}
						</section>
					</div>

					<aside className="rounded-3xl border border-slate-700/80 bg-slate-900/60 p-6">
						<h3 className="text-lg font-semibold text-slate-100">Export settings</h3>

						<div className="mt-5 space-y-5">
							<label className="block">
								<span className="mb-2 block text-sm font-medium text-slate-300">Image format</span>
								<select
									value={selectedFormat}
									onChange={(event) => setSelectedFormat(event.target.value as 'PNG' | 'JPG')}
									className="w-full rounded-xl border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-sky-400"
								>
									<option value="PNG">PNG</option>
									<option value="JPG">JPG</option>
								</select>
							</label>

							<div className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
								<div className="inline-flex items-center gap-2 rounded-full border border-slate-600 bg-slate-950/80 px-3 py-1.5 text-sm text-slate-100">
									<FileImage className="h-4 w-4" />
									<span>{selectedFormat} images in ZIP</span>
								</div>
								<p className="mt-3 text-sm leading-relaxed text-slate-300">
									Each page will be exported as an image and bundled into one ZIP download.
								</p>
								{statusMessage ? (
									<p className="mt-3 text-sm leading-relaxed text-slate-300">{statusMessage}</p>
								) : null}
							</div>

							<button
								type="button"
								onClick={handleConvert}
								disabled={files.length === 0 || isConverting}
								className="w-full rounded-xl bg-sky-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
							>
								{isConverting ? 'Converting...' : `Convert PDF to ${selectedFormat}`}
							</button>
						</div>
					</aside>
				</div>
			</div>
		</main>
	)
}
