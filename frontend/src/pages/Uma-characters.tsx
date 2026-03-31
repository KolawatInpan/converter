import UmaEntityBrowser from '../components/uma-entity-browser'

export default function UmaCharactersPage() {
	return (
		<UmaEntityBrowser
			entity="characters"
			title="UMA Characters"
			description="Browse playable Uma Musume characters from the GameTora database with character search, rarity sorting, and quick filters for alternate versions or card labels."
		/>
	)
}
