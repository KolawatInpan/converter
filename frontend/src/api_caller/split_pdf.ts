import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:5000'

export type SplitMode = 'every-page' | 'page-count'

async function getAxiosErrorMessage(error: unknown): Promise<string> {
	if (!axios.isAxiosError(error)) {
		return 'Split PDF failed due to an unexpected error.'
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
			return error.message || 'Split PDF request failed.'
		}
	}

	if (typeof responseData === 'object' && responseData && 'detail' in responseData) {
		const detail = (responseData as { detail?: string }).detail
		if (detail) {
			return detail
		}
	}

	return error.message || 'Split PDF request failed.'
}

export async function splitPdfApi(
	file: File,
	mode: SplitMode,
	pagesPerSplit: number,
): Promise<Blob> {
	const formData = new FormData()
	formData.append('file', file)
	formData.append('mode', mode)
	formData.append('pages_per_split', String(pagesPerSplit))

	try {
		const response = await axios.post(`${API_BASE_URL}/api/pdf/split`, formData, {
			responseType: 'blob',
		})

		return response.data
	} catch (error) {
		throw new Error(await getAxiosErrorMessage(error))
	}
}
