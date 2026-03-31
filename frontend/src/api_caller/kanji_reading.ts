import axios from 'axios'
import { API_BASE_URL } from './api_base'

function getAxiosErrorMessage(error: unknown): string {
	if (!axios.isAxiosError(error)) {
		return 'Kanji reading failed due to an unexpected error.'
	}

	const responseData = error.response?.data
	if (typeof responseData === 'object' && responseData && 'detail' in responseData) {
		const detail = (responseData as { detail?: string }).detail
		if (detail) {
			return detail
		}
	}

	return error.message || 'Kanji reading failed.'
}

export interface KanjiCandidateDictionaryPreview {
	has_entry: boolean
	reading: string
	meanings: string[]
}

export interface KanjiCandidate {
	character: string
	score: number
	confidence: number
	hits: number
	dictionary: KanjiCandidateDictionaryPreview
}

export interface KanjiReadingResponse {
	best_candidate: string
	candidate_count: number
	candidates: KanjiCandidate[]
}

export async function kanjiReadingApi(file: File): Promise<KanjiReadingResponse> {
	const formData = new FormData()
	formData.append('file', file)

	try {
		const response = await axios.post<KanjiReadingResponse>(
			`${API_BASE_URL}/api/japan/kanji-reading`,
			formData,
		)
		return response.data
	} catch (error) {
		throw new Error(getAxiosErrorMessage(error))
	}
}
