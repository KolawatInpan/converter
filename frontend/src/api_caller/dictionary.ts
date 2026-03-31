import axios from 'axios'
import { API_BASE_URL } from './api_base'

function getAxiosErrorMessage(error: unknown): string {
	if (!axios.isAxiosError(error)) {
		return 'Dictionary lookup failed due to an unexpected error.'
	}

	const responseData = error.response?.data
	if (typeof responseData === 'object' && responseData && 'detail' in responseData) {
		const detail = (responseData as { detail?: string }).detail
		if (detail) {
			return detail
		}
	}

	return error.message || 'Dictionary lookup failed.'
}

export interface DictionarySegment {
	text: string
	furigana: string
}

export interface DictionaryEntry {
	word: string
	furigana: string
	segments: DictionarySegment[]
	pos: string[]
	meanings: string[]
}

export interface DictionaryLookupResponse {
	query: string
	results: DictionaryEntry[]
}

function toSafeString(value: unknown): string {
	return typeof value === 'string' ? value : ''
}

function normalizeSegments(segments: unknown): DictionarySegment[] {
	if (!Array.isArray(segments)) {
		return []
	}

	return segments
		.map((segment) => {
			if (!segment || typeof segment !== 'object') {
				return null
			}

			const text = toSafeString((segment as { text?: unknown }).text)
			const furigana = toSafeString((segment as { furigana?: unknown }).furigana)

			if (!text) {
				return null
			}

			return { text, furigana }
		})
		.filter((segment): segment is DictionarySegment => segment !== null)
}

function normalizeStringArray(values: unknown): string[] {
	if (!Array.isArray(values)) {
		return []
	}

	return values.filter((value): value is string => typeof value === 'string' && value.length > 0)
}

function normalizeEntry(entry: unknown): DictionaryEntry | null {
	if (!entry || typeof entry !== 'object') {
		return null
	}

	const word = toSafeString((entry as { word?: unknown }).word)
	const furigana = toSafeString((entry as { furigana?: unknown }).furigana)

	if (!word) {
		return null
	}

	return {
		word,
		furigana,
		segments: normalizeSegments((entry as { segments?: unknown }).segments),
		pos: normalizeStringArray((entry as { pos?: unknown }).pos),
		meanings: normalizeStringArray((entry as { meanings?: unknown }).meanings),
	}
}

export async function lookupDictionaryApi(query: string): Promise<DictionaryLookupResponse> {
	try {
		const response = await axios.post<DictionaryLookupResponse>(`${API_BASE_URL}/api/japan/dictionary`, {
			query,
		})

		const data = response.data
		return {
			query: toSafeString((data as { query?: unknown }).query),
			results: Array.isArray((data as { results?: unknown }).results)
				? ((data as { results: unknown[] }).results
						.map(normalizeEntry)
						.filter((entry): entry is DictionaryEntry => entry !== null))
				: [],
		}
	} catch (error) {
		throw new Error(getAxiosErrorMessage(error))
	}
}
