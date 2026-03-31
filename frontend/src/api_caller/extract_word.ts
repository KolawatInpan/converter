import axios from 'axios'
import { API_BASE_URL } from './api_base'

function getAxiosErrorMessage(error: unknown): string {
	if (!axios.isAxiosError(error)) {
		return 'Vocabulary extraction failed due to an unexpected error.'
	}

	const responseData = error.response?.data
	if (typeof responseData === 'object' && responseData && 'detail' in responseData) {
		const detail = (responseData as { detail?: string }).detail
		if (detail) {
			return detail
		}
	}

	return error.message || 'Vocabulary extraction failed.'
}

export interface WordEntry {
	base: string
	surfaces: string[]
}

export async function extractWordsApi(text: string): Promise<WordEntry[]> {
	try {
		const response = await axios.post<WordEntry[]>(`${API_BASE_URL}/api/japan/extract-words`, {
			text,
		})

		return response.data
	} catch (error) {
		throw new Error(getAxiosErrorMessage(error))
	}
}
