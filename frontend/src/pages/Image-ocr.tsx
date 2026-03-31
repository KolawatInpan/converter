import {
	Camera,
	ClipboardPaste,
	Copy,
	Download,
	ImagePlus,
	Keyboard,
	Monitor,
	ScanText,
	Share2,
	Upload,
	X,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import { imageOcrApi, type ImageOcrMode } from '../api_caller/image_ocr'
import { extractWordsApi, type WordEntry } from '../api_caller/extract_word'
import { matchOCRSkills, type SkillMatch } from '../api_caller/skill_search'

type SelectedImage = {
	id: string
	file: File
	previewUrl: string
	source: 'upload' | 'drop' | 'paste' | 'screen'
}

type ScreenSelection = {
	x: number
	y: number
	width: number
	height: number
}

function formatFileSize(size: number) {
	const kb = size / 1024
	const mb = kb / 1024

	if (mb >= 1) {
		return `${mb.toFixed(2)} MB`
	}

	return `${kb.toFixed(2)} KB`
}

function toSelectedImage(file: File, source: SelectedImage['source']): SelectedImage {
	return {
		id: `${source}-${file.name}-${file.size}-${crypto.randomUUID()}`,
		file,
		previewUrl: URL.createObjectURL(file),
		source,
	}
}

function sourceLabel(source: SelectedImage['source']) {
	switch (source) {
		case 'paste':
			return 'Clipboard'
		case 'screen':
			return 'Screen'
		case 'drop':
			return 'Dropped'
		default:
			return 'Upload'
	}
}

function flattenWordEntries(entries: WordEntry[]) {
	return entries.map((entry) => entry.base).join('\n')
}

type MatchedSkillRow = {
	ocrText: string
	confidence: number
	id: string | number
	name: string
	jpName?: string
	skillPoints?: number
	evalPoints?: number
}

const MIN_CONFIDENCE = 0.65
const DEFAULT_SCREEN_CAPTURE_EXPORT_SCALE = 2

const SCREEN_CAPTURE_QUALITY_OPTIONS = [
	{ label: '1x (Fast)', value: 1 },
	{ label: '1.5x', value: 1.5 },
	{ label: '2x (Recommended)', value: 2 },
	{ label: '3x (Ultra)', value: 3 },
]

function buildSkillSearchCandidates(recognizedText: string, words: WordEntry[]): string[] {
	const directLines = recognizedText
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter((line) => line.length >= 2)
		.filter((line) => !line.startsWith('# Image'))

	const wordBases = words.map((word) => word.base.trim()).filter((word) => word.length >= 2)

	const merged = [...directLines, ...wordBases]
	const deduped: string[] = []
	const seen = new Set<string>()

	for (const candidate of merged) {
		const normalized = candidate.toLowerCase()
		if (!seen.has(normalized)) {
			seen.add(normalized)
			deduped.push(candidate)
		}
	}

	return deduped.slice(0, 120)
}

function isLikelyNoiseText(value: string): boolean {
	const text = value.trim()
	if (text.length < 2) {
		return true
	}

	if (/^[^\p{L}\p{N}]+$/u.test(text)) {
		return true
	}

	const normalized = text.replace(/\s+/g, '')
	if (normalized.length < 2) {
		return true
	}

	const symbolCount = (normalized.match(/[^\p{L}\p{N}]/gu) ?? []).length
	if (symbolCount / normalized.length > 0.5) {
		return true
	}

	const uniqueChars = new Set(normalized.toLowerCase())
	if (normalized.length >= 5 && uniqueChars.size <= 2) {
		return true
	}

	return false
}

export default function ImageOcrPage() {
	const [images, setImages] = useState<SelectedImage[]>([])
	const [activeImageId, setActiveImageId] = useState<string | null>(null)
	const [isDraggingOver, setIsDraggingOver] = useState(false)
	const [isRecognizing, setIsRecognizing] = useState(false)
	const [isConnectingScreen, setIsConnectingScreen] = useState(false)
	const [isScreenActive, setIsScreenActive] = useState(false)
	const [screenSelection, setScreenSelection] = useState<ScreenSelection | null>(null)
	const [isSelectingScreen, setIsSelectingScreen] = useState(false)
	const [screenCaptureScale, setScreenCaptureScale] = useState<number>(
		DEFAULT_SCREEN_CAPTURE_EXPORT_SCALE,
	)
	const [ocrMode, setOcrMode] = useState<ImageOcrMode>('uma-musume')
	const [recognizedText, setRecognizedText] = useState('')
	const [uniqueWords, setUniqueWords] = useState<WordEntry[]>([])
	const [skillSearchInput, setSkillSearchInput] = useState('')
	const [matchedSkills, setMatchedSkills] = useState<MatchedSkillRow[]>([])
	const [isMatchingSkills, setIsMatchingSkills] = useState(false)
	const [statusMessage, setStatusMessage] = useState<string | null>(
		'Paste images with Ctrl+V, drag and drop, choose files, or capture snapshots from screen share.',
	)
	const [errorMessage, setErrorMessage] = useState<string | null>(null)
	const inputRef = useRef<HTMLInputElement | null>(null)
	const videoRef = useRef<HTMLVideoElement | null>(null)
	const screenPreviewRef = useRef<HTMLDivElement | null>(null)
	const streamRef = useRef<MediaStream | null>(null)
	const imagesRef = useRef<SelectedImage[]>([])
	const selectionStartRef = useRef<{ x: number; y: number } | null>(null)

	const visibleMatchedSkills = useMemo(
		() => matchedSkills.filter((item) => item.confidence >= MIN_CONFIDENCE),
		[matchedSkills],
	)

	const activeImage = images.find((item) => item.id === activeImageId) ?? images[0] ?? null

	function appendImages(files: File[], source: SelectedImage['source']) {
		if (files.length === 0) {
			return
		}

		setImages((previousImages) => {
			const nextImages = [...previousImages, ...files.map((file) => toSelectedImage(file, source))]
			if (!activeImageId && nextImages[0]) {
				setActiveImageId(nextImages[0].id)
			}
			return nextImages
		})

		setRecognizedText('')
		setUniqueWords([])
		setSkillSearchInput('')
		setMatchedSkills([])
		setErrorMessage(null)
		setStatusMessage(
			source === 'screen'
				? `Captured ${files.length} screen snapshot${files.length > 1 ? 's' : ''}.`
				: `Added ${files.length} image${files.length > 1 ? 's' : ''}.`,
		)
	}

	function pickSupportedImages(fileList: FileList | null) {
		if (!fileList) {
			return []
		}

		return Array.from(fileList).filter((candidate) => {
			const name = candidate.name.toLowerCase()
			return (
				candidate.type.startsWith('image/') ||
				name.endsWith('.png') ||
				name.endsWith('.jpg') ||
				name.endsWith('.jpeg') ||
				name.endsWith('.bmp') ||
				name.endsWith('.webp')
			)
		})
	}

	function removeImage(imageId: string) {
		setImages((previousImages) => {
			const target = previousImages.find((item) => item.id === imageId)
			if (target) {
				URL.revokeObjectURL(target.previewUrl)
			}

			const nextImages = previousImages.filter((item) => item.id !== imageId)
			if (activeImageId === imageId) {
				setActiveImageId(nextImages[0]?.id ?? null)
			}
			return nextImages
		})

		setRecognizedText('')
		setUniqueWords([])
		setSkillSearchInput('')
		setMatchedSkills([])
	}

	function clearImages() {
		setImages((previousImages) => {
			previousImages.forEach((item) => URL.revokeObjectURL(item.previewUrl))
			return []
		})
		setActiveImageId(null)
		setRecognizedText('')
		setUniqueWords([])
		setSkillSearchInput('')
		setMatchedSkills([])
		setErrorMessage(null)
		setStatusMessage(
			'Paste images with Ctrl+V, drag and drop, choose files, or capture snapshots from screen share.',
		)
	}

	function clearScreenSelection() {
		setScreenSelection(null)
		setStatusMessage('Screen selection cleared. Capture will use the full shared screen until you drag a new area.')
	}

	function handleInputChange(event: React.ChangeEvent<HTMLInputElement>) {
		const nextFiles = pickSupportedImages(event.target.files)
		if (nextFiles.length === 0) {
			setErrorMessage('Please choose image files in JPG, PNG, BMP, or WEBP format.')
			return
		}

		appendImages(nextFiles, 'upload')
		event.target.value = ''
	}

	function handleDrop(event: React.DragEvent<HTMLDivElement>) {
		event.preventDefault()
		setIsDraggingOver(false)

		const nextFiles = pickSupportedImages(event.dataTransfer.files)
		if (nextFiles.length === 0) {
			setErrorMessage('Please drop image files in JPG, PNG, BMP, or WEBP format.')
			return
		}

		appendImages(nextFiles, 'drop')
	}

	useEffect(() => {
		imagesRef.current = images
	}, [images])

	useEffect(() => {
		function handlePaste(event: ClipboardEvent) {
			const items = event.clipboardData?.items
			if (!items) {
				return
			}

			const imageFiles = Array.from(items)
				.filter((item) => item.type.startsWith('image/'))
				.map((item) => item.getAsFile())
				.filter((file): file is File => file instanceof File && file.size > 0)
				.map((file, index) =>
					new File([file], `clipboard-image-${Date.now()}-${index}.${file.type.split('/')[1] || 'png'}`, {
						type: file.type || 'image/png',
					}),
				)

			if (imageFiles.length === 0) {
				return
			}

			event.preventDefault()
			appendImages(imageFiles, 'paste')
		}

		window.addEventListener('paste', handlePaste)
		return () => window.removeEventListener('paste', handlePaste)
	}, [])

	useEffect(() => {
		async function handleCaptureShortcut(event: KeyboardEvent) {
			if (!(event.shiftKey && event.code === 'KeyC')) {
				return
			}

			const target = event.target
			if (
				target instanceof HTMLInputElement ||
				target instanceof HTMLTextAreaElement ||
				target instanceof HTMLSelectElement ||
				(target instanceof HTMLElement && target.isContentEditable)
			) {
				return
			}

			if (!isScreenActive) {
				return
			}

			event.preventDefault()
			await captureScreenImage()
		}

		window.addEventListener('keydown', handleCaptureShortcut)
		return () => window.removeEventListener('keydown', handleCaptureShortcut)
	}, [isScreenActive, screenSelection])

	useEffect(() => {
		return () => {
			imagesRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl))

			const stream = streamRef.current
			if (stream) {
				stream.getTracks().forEach((track) => track.stop())
			}
		}
	}, [])

	async function startScreenShare() {
		if (!navigator.mediaDevices?.getDisplayMedia) {
			setErrorMessage('Screen capture is not supported in this browser.')
			return
		}

		try {
			setIsConnectingScreen(true)
			setErrorMessage(null)

			const stream = await navigator.mediaDevices.getDisplayMedia({
				video: {
					frameRate: { ideal: 10, max: 15 },
					width: { ideal: 3840 },
					height: { ideal: 2160 },
				},
				audio: false,
			})

			const currentStream = streamRef.current
			if (currentStream) {
				currentStream.getTracks().forEach((track) => track.stop())
			}

			streamRef.current = stream
			setIsScreenActive(true)
			setScreenSelection(null)
			setStatusMessage('Screen connected. Use "Capture Screen Image" to add snapshots to Selected image.')

			const video = videoRef.current
			if (video) {
				video.srcObject = stream
				await video.play()
			}

			const [track] = stream.getVideoTracks()
			track?.addEventListener('ended', () => {
				setIsScreenActive(false)
				if (videoRef.current) {
					videoRef.current.srcObject = null
				}
				streamRef.current = null
				setStatusMessage('Screen sharing stopped.')
			})
		} catch (error) {
			setErrorMessage(error instanceof Error ? error.message : 'Unable to start screen share.')
		} finally {
			setIsConnectingScreen(false)
		}
	}

	function stopScreenShare() {
		const stream = streamRef.current
		if (stream) {
			stream.getTracks().forEach((track) => track.stop())
		}

		streamRef.current = null
		if (videoRef.current) {
			videoRef.current.srcObject = null
		}
		setIsScreenActive(false)
		setScreenSelection(null)
		setIsSelectingScreen(false)
		selectionStartRef.current = null
		setStatusMessage('Screen sharing stopped.')
	}

	function updateScreenSelection(clientX: number, clientY: number) {
		const container = screenPreviewRef.current
		const start = selectionStartRef.current
		if (!container || !start) {
			return
		}

		const rect = container.getBoundingClientRect()
		const currentX = Math.min(Math.max(clientX - rect.left, 0), rect.width)
		const currentY = Math.min(Math.max(clientY - rect.top, 0), rect.height)

		const x = Math.min(start.x, currentX)
		const y = Math.min(start.y, currentY)
		const width = Math.abs(currentX - start.x)
		const height = Math.abs(currentY - start.y)

		setScreenSelection({ x, y, width, height })
	}

	function handleScreenPointerDown(event: React.PointerEvent<HTMLDivElement>) {
		if (!isScreenActive) {
			return
		}

		const container = screenPreviewRef.current
		if (!container) {
			return
		}

		const rect = container.getBoundingClientRect()
		const x = Math.min(Math.max(event.clientX - rect.left, 0), rect.width)
		const y = Math.min(Math.max(event.clientY - rect.top, 0), rect.height)

		selectionStartRef.current = { x, y }
		setScreenSelection({ x, y, width: 0, height: 0 })
		setIsSelectingScreen(true)
		container.setPointerCapture(event.pointerId)
	}

	function handleScreenPointerMove(event: React.PointerEvent<HTMLDivElement>) {
		if (!isSelectingScreen) {
			return
		}

		updateScreenSelection(event.clientX, event.clientY)
	}

	function handleScreenPointerUp(event: React.PointerEvent<HTMLDivElement>) {
		if (!isSelectingScreen) {
			return
		}

		updateScreenSelection(event.clientX, event.clientY)
		setIsSelectingScreen(false)
		selectionStartRef.current = null

		const container = screenPreviewRef.current
		container?.releasePointerCapture(event.pointerId)

		setScreenSelection((current) => {
			if (!current || current.width < 8 || current.height < 8) {
				setStatusMessage('Selection was too small, so capture will use the full shared screen.')
				return null
			}

			setStatusMessage('Selection updated. Capture will use only the highlighted screen area.')
			return current
		})
	}

	async function captureScreenImage() {
		const video = videoRef.current
		const preview = screenPreviewRef.current
		if (!video || !streamRef.current || !preview) {
			setErrorMessage('Start screen share first before capturing.')
			return
		}

		if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
			setErrorMessage('Screen preview is not ready yet. Please try again in a moment.')
			return
		}

		const previewRect = preview.getBoundingClientRect()
		const scaleX = video.videoWidth / previewRect.width
		const scaleY = video.videoHeight / previewRect.height

		const cropX = screenSelection ? Math.round(screenSelection.x * scaleX) : 0
		const cropY = screenSelection ? Math.round(screenSelection.y * scaleY) : 0
		const cropWidth = screenSelection
			? Math.max(1, Math.round(screenSelection.width * scaleX))
			: video.videoWidth
		const cropHeight = screenSelection
			? Math.max(1, Math.round(screenSelection.height * scaleY))
			: video.videoHeight

		const exportScale = screenCaptureScale
		const canvas = document.createElement('canvas')
		canvas.width = cropWidth * exportScale
		canvas.height = cropHeight * exportScale

		const context = canvas.getContext('2d')
		if (!context) {
			setErrorMessage('Unable to capture the current screen image.')
			return
		}

		context.imageSmoothingEnabled = true
		context.imageSmoothingQuality = 'high'
		context.drawImage(video, cropX, cropY, cropWidth, cropHeight, 0, 0, canvas.width, canvas.height)

		const blob = await new Promise<Blob | null>((resolve) => {
			canvas.toBlob(resolve, 'image/png')
		})

		if (!blob) {
			setErrorMessage('Unable to convert the screen snapshot into an image.')
			return
		}

		const file = new File([blob], `screen-capture-${Date.now()}.png`, {
			type: 'image/png',
		})

		appendImages([file], 'screen')
		setStatusMessage(
			`Captured high-resolution snapshot (${canvas.width}x${canvas.height}) for OCR at ${exportScale}x.`,
		)
	}

	async function handleRecognize() {
		if (images.length === 0) {
			setErrorMessage('Please add at least 1 image first.')
			return
		}

		try {
			setIsRecognizing(true)
			setErrorMessage(null)
			setStatusMessage(`Running Japanese OCR on ${images.length} image${images.length > 1 ? 's' : ''}...`)

			const results = await Promise.all(images.map((item) => imageOcrApi(item.file, ocrMode)))
			const mergedText = results
				.map((result, index) => `# Image ${index + 1}: ${images[index]?.file.name}\n${result.text}`)
				.join('\n\n')

			setRecognizedText(mergedText)

			const words = await extractWordsApi(results.map((result) => result.text).join('\n'))
			setUniqueWords(words)

			// Match skills if UMA mode
			if (ocrMode === 'uma-musume') {
				const candidates = buildSkillSearchCandidates(mergedText, words)
				setSkillSearchInput(candidates.join('\n'))
				await handleMatchSkills(candidates)
			}

			setStatusMessage(
				`OCR complete for ${results.length} image${results.length > 1 ? 's' : ''}. Extracted ${words.length} unique words.`,
			)
		} catch (error) {
			setRecognizedText('')
			setUniqueWords([])
			setSkillSearchInput('')
			setMatchedSkills([])
			setErrorMessage(error instanceof Error ? error.message : 'Image OCR failed.')
		} finally {
			setIsRecognizing(false)
		}
	}

	async function handleMatchSkills(textList: string[]) {
		try {
			setIsMatchingSkills(true)
			const cleanedInputs = textList
				.map((text) => text.trim())
				.filter((text) => text.length >= 2)
				.filter((text) => !isLikelyNoiseText(text))
				.slice(0, 150)

			if (cleanedInputs.length === 0) {
				setMatchedSkills([])
				setStatusMessage('No text available for skill matching.')
				return
			}

			const result = await matchOCRSkills(cleanedInputs)
			const normalizedMatches: MatchedSkillRow[] = result.matches.map((item: SkillMatch) => ({
				ocrText: item.ocrText,
				confidence: item.confidence,
				id: item.matchedSkill?.id ?? '-',
				name: item.matchedSkill?.name ?? '-',
				jpName: item.matchedSkill?.jpName ?? '-',
				skillPoints: item.matchedSkill?.skillPoints,
				evalPoints: item.matchedSkill?.evalPoints,
			}))
				.sort((a, b) => b.confidence - a.confidence)
			setMatchedSkills(normalizedMatches)

			if (result.matchedCount > 0) {
				setStatusMessage(
					`Matched ${result.matchedCount} out of ${result.totalTexts} texts to skills after noise filtering.`,
				)
			} else {
				setStatusMessage('No skills matched from the extracted text.')
			}
		} catch (error) {
			console.error('Skill matching failed:', error)
			setMatchedSkills([])
		} finally {
			setIsMatchingSkills(false)
		}
	}

	async function handleSearchSkillsFromInput() {
		const candidates = skillSearchInput
			.split(/\r?\n/)
			.map((line) => line.trim())
			.filter((line) => line.length >= 2)

		await handleMatchSkills(candidates)
	}

	async function handleCopyText(value: string, successMessage: string) {
		if (!value) {
			return
		}

		try {
			await navigator.clipboard.writeText(value)
			setStatusMessage(successMessage)
		} catch {
			setErrorMessage('Unable to copy text automatically in this browser.')
		}
	}

	function handleDownload(filename: string, value: string) {
		if (!value) {
			return
		}

		const blob = new Blob([value], { type: 'text/plain;charset=utf-8' })
		const url = URL.createObjectURL(blob)
		const anchor = document.createElement('a')

		anchor.href = url
		anchor.download = filename
		document.body.appendChild(anchor)
		anchor.click()
		anchor.remove()
		URL.revokeObjectURL(url)
		setStatusMessage(`Downloaded ${filename}`)
	}

	return (
		<main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.18),_transparent_30%),linear-gradient(180deg,_#0f172a_0%,_#111827_48%,_#020617_100%)] text-slate-100">
			<div className="mx-auto max-w-[96rem] px-4 py-10 sm:px-6 lg:px-8">
				<header>
					<div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.3em] text-emerald-200">
						<ScanText className="h-4 w-4" />
						Image OCR
					</div>
					<h1 className="mt-5 text-3xl font-bold text-slate-100">Japanese Image OCR</h1>
					<p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-300">
						Extract Japanese text from multiple images. You can upload files, paste with Ctrl+V,
						or capture snapshots from a live screen share into the same selected image list.
					</p>
				</header>

				<div className="mt-8 grid gap-6 xl:grid-cols-[1.22fr_0.78fr]">
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
									? 'border-emerald-400 bg-slate-900/80'
									: 'border-slate-600 hover:border-emerald-400/80'
							}`}
						>
							<div>
								<div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-800 ring-1 ring-slate-600/80">
									<Upload className="h-8 w-8 text-emerald-300" />
								</div>
								<h2 className="text-xl font-semibold text-slate-100">Drop, paste, or capture images</h2>
								<p className="mt-2 text-sm text-slate-300">
									Click to choose multiple files, press Ctrl+V, or use screen capture below
								</p>
							</div>

							<input
								ref={inputRef}
								type="file"
								accept=".jpg,.jpeg,.png,.bmp,.webp,image/*"
								multiple
								onChange={handleInputChange}
								className="hidden"
							/>
						</div>

						<section className="rounded-3xl border border-slate-700/80 bg-slate-900/60 p-6">
							<div className="flex flex-wrap items-center justify-between gap-3">
								<div>
									<h3 className="text-lg font-semibold text-slate-100">Screen capture</h3>
									<p className="text-sm text-slate-300">
										Share your screen once, then capture as many snapshots as you need into the selected image list.
									</p>
								</div>
								<div className="flex flex-wrap gap-3">
									<button
										type="button"
										onClick={startScreenShare}
										disabled={isConnectingScreen || isScreenActive}
										className="inline-flex items-center gap-2 rounded-xl border border-slate-600 px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
									>
										<Share2 className="h-4 w-4" />
										{isConnectingScreen ? 'Connecting...' : 'Share Screen'}
									</button>
									<button
										type="button"
										onClick={captureScreenImage}
										disabled={!isScreenActive}
										className="inline-flex items-center gap-2 rounded-xl bg-emerald-400 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
									>
										<Camera className="h-4 w-4" />
										Capture Screen Image
									</button>
									<button
										type="button"
										onClick={stopScreenShare}
										disabled={!isScreenActive}
										className="inline-flex items-center gap-2 rounded-xl border border-slate-600 px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
									>
										<Monitor className="h-4 w-4" />
										Stop Share
									</button>
								</div>
							</div>

							<div className="mt-4 rounded-2xl border border-dashed border-slate-700 bg-slate-950/50 px-4 py-4 text-sm text-slate-400">
								{isScreenActive
									? 'Screen share is active. Capture snapshots whenever the text you want is visible.'
									: 'No active screen share yet.'}
							</div>

							<div className="mt-4 rounded-2xl border border-slate-700 bg-slate-950/60 px-4 py-4">
								<div className="text-sm font-medium text-slate-200">Capture Quality</div>
								<p className="mt-1 text-xs text-slate-400">
									Higher scale gives clearer OCR but larger image size and slower processing.
								</p>
								<div className="mt-3 flex flex-wrap gap-2">
									{SCREEN_CAPTURE_QUALITY_OPTIONS.map((option) => (
										<button
											key={option.label}
											type="button"
											onClick={() => setScreenCaptureScale(option.value)}
											className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
												screenCaptureScale === option.value
													? 'bg-emerald-400 text-slate-950'
													: 'border border-slate-600 text-slate-200 hover:bg-slate-800'
											}`}
										>
											{option.label}
										</button>
									))}
								</div>
							</div>

							<div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-slate-700 bg-slate-950/60 px-4 py-3 text-sm text-slate-300">
								<Keyboard className="h-4 w-4 text-emerald-300" />
								<span>
									Shortcut: <span className="font-semibold text-slate-100">Shift + C</span> to capture the current region while this page is focused.
								</span>
							</div>

							<div className="mt-4 overflow-hidden rounded-2xl border border-slate-700 bg-slate-950/70">
								<div
									ref={screenPreviewRef}
									onPointerDown={handleScreenPointerDown}
									onPointerMove={handleScreenPointerMove}
									onPointerUp={handleScreenPointerUp}
									onPointerLeave={handleScreenPointerUp}
									className={`relative aspect-[16/10] min-h-[420px] w-full overflow-hidden bg-slate-950 xl:min-h-[560px] ${
										isScreenActive ? 'cursor-crosshair' : 'cursor-not-allowed'
									}`}
								>
									<video
										ref={videoRef}
										className="h-full w-full object-contain"
										playsInline
										muted
									/>

									{screenSelection ? (
										<div
											className="pointer-events-none absolute border-2 border-emerald-300 bg-emerald-400/15 shadow-[0_0_0_9999px_rgba(2,6,23,0.45)]"
											style={{
												left: `${screenSelection.x}px`,
												top: `${screenSelection.y}px`,
												width: `${screenSelection.width}px`,
												height: `${screenSelection.height}px`,
											}}
										/>
									) : null}

									{!isScreenActive ? (
										<div className="absolute inset-0 flex items-center justify-center bg-slate-950/70 px-6 text-center text-sm text-slate-400">
											Start screen share to preview it here, then drag to choose the exact OCR area.
										</div>
									) : null}
								</div>

								<div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-700 px-4 py-3 text-sm text-slate-300">
									<div>
										{screenSelection
											? 'Selected region will be captured for OCR.'
											: 'No region selected yet. Capture will use the full shared screen.'}
									</div>
									<button
										type="button"
										onClick={clearScreenSelection}
										disabled={!screenSelection}
										className="rounded-lg border border-slate-600 px-3 py-2 text-xs font-medium text-slate-200 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
									>
										Clear Selection
									</button>
								</div>
							</div>
						</section>

						<section className="rounded-3xl border border-slate-700/80 bg-slate-900/60 p-6">
							<div className="mb-4 flex items-center justify-between gap-4">
								<div>
									<h3 className="text-lg font-semibold text-slate-100">Selected image</h3>
									<p className="text-sm text-slate-300">
										Use screenshots, manga panels, notes, or printed Japanese text
									</p>
								</div>
								<button
									type="button"
									onClick={clearImages}
									disabled={images.length === 0}
									className="rounded-xl border border-slate-600 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
								>
									Clear all
								</button>
							</div>

							{activeImage ? (
								<div className="overflow-hidden rounded-3xl border border-slate-700 bg-slate-950/70">
									<img
										src={activeImage.previewUrl}
										alt={activeImage.file.name}
										className="max-h-[420px] w-full object-contain bg-slate-950"
									/>
									<div className="flex items-start justify-between gap-4 border-t border-slate-700 px-4 py-4">
										<div>
											<div className="text-sm font-medium text-slate-100">{activeImage.file.name}</div>
											<div className="mt-1 text-xs text-slate-400">
												{formatFileSize(activeImage.file.size)} - {sourceLabel(activeImage.source)}
											</div>
										</div>
										<button
											type="button"
											onClick={() => removeImage(activeImage.id)}
											className="rounded-lg p-2 text-slate-400 transition hover:bg-rose-500/10 hover:text-rose-300"
											aria-label={`Remove ${activeImage.file.name}`}
										>
											<X className="h-4 w-4" />
										</button>
									</div>
								</div>
							) : (
								<div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/50 px-6 py-12 text-center text-sm text-slate-400">
									<div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900">
										<ImagePlus className="h-6 w-6 text-slate-500" />
									</div>
									No images selected yet
								</div>
							)}

							{images.length > 0 ? (
								<div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
									{images.map((item, index) => (
										<button
											key={item.id}
											type="button"
											onClick={() => setActiveImageId(item.id)}
											className={`overflow-hidden rounded-2xl border text-left transition ${
												item.id === activeImage?.id
													? 'border-emerald-400 bg-emerald-500/10'
													: 'border-slate-700 bg-slate-950/70 hover:border-slate-500'
											}`}
										>
											<img src={item.previewUrl} alt={item.file.name} className="h-28 w-full object-cover" />
											<div className="px-3 py-3">
												<div className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300">
													Image #{index + 1}
												</div>
												<div className="mt-1 line-clamp-2 text-sm text-slate-100">{item.file.name}</div>
												<div className="mt-1 text-xs text-slate-400">{sourceLabel(item.source)}</div>
											</div>
										</button>
									))}
								</div>
							) : null}
						</section>
					</div>

					<aside className="space-y-6">
						<section className="rounded-3xl border border-slate-700/80 bg-slate-900/60 p-6">
							<div className="flex items-center justify-between gap-3">
								<h3 className="text-lg font-semibold text-slate-100">Recognized text</h3>
								<div className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-950/70 px-3 py-1.5 text-xs text-slate-300">
									<ClipboardPaste className="h-3.5 w-3.5" />
									Ctrl+V supported
								</div>
							</div>

							<p className="mt-3 text-sm leading-relaxed text-slate-300">
								The OCR will process every selected image, merge the extracted text, and keep a separate unique word list.
							</p>

							<div className="mt-5 rounded-2xl border border-slate-700 bg-slate-950/70 p-4">
								<div className="text-sm font-medium text-slate-200">OCR mode</div>
								<div className="mt-3 flex flex-wrap gap-3">
									<button
										type="button"
										onClick={() => setOcrMode('uma-musume')}
										className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
											ocrMode === 'uma-musume'
												? 'bg-emerald-400 text-slate-950'
												: 'border border-slate-600 text-slate-200 hover:bg-slate-800'
										}`}
									>
										Uma Musume Mode
									</button>
									<button
										type="button"
										onClick={() => setOcrMode('default')}
										className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
											ocrMode === 'default'
												? 'bg-emerald-400 text-slate-950'
												: 'border border-slate-600 text-slate-200 hover:bg-slate-800'
										}`}
									>
										Default Mode
									</button>
								</div>
								<p className="mt-3 text-xs leading-relaxed text-slate-400">
									Uma Musume Mode applies game-specific OCR cleanup and is recommended for skill lists and UI screenshots.
								</p>
							</div>

							<div className="mt-5 flex flex-wrap gap-3">
								<button
									type="button"
									onClick={handleRecognize}
									disabled={images.length === 0 || isRecognizing}
									className="rounded-xl bg-emerald-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
								>
									{isRecognizing ? 'Recognizing...' : `Extract Text from ${images.length || 0} Image${images.length === 1 ? '' : 's'}`}
								</button>
								<button
									type="button"
									onClick={() =>
										void handleCopyText(recognizedText, 'Recognized text copied to clipboard.')
									}
									disabled={!recognizedText}
									className="inline-flex items-center gap-2 rounded-xl border border-slate-600 px-4 py-3 text-sm font-medium text-slate-200 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
								>
									<Copy className="h-4 w-4" />
									Copy Text
								</button>
								<button
									type="button"
									onClick={() => handleDownload('ocr-result.txt', recognizedText)}
									disabled={!recognizedText}
									className="inline-flex items-center gap-2 rounded-xl border border-slate-600 px-4 py-3 text-sm font-medium text-slate-200 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
								>
									<Download className="h-4 w-4" />
									Download TXT
								</button>
							</div>

							{statusMessage ? (
								<div className="mt-5 rounded-2xl border border-emerald-400/20 bg-emerald-500/8 px-4 py-4 text-sm text-emerald-100">
									{statusMessage}
								</div>
							) : null}

							{errorMessage ? (
								<div className="mt-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-4 text-sm text-rose-100">
									{errorMessage}
								</div>
							) : null}

							<div className="mt-5 rounded-3xl border border-slate-700 bg-slate-950/70 p-4">
								<textarea
									value={recognizedText}
									onChange={(event) => setRecognizedText(event.target.value)}
									placeholder="OCR text from all selected images will appear here"
									className="min-h-[360px] w-full resize-none rounded-2xl border border-slate-700 bg-slate-950 px-4 py-4 text-sm leading-7 text-slate-100 outline-none transition focus:border-emerald-400"
								/>
							</div>
						</section>

						{ocrMode === 'uma-musume' && (
							<section className="rounded-3xl border border-slate-700/80 bg-slate-900/60 p-6">
								<div className="flex items-center justify-between gap-3">
									<h3 className="text-lg font-semibold text-slate-100">Matched Skills</h3>
									<span className="rounded-full border border-slate-700 bg-slate-950/70 px-3 py-1 text-xs text-slate-300">
										{visibleMatchedSkills.length} matched (&gt;= {Math.round(MIN_CONFIDENCE * 100)}%)
									</span>
								</div>

								<p className="mt-3 text-sm leading-relaxed text-slate-300">
									OCR text is converted into skill search candidates, then matched against real UMA skills.
								</p>

								<div className="mt-4 rounded-2xl border border-slate-700 bg-slate-950/70 p-4">
									<div className="mb-2 text-sm font-medium text-slate-200">Skill search input from OCR</div>
									<textarea
										value={skillSearchInput}
										onChange={(event) => setSkillSearchInput(event.target.value)}
										placeholder="After OCR, extracted lines/words for skill search will appear here"
										className="min-h-32 w-full resize-y rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-xs leading-6 text-slate-100 outline-none transition focus:border-emerald-400"
									/>
									<div className="mt-3 flex gap-3">
										<button
											type="button"
											onClick={() => void handleSearchSkillsFromInput()}
											disabled={isMatchingSkills || !skillSearchInput.trim()}
											className="rounded-xl bg-emerald-400 px-4 py-2 text-xs font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
										>
											{isMatchingSkills ? 'Matching...' : 'Search & Match Skills'}
										</button>
									</div>
								</div>

								{isMatchingSkills ? (
									<div className="mt-5 flex items-center justify-center rounded-2xl border border-slate-700 bg-slate-950/70 py-8">
										<div className="text-center">
											<div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-slate-600 border-t-emerald-400"></div>
											<p className="text-sm text-slate-400">Matching skills...</p>
										</div>
									</div>
								) : visibleMatchedSkills.length > 0 ? (
									<div className="mt-5 overflow-x-auto rounded-2xl border border-slate-700">
										<table className="w-full text-sm">
											<thead>
												<tr className="border-b border-slate-700 bg-slate-950/50">
													<th className="px-4 py-3 text-left font-semibold text-slate-300">Skill Name</th>
													<th className="px-4 py-3 text-left font-semibold text-slate-300">Japanese</th>
													<th className="px-4 py-3 text-left font-semibold text-slate-300">OCR Input</th>
													<th className="px-4 py-3 text-center font-semibold text-slate-300">Confidence</th>
													<th className="px-4 py-3 text-right font-semibold text-slate-300">Skill Pts</th>
													<th className="px-4 py-3 text-right font-semibold text-slate-300">Eval Pts</th>
												</tr>
											</thead>
											<tbody>
														{visibleMatchedSkills.map((skill, index) => {
													const confidencePercent = Math.round(skill.confidence * 100)
													const isHighConfidence = skill.confidence >= 0.75

													return (
														<tr key={index} className="border-b border-slate-800/50 hover:bg-slate-900/50 transition">
																	<td className="px-4 py-3 text-slate-100 font-medium">
																		<Link
																			to={`/uma-skills/${encodeURIComponent(String(skill.id))}`}
																			className="transition hover:text-emerald-300"
																		>
																			{skill.name}
																		</Link>
																	</td>
															<td className="px-4 py-3 text-slate-400">{skill.jpName}</td>
																	<td className="px-4 py-3 text-slate-400">{skill.ocrText}</td>
															<td className="px-4 py-3 text-center">
																<span
																	className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
																		isHighConfidence
																			? 'bg-emerald-400/15 text-emerald-300'
																			: 'bg-amber-400/15 text-amber-300'
																	}`}
																>
																	{isHighConfidence && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>}
																	{confidencePercent}%
																</span>
															</td>
															<td className="px-4 py-3 text-right text-slate-300">{skill.skillPoints}</td>
															<td className="px-4 py-3 text-right text-slate-300">{skill.evalPoints}</td>
														</tr>
													)
												})}
											</tbody>
										</table>
									</div>
								) : (
									<div className="mt-5 rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-8 text-center text-sm text-slate-400">
										No skills passed the minimum confidence threshold. Try better OCR crops or adjust skill input.
									</div>
								)}

								{visibleMatchedSkills.length > 0 && (
									<div className="mt-5 flex flex-wrap gap-3">
										<button
											type="button"
											onClick={() => {
													const skillsList = visibleMatchedSkills
														.map((s) => `${s.name} (${s.jpName}) - ${Math.round(s.confidence * 100)}%`)
													.join('\n')
												void handleCopyText(skillsList, 'Matched skills copied to clipboard.')
											}}
											className="inline-flex items-center gap-2 rounded-xl border border-slate-600 px-4 py-3 text-sm font-medium text-slate-200 transition hover:bg-slate-800"
										>
											<Copy className="h-4 w-4" />
											Copy Matches
										</button>
										<button
											type="button"
											onClick={() => {
													const skillsList = visibleMatchedSkills
														.map((s) => `${s.name} (${s.jpName}) - ${Math.round(s.confidence * 100)}%`)
													.join('\n')
												void handleDownload('matched-skills.txt', skillsList)
											}}
											className="inline-flex items-center gap-2 rounded-xl border border-slate-600 px-4 py-3 text-sm font-medium text-slate-200 transition hover:bg-slate-800"
										>
											<Download className="h-4 w-4" />
											Export Matches
										</button>
									</div>
								)}
							</section>
						)}

						<section className="rounded-3xl border border-slate-700/80 bg-slate-900/60 p-6">
							<div className="flex items-center justify-between gap-3">
								<h3 className="text-lg font-semibold text-slate-100">Unique words</h3>
								<span className="rounded-full border border-slate-700 bg-slate-950/70 px-3 py-1 text-xs text-slate-300">
									{uniqueWords.length} items
								</span>
							</div>

							<p className="mt-3 text-sm leading-relaxed text-slate-300">
								Words are deduplicated, so the same word only appears once in the list.
							</p>

							<div className="mt-5 flex flex-wrap gap-3">
								<button
									type="button"
									onClick={() =>
										void handleCopyText(flattenWordEntries(uniqueWords), 'Unique word list copied to clipboard.')
									}
									disabled={uniqueWords.length === 0}
									className="inline-flex items-center gap-2 rounded-xl border border-slate-600 px-4 py-3 text-sm font-medium text-slate-200 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
								>
									<Copy className="h-4 w-4" />
									Copy Words
								</button>
								<button
									type="button"
									onClick={() => handleDownload('ocr-unique-words.txt', flattenWordEntries(uniqueWords))}
									disabled={uniqueWords.length === 0}
									className="inline-flex items-center gap-2 rounded-xl border border-slate-600 px-4 py-3 text-sm font-medium text-slate-200 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
								>
									<Download className="h-4 w-4" />
									Download Words
								</button>
							</div>

							<div className="mt-5 rounded-3xl border border-slate-700 bg-slate-950/70 p-4">
								<textarea
									value={flattenWordEntries(uniqueWords)}
									readOnly
									placeholder="Unique words extracted from OCR text will appear here"
									className="min-h-[260px] w-full resize-none rounded-2xl border border-slate-700 bg-slate-950 px-4 py-4 text-sm leading-7 text-slate-100 outline-none"
								/>
							</div>
						</section>
					</aside>
				</div>
			</div>
		</main>
	)
}
