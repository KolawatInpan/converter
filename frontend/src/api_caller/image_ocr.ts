import axios from 'axios'
import { API_BASE_URL } from './api_base'

function getAxiosErrorMessage(error: unknown): string {
	if (!axios.isAxiosError(error)) {
		return 'Image OCR failed due to an unexpected error.'
	}

	const responseData = error.response?.data
	if (typeof responseData === 'object' && responseData && 'detail' in responseData) {
		const detail = (responseData as { detail?: string }).detail
		if (detail) {
			return detail
		}
	}

	return error.message || 'Image OCR failed.'
}

export interface ImageOcrResponse {
	filename: string
	language: string
	text: string
}

export type ImageOcrMode = 'default' | 'uma-musume'

export async function imageOcrApi(file: File, mode: ImageOcrMode = 'default'): Promise<ImageOcrResponse> {
	const formData = new FormData()
	formData.append('file', file)
	formData.append('mode', mode)

	try {
		const response = await axios.post<ImageOcrResponse>(`${API_BASE_URL}/api/japan/image-ocr`, formData)
		return response.data
	} catch (error) {
		throw new Error(getAxiosErrorMessage(error))
	}
}
