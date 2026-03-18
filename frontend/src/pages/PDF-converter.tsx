import {
	ArrowRightLeft,
	FileOutput,
	FileSpreadsheet,
	FileText,
	FileType2,
	Presentation,
	Upload,
	X,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { convertPdfApi, triggerBlobDownload, type ConvertMode } from '../api_caller/pdf_converter'

type SelectedFile = {
	id: string
	file: File
}

const conversionModes: Array<{
	id: ConvertMode
	label: string
	title: string
	description: string
	formats: string[]
	accept: string
	helperText: string
	accentClassName: string
}> = [
	{
		id: 'from-pdf',
		label: 'Convert PDF to ...',
		title: 'Turn PDFs into other formats',
		description: 'Upload one or more PDFs, then choose the output format you want to export.',
		formats: ['Word', 'Excel', 'PowerPoint', 'TXT'],
		accept: 'application/pdf,.pdf',
		helperText: 'Accepts PDF files only',
		accentClassName: 'from-sky-400/25 via-cyan-400/10 to-transparent',
	},
	{
		id: 'to-pdf',
		label: 'Convert to PDF',
		title: 'Create a PDF from document formats',
		description: 'Document-to-PDF conversion lives here. Image conversion has its own dedicated tool.',
		formats: ['Word', 'Excel', 'PowerPoint', 'HTML'],
		accept: '.doc,.docx,.xls,.xlsx,.ppt,.pptx,.html,.htm',
		helperText: 'Document formats only',
		accentClassName: 'from-amber-400/25 via-orange-400/10 to-transparent',
	},
]

const supportedFormats: Record<ConvertMode, string[]> = {
	'from-pdf': ['TXT'],
	'to-pdf': [],
}

function formatFileSize(size: number) {
	const kb = size / 1024
	const mb = kb / 1024

	if (mb >= 1) {
		return `${mb.toFixed(2)} MB`
	}

	return `${kb.toFixed(2)} KB`
}

function isAcceptedFile(file: File, mode: ConvertMode) {
	const fileName = file.name.toLowerCase()

	if (mode === 'from-pdf') {
		return file.type === 'application/pdf' || fileName.endsWith('.pdf')
	}

	return (
		fileName.endsWith('.doc') ||
		fileName.endsWith('.docx') ||
		fileName.endsWith('.xls') ||
		fileName.endsWith('.xlsx') ||
		fileName.endsWith('.ppt') ||
		fileName.endsWith('.pptx') ||
		fileName.endsWith('.html') ||
		fileName.endsWith('.htm')
	)
}

function getFormatIcon(format: string) {
	if (format === 'Word' || format === 'TXT' || format === 'HTML') {
		return <FileText className="h-4 w-4" />
	}

	if (format === 'Excel') {
		return <FileSpreadsheet className="h-4 w-4" />
	}

	if (format === 'PowerPoint') {
		return <Presentation className="h-4 w-4" />
	}

	return <FileType2 className="h-4 w-4" />
}

export default function PdfConverterPage() {
	const [selectedMode, setSelectedMode] = useState<ConvertMode>('from-pdf')
	const [selectedFormat, setSelectedFormat] = useState('Word')
	const [files, setFiles] = useState<SelectedFile[]>([])
	const [isDraggingOver, setIsDraggingOver] = useState(false)
	const [isConverting, setIsConverting] = useState(false)
	const [statusMessage, setStatusMessage] = useState<string | null>(null)
	const inputRef = useRef<HTMLInputElement | null>(null)

	const activeMode = conversionModes.find((mode) => mode.id === selectedMode) ?? conversionModes[0]
	const isSelectedFormatSupported = supportedFormats[selectedMode].includes(selectedFormat)

	useEffect(() => {
		setSelectedFormat(activeMode.formats[0])
		setFiles([])
		setIsDraggingOver(false)
		setStatusMessage(null)
	}, [activeMode])

	function addFiles(selectedFiles: FileList | null) {
		if (!selectedFiles) {
			return
		}

		const acceptedFiles = Array.from(selectedFiles).filter((file) =>
			isAcceptedFile(file, selectedMode),
		)

		if (acceptedFiles.length === 0) {
			alert(
				selectedMode === 'from-pdf'
					? 'Please choose PDF files only.'
					: 'Please choose Word, Excel, PowerPoint, or HTML files.',
			)
			return
		}

		const mappedFiles = acceptedFiles.map((file) => ({
			id: `${file.name}-${file.size}-${crypto.randomUUID()}`,
			file,
		}))

		setFiles((previousFiles) => [...previousFiles, ...mappedFiles])
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

	function handleRemoveFile(id: string) {
		setFiles((previousFiles) => previousFiles.filter((item) => item.id !== id))
	}

	async function handleConvert() {
		if (files.length === 0) {
			alert('Please upload at least 1 file first.')
			return
		}

		if (!isSelectedFormatSupported) {
			setStatusMessage('This format is not available yet.')
			return
		}

		try {
			setIsConverting(true)
			setStatusMessage('Converting and preparing download...')

			const response = await convertPdfApi(
				files.map((item) => item.file),
				selectedMode,
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
		<main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.18),_transparent_28%),linear-gradient(180deg,_#0f172a_0%,_#111827_48%,_#020617_100%)] text-slate-100">
			<div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
				<header className="max-w-3xl">
					<div className="inline-flex items-center gap-2 rounded-full border border-sky-400/20 bg-sky-400/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.3em] text-sky-200">
						<ArrowRightLeft className="h-4 w-4" />
						PDF Converter
					</div>
				</header>

				<section className="mt-10 grid gap-4 lg:grid-cols-2">
					{conversionModes.map((mode) => {
						const isActive = mode.id === selectedMode

						return (
							<button
								key={mode.id}
								type="button"
								onClick={() => setSelectedMode(mode.id)}
								className={`rounded-3xl border p-6 text-left transition ${
									isActive
										? 'border-sky-400/60 bg-slate-900/95 shadow-xl shadow-sky-950/30'
										: 'border-slate-700/80 bg-slate-900/60 hover:border-slate-500 hover:bg-slate-900/80'
								}`}
							>
								<div className="flex items-start justify-between gap-4">
									<div>
										<div className="text-lg font-semibold text-slate-100">{mode.label}</div>
										<p className="mt-2 text-sm leading-relaxed text-slate-300">{mode.description}</p>
									</div>
									<div
										className={`flex h-12 w-12 items-center justify-center rounded-2xl border ${
											isActive
												? 'border-sky-400/40 bg-sky-400/15 text-sky-200'
												: 'border-slate-700 bg-slate-950/70 text-slate-400'
										}`}
									>
										{mode.id === 'from-pdf' ? (
											<FileOutput className="h-6 w-6" />
										) : (
											<FileText className="h-6 w-6" />
										)}
									</div>
								</div>
							</button>
						)
					})}
				</section>

				<section className="mt-8 overflow-hidden rounded-[2rem] border border-slate-700/80 bg-slate-900/70 shadow-2xl shadow-black/20">
					<div className={`grid gap-6 bg-gradient-to-r ${activeMode.accentClassName} px-6 py-6 sm:px-8 lg:grid-cols-[1.2fr_0.8fr]`}>
						<div className="space-y-6">
							<div
								onClick={() => inputRef.current?.click()}
								onDragOver={(event) => {
									event.preventDefault()
									setIsDraggingOver(true)
								}}
								onDragLeave={() => setIsDraggingOver(false)}
								onDrop={handleDrop}
								className={`flex min-h-[260px] cursor-pointer items-center justify-center rounded-3xl border-2 border-dashed bg-slate-950/35 p-8 text-center transition ${
									isDraggingOver
										? 'border-sky-400 bg-slate-900/80'
										: 'border-slate-600 hover:border-sky-400/80'
								}`}
							>
								<div>
									<div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-800 ring-1 ring-slate-600/80">
										<Upload className="h-8 w-8 text-sky-300" />
									</div>
									<h3 className="text-xl font-semibold text-slate-100">
										{selectedMode === 'from-pdf' ? 'Drop PDF files here' : 'Drop files to convert into PDF'}
									</h3>
									<p className="mt-2 text-sm text-slate-300">or click to select files</p>
									<p className="mt-4 text-xs uppercase tracking-[0.24em] text-slate-500">
										{activeMode.helperText}
									</p>
								</div>

								<input
									ref={inputRef}
									type="file"
									accept={activeMode.accept}
									multiple
									onChange={handleInputChange}
									className="hidden"
								/>
							</div>

							<section className="rounded-3xl border border-slate-700/80 bg-slate-950/35 p-6">
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
										No files selected yet
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
														File #{index + 1}
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
													onClick={() => handleRemoveFile(item.id)}
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

						<aside className="rounded-3xl border border-slate-700/80 bg-slate-950/40 p-6">
							<h3 className="text-lg font-semibold text-slate-100">Conversion setup</h3>

							<div className="mt-5 space-y-5">
								<label className="block">
									<span className="mb-2 block text-sm font-medium text-slate-300">Mode</span>
									<div className="rounded-2xl border border-slate-700 bg-slate-900/70 px-4 py-3 text-sm text-slate-100">
										{activeMode.label}
									</div>
								</label>

								<label className="block">
									<span className="mb-2 block text-sm font-medium text-slate-300">
										{selectedMode === 'from-pdf' ? 'Convert PDF to' : 'Source format'}
									</span>
									<select
										value={selectedFormat}
										onChange={(event) => setSelectedFormat(event.target.value)}
										className="w-full rounded-xl border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-sky-400"
									>
										{activeMode.formats.map((format) => (
											<option key={format} value={format}>
												{supportedFormats[selectedMode].includes(format)
													? format
													: `${format} (Coming soon)`}
											</option>
										))}
									</select>
								</label>

								<div className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
									<div className="inline-flex items-center gap-2 rounded-full border border-slate-600 bg-slate-950/80 px-3 py-1.5 text-sm text-slate-100">
										{getFormatIcon(selectedMode === 'from-pdf' ? selectedFormat : 'PDF')}
										<span>{selectedMode === 'from-pdf' ? selectedFormat : 'PDF'}</span>
									</div>
									{statusMessage ? (
										<p className="mt-3 text-sm leading-relaxed text-slate-300">{statusMessage}</p>
									) : !isSelectedFormatSupported ? (
										selectedMode === 'to-pdf' ? (
											<p className="mt-3 text-sm leading-relaxed text-amber-300">
												Document-to-PDF formats are coming soon. Use the dedicated Images to PDF tool for image files.
											</p>
										) : (
											<p className="mt-3 text-sm leading-relaxed text-amber-300">
												This format is coming soon. Available now: {supportedFormats[selectedMode].join(', ')}.
											</p>
										)
									) : (
										<p className="mt-3 text-sm leading-relaxed text-slate-300">
											Conversion will start and download automatically when finished.
										</p>
									)}
								</div>

								<button
									type="button"
									onClick={handleConvert}
									disabled={files.length === 0 || isConverting || !isSelectedFormatSupported}
									className="w-full rounded-xl bg-sky-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
								>
									{isConverting
										? 'Converting...'
										: selectedMode === 'from-pdf'
										? `Convert PDF to ${selectedFormat}`
										: `Convert ${selectedFormat} to PDF`}
								</button>
							</div>
						</aside>
					</div>
				</section>
			</div>
		</main>
	)
}
