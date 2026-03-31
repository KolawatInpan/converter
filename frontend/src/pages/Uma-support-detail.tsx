import UmaEntityDetail from '../components/uma-entity-detail'

export default function UmaSupportDetailPage() {
	return (
		<UmaEntityDetail
			entity="supports"
			title="UMA Support"
			description="Open a support card inside the app first, with the cached GameTora summary ready for quick browsing and a direct link back to the original source."
			backTo="/uma-supports"
			backLabel="Back to supports"
		/>
	)
}
