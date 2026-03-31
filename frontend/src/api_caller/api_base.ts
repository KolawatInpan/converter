function isPrivateHostname(hostname: string): boolean {
	return (
		hostname === 'localhost' ||
		hostname === '127.0.0.1' ||
		hostname.startsWith('10.') ||
		hostname.startsWith('192.168.') ||
		/^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)
	)
}

function normalizeApiBaseUrl(value: string | undefined): string {
	const trimmed = value?.trim() ?? ''
	if (!trimmed) {
		throw new Error('VITE_API_BASE_URL is required.')
	}

	const normalized = trimmed.replace(/\/+$/, '')

	if (import.meta.env.DEV && typeof window !== 'undefined') {
		try {
			const configured = new URL(normalized)
			const currentHostname = window.location.hostname
			if (currentHostname && isPrivateHostname(currentHostname)) {
				return `${configured.protocol}//${currentHostname}:${configured.port || '5000'}`
			}
		} catch {
			return normalized
		}
	}

	return normalized
}

export const API_BASE_URL = normalizeApiBaseUrl(import.meta.env.VITE_API_BASE_URL)
