import { API_BASE_URL } from './api_base'

export type UmaEntityType = 'skills' | 'supports' | 'characters'

export interface UmaDbItem {
	id: string
	name: string
	jpName?: string
	subtitle?: string
	description?: string
	rarity?: string
	typeLabel?: string
	url?: string
	imageUrl?: string
	source?: string
	entity?: UmaEntityType
}

export function getUmaEntityRoute(entity: UmaEntityType, id: string): string {
	if (entity === 'skills') {
		return `/uma-skills/${encodeURIComponent(id)}`
	}
	if (entity === 'supports') {
		return `/uma-supports/${encodeURIComponent(id)}`
	}
	return `/uma-characters/${encodeURIComponent(id)}`
}

export async function fetchUmaEntityList(entity: UmaEntityType): Promise<UmaDbItem[]> {
	const endpoint =
		entity === 'skills'
			? `${API_BASE_URL}/api/japan/all-skills`
			: entity === 'supports'
				? `${API_BASE_URL}/api/japan/uma-supports`
				: `${API_BASE_URL}/api/japan/uma-characters`

	const response = await fetch(endpoint)
	if (!response.ok) {
		throw new Error(`Failed to fetch ${entity}: ${response.statusText}`)
	}

	const data = await response.json()
	if (entity === 'skills') {
		return (data.skills ?? []) as UmaDbItem[]
	}
	return (data.items ?? []) as UmaDbItem[]
}

export async function fetchLegacySkillList(): Promise<UmaDbItem[]> {
	const response = await fetch(`${API_BASE_URL}/api/japan/legacy-skills`)
	if (!response.ok) {
		throw new Error(`Failed to fetch legacy skills: ${response.statusText}`)
	}

	const data = await response.json()
	return (data.skills ?? []) as UmaDbItem[]
}

export async function searchUmaDatabase(
	query: string,
	entity: UmaEntityType | 'all' = 'all',
): Promise<{ results: UmaDbItem[]; entity: string; count: number }> {
	const response = await fetch(`${API_BASE_URL}/api/japan/uma-search`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({ query, entity }),
	})

	if (!response.ok) {
		throw new Error(`Failed to search UMA database: ${response.statusText}`)
	}

	return response.json()
}

export async function fetchUmaEntityDetail(
	entity: UmaEntityType,
	id: string,
): Promise<UmaDbItem> {
	const endpoint =
		entity === 'skills'
			? `${API_BASE_URL}/api/japan/skills/${encodeURIComponent(id)}`
			: entity === 'supports'
				? `${API_BASE_URL}/api/japan/uma-supports/${encodeURIComponent(id)}`
				: `${API_BASE_URL}/api/japan/uma-characters/${encodeURIComponent(id)}`

	const response = await fetch(endpoint)
	if (!response.ok) {
		throw new Error(`Failed to fetch ${entity.slice(0, -1)} detail: ${response.statusText}`)
	}

	return (await response.json()) as UmaDbItem
}
