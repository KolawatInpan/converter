import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:5000'

function getAxiosErrorMessage(error: unknown): string {
	if (!axios.isAxiosError(error)) {
		return 'Sentence breakdown failed due to an unexpected error.'
	}

	const responseData = error.response?.data
	if (typeof responseData === 'object' && responseData && 'detail' in responseData) {
		const detail = (responseData as { detail?: string }).detail
		if (detail) {
			return detail
		}
	}

	return error.message || 'Sentence breakdown failed.'
}

export interface SentenceToken {
	surface: string
	base: string
	reading: string
	base_reading: string
	pos: string
	dictionary_pos: string[]
	meanings: string[]
	dictionary_word: string
}

export interface SentenceBreakdownResponse {
	text: string
	tokens: SentenceToken[]
}

function toSafeString(value: unknown): string {
	return typeof value === 'string' ? value : ''
}

function normalizeStringArray(values: unknown): string[] {
	if (!Array.isArray(values)) {
		return []
	}

	return values.filter((value): value is string => typeof value === 'string' && value.length > 0)
}

function normalizeToken(token: unknown): SentenceToken | null {
	if (!token || typeof token !== 'object') {
		return null
	}

	const surface = toSafeString((token as { surface?: unknown }).surface)
	if (!surface) {
		return null
	}

	return {
		surface,
		base: toSafeString((token as { base?: unknown }).base),
		reading: toSafeString((token as { reading?: unknown }).reading),
		base_reading: toSafeString((token as { base_reading?: unknown }).base_reading),
		pos: toSafeString((token as { pos?: unknown }).pos),
		dictionary_pos: normalizeStringArray((token as { dictionary_pos?: unknown }).dictionary_pos),
		meanings: normalizeStringArray((token as { meanings?: unknown }).meanings),
		dictionary_word: toSafeString((token as { dictionary_word?: unknown }).dictionary_word),
	}
}

export async function sentenceBreakdownApi(text: string): Promise<SentenceBreakdownResponse> {
	try {
		const response = await axios.post<SentenceBreakdownResponse>(`${API_BASE_URL}/api/japan/sentence-breakdown`, {
			text,
		})

		const data = response.data
		return {
			text: toSafeString((data as { text?: unknown }).text),
			tokens: Array.isArray((data as { tokens?: unknown }).tokens)
				? ((data as { tokens: unknown[] }).tokens
						.map(normalizeToken)
						.filter((token): token is SentenceToken => token !== null))
				: [],
		}
	} catch (error) {
		throw new Error(getAxiosErrorMessage(error))
	}
}
