import axios from 'axios'
import { API_BASE_URL } from './api_base'

export type ConvertMode = 'from-pdf' | 'to-pdf'

type ConvertResponse = {
	blob: Blob
	filename: string
}

function getFilenameFromDisposition(dispositionHeader?: string) {
	if (!dispositionHeader) {
		return null
	}

	const utfMatch = dispositionHeader.match(/filename\*=UTF-8''([^;]+)/i)
	if (utfMatch?.[1]) {
		return decodeURIComponent(utfMatch[1])
	}

	const plainMatch = dispositionHeader.match(/filename="?([^"]+)"?/i)
	return plainMatch?.[1] ?? null
}

function getFallbackFilename(blob: Blob, mode: ConvertMode, targetFormat: string) {
	if (blob.type.includes('zip')) {
		return mode === 'from-pdf'
			? `pdf-to-${targetFormat.toLowerCase()}.zip`
			: 'converted-files.zip'
	}

	if (blob.type.includes('pdf')) {
		return 'converted.pdf'
	}

	if (blob.type.includes('text/plain')) {
		return 'converted.txt'
	}

	return mode === 'from-pdf' ? `converted.${targetFormat.toLowerCase()}` : 'converted.pdf'
}

async function getAxiosErrorMessage(error: unknown): Promise<string> {
	if (!axios.isAxiosError(error)) {
		return 'Conversion failed due to an unexpected error.'
	}

	const responseData = error.response?.data
	if (responseData instanceof Blob) {
		try {
			const text = await responseData.text()
			const parsed = JSON.parse(text) as { detail?: string }
			if (parsed?.detail) {
				return parsed.detail
			}
		} catch {
			return error.message || 'Conversion request failed.'
		}
	}

	if (typeof responseData === 'object' && responseData && 'detail' in responseData) {
		const detail = (responseData as { detail?: string }).detail
		if (detail) {
			return detail
		}
	}

	return error.message || 'Conversion request failed.'
}

export async function convertPdfApi(
	files: File[],
	mode: ConvertMode,
	targetFormat: string,
): Promise<ConvertResponse> {
	const formData = new FormData()
	files.forEach((file) => {
		formData.append('files', file)
	})
	formData.append('mode', mode)
	formData.append('target_format', targetFormat.toLowerCase())

	try {
		const response = await axios.post(`${API_BASE_URL}/api/pdf/convert`, formData, {
			responseType: 'blob',
		})

		const disposition = response.headers['content-disposition'] as string | undefined
		const filename =
			getFilenameFromDisposition(disposition) ??
			getFallbackFilename(response.data, mode, targetFormat)

		return {
			blob: response.data,
			filename,
		}
	} catch (error) {
		throw new Error(await getAxiosErrorMessage(error))
	}
}

export function triggerBlobDownload(blob: Blob, filename: string) {
	const url = window.URL.createObjectURL(blob)
	const anchor = document.createElement('a')
	anchor.href = url
	anchor.download = filename
	document.body.appendChild(anchor)
	anchor.click()
	anchor.remove()
	window.URL.revokeObjectURL(url)
}
