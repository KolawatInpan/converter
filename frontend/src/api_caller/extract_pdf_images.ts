import axios from 'axios'
import { API_BASE_URL } from './api_base'

async function getAxiosErrorMessage(error: unknown): Promise<string> {
	if (!axios.isAxiosError(error)) {
		return 'Extract PDF images failed due to an unexpected error.'
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
			return error.message || 'Extract PDF images request failed.'
		}
	}

	if (typeof responseData === 'object' && responseData && 'detail' in responseData) {
		const detail = (responseData as { detail?: string }).detail
		if (detail) {
			return detail
		}
	}

	return error.message || 'Extract PDF images request failed.'
}

export async function extractPdfImagesApi(file: File): Promise<Blob> {
	const formData = new FormData()
	formData.append('file', file)

	try {
		const response = await axios.post(`${API_BASE_URL}/api/pdf/extract-images`, formData, {
			responseType: 'blob',
		})

		return response.data
	} catch (error) {
		throw new Error(await getAxiosErrorMessage(error))
	}
}
