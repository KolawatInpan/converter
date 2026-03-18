import axios from 'axios'

type CompressQuality = 'low' | 'medium' | 'high' | 'prepress'
export type CompressPhase = 'uploading' | 'compressing' | 'downloading'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:5000'

async function getAxiosErrorMessage(error: unknown): Promise<string> {
    if (!axios.isAxiosError(error)) {
        return 'Compression failed due to an unexpected error.'
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
            return error.message || 'Compression request failed.'
        }
    }

    if (typeof responseData === 'object' && responseData && 'detail' in responseData) {
        const detail = (responseData as { detail?: string }).detail
        if (detail) {
            return detail
        }
    }

    return error.message || 'Compression request failed.'
}

export async function compressPdfApi(
	file: File,
	quality: CompressQuality,
	onProgress?: (phase: CompressPhase, percent: number) => void,
	timeoutMs = 180000,
): Promise<Blob> {
	const formData = new FormData()
	formData.append('file', file)
	formData.append('quality', quality)

	try {
		const response = await axios.post(
			`${API_BASE_URL}/api/pdf/compress`,
			formData,
			{
				responseType: 'blob',
				timeout: timeoutMs,
				onUploadProgress(event) {
					const percent = event.total
						? Math.round((event.loaded / event.total) * 100)
						: 0
					onProgress?.('uploading', percent)
				},
				onDownloadProgress(event) {
					const percent = event.total
						? Math.round((event.loaded / event.total) * 100)
						: 0
					onProgress?.('downloading', percent)
				},
			},
		)

		return response.data
	} catch (error) {
		throw new Error(await getAxiosErrorMessage(error))
	}
}
