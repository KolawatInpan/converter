import UmaEntityDetail from '../components/uma-entity-detail'

export default function UmaSkillDetailPage() {
	return (
		<UmaEntityDetail
			entity="skills"
			title="UMA Skill"
			description="Browse the cached GameTora skill profile inside the app, then jump to the original GameTora page when you want the full external breakdown."
			backTo="/uma-skills"
			backLabel="Back to skills"
		/>
	)
}
