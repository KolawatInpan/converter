import { API_BASE_URL } from './api_base'

export interface UmaSkillSourceLink {
	label: string
	url?: string
	imageUrl?: string
}

export interface UmaSkillAcquisitionInfo {
	supportHints?: string[]
	supportEvents?: string[]
	characters?: string[]
	characterEvents?: string[]
	supportHintItems?: UmaSkillSourceLink[]
	supportEventItems?: UmaSkillSourceLink[]
	characterItems?: UmaSkillSourceLink[]
	characterEventItems?: UmaSkillSourceLink[]
	supportCards?: string[]
	events?: string[]
	trainees?: string[]
	upgradePaths?: string[]
	notes?: string[]
}

export interface UmaSkill {
	id: string | number
	name: string
	jpName?: string
	description?: string
	icon?: string
	skillPoints?: number
	evalPoints?: number
	pointRatio?: number
	category?: string
	rarity?: string
	wikiUrl?: string
	duration?: string
	targetSpeed?: string
	targetAcceleration?: string
	conditions?: string
	preconditions?: string
	details?: Record<string, string>
	acquisitionInfo?: UmaSkillAcquisitionInfo
}

/**
 * Fetch skills data from the backend API
 */
export async function fetchUmaSkills(): Promise<UmaSkill[]> {
	try {
		const response = await fetch(`${API_BASE_URL}/api/japan/all-skills`)

		if (!response.ok) {
			throw new Error(`Failed to fetch skills: ${response.statusText}`)
		}

		const data: { skills?: UmaSkill[] } = await response.json()
		return data.skills ?? []
	} catch (error) {
		console.error('Error fetching UMA skills:', error)
		throw error instanceof Error ? error : new Error('Failed to fetch UMA skills')
	}
}

/**
 * Search for skills by name
 */
export async function searchUmaSkills(query: string): Promise<UmaSkill[]> {
	const allSkills = await fetchUmaSkills()
	const lowerQuery = query.toLowerCase()

	return allSkills.filter(
		(skill) =>
			skill.name.toLowerCase().includes(lowerQuery) ||
			String(skill.id).toLowerCase().includes(lowerQuery) ||
			(skill.jpName?.toLowerCase().includes(lowerQuery) ?? false) ||
			(skill.description?.toLowerCase().includes(lowerQuery) ?? false),
	)
}

/**
 * Fetch one skill detail by ID
 */
export async function fetchUmaSkillDetail(skillId: string): Promise<UmaSkill> {
	try {
		const response = await fetch(`${API_BASE_URL}/api/japan/skills/${encodeURIComponent(skillId)}`)

		if (!response.ok) {
			if (response.status === 404) {
				throw new Error('Skill not found.')
			}
			throw new Error(`Failed to fetch skill detail: ${response.statusText}`)
		}

		const data: UmaSkill = await response.json()
		return data
	} catch (error) {
		console.error('Error fetching UMA skill detail:', error)
		throw error instanceof Error ? error : new Error('Failed to fetch UMA skill detail')
	}
}
