import UmaEntityDetail from '../components/uma-entity-detail'

export default function UmaCharacterDetailPage() {
	return (
		<UmaEntityDetail
			entity="characters"
			title="UMA Character"
			description="View the cached GameTora character summary in-app, then open the original GameTora entry if you want the full page details."
			backTo="/uma-characters"
			backLabel="Back to characters"
		/>
	)
}
