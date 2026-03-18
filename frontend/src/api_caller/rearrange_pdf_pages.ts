import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:5000'

async function getAxiosErrorMessage(error: unknown): Promise<string> {
	if (!axios.isAxiosError(error)) {
		return 'Rearrange pages failed due to an unexpected error.'
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
			return error.message || 'Rearrange pages request failed.'
		}
	}

	if (typeof responseData === 'object' && responseData && 'detail' in responseData) {
		const detail = (responseData as { detail?: string }).detail
		if (detail) {
			return detail
		}
	}

	return error.message || 'Rearrange pages request failed.'
}

export async function rearrangePdfPagesApi(file: File, pages: string): Promise<Blob> {
	const formData = new FormData()
	formData.append('file', file)
	formData.append('pages', pages)

	try {
		const response = await axios.post(`${API_BASE_URL}/api/pdf/rearrange-pages`, formData, {
			responseType: 'blob',
		})

		return response.data
	} catch (error) {
		throw new Error(await getAxiosErrorMessage(error))
	}
}
