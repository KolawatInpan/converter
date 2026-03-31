import UmaEntityBrowser from '../components/uma-entity-browser'

export default function UmaSkillPage() {
	return (
		<UmaEntityBrowser
			entity="skills"
			title="UMA Skills"
			description="Browse the GameTora skill database with search, rarity filtering, skill-type sorting, and an optional legacy-text mode for older names and descriptions."
		/>
	)
}
