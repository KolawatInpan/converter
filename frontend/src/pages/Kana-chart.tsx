import { useMemo, useState } from 'react'

type KanaMode = 'hiragana' | 'katakana'

type KanaCell = {
	kana: string
	romaji: string
}

type KanaRow = {
	label: string
	cells: KanaCell[]
}

const HIRAGANA_ROWS: KanaRow[] = [
	{ label: 'Vowels', cells: [{ kana: 'あ', romaji: 'a' }, { kana: 'い', romaji: 'i' }, { kana: 'う', romaji: 'u' }, { kana: 'え', romaji: 'e' }, { kana: 'お', romaji: 'o' }] },
	{ label: 'K', cells: [{ kana: 'か', romaji: 'ka' }, { kana: 'き', romaji: 'ki' }, { kana: 'く', romaji: 'ku' }, { kana: 'け', romaji: 'ke' }, { kana: 'こ', romaji: 'ko' }] },
	{ label: 'S', cells: [{ kana: 'さ', romaji: 'sa' }, { kana: 'し', romaji: 'shi' }, { kana: 'す', romaji: 'su' }, { kana: 'せ', romaji: 'se' }, { kana: 'そ', romaji: 'so' }] },
	{ label: 'T', cells: [{ kana: 'た', romaji: 'ta' }, { kana: 'ち', romaji: 'chi' }, { kana: 'つ', romaji: 'tsu' }, { kana: 'て', romaji: 'te' }, { kana: 'と', romaji: 'to' }] },
	{ label: 'N', cells: [{ kana: 'な', romaji: 'na' }, { kana: 'に', romaji: 'ni' }, { kana: 'ぬ', romaji: 'nu' }, { kana: 'ね', romaji: 'ne' }, { kana: 'の', romaji: 'no' }] },
	{ label: 'H', cells: [{ kana: 'は', romaji: 'ha' }, { kana: 'ひ', romaji: 'hi' }, { kana: 'ふ', romaji: 'fu' }, { kana: 'へ', romaji: 'he' }, { kana: 'ほ', romaji: 'ho' }] },
	{ label: 'M', cells: [{ kana: 'ま', romaji: 'ma' }, { kana: 'み', romaji: 'mi' }, { kana: 'む', romaji: 'mu' }, { kana: 'め', romaji: 'me' }, { kana: 'も', romaji: 'mo' }] },
	{ label: 'Y', cells: [{ kana: 'や', romaji: 'ya' }, { kana: '', romaji: '' }, { kana: 'ゆ', romaji: 'yu' }, { kana: '', romaji: '' }, { kana: 'よ', romaji: 'yo' }] },
	{ label: 'R', cells: [{ kana: 'ら', romaji: 'ra' }, { kana: 'り', romaji: 'ri' }, { kana: 'る', romaji: 'ru' }, { kana: 'れ', romaji: 're' }, { kana: 'ろ', romaji: 'ro' }] },
	{ label: 'W', cells: [{ kana: 'わ', romaji: 'wa' }, { kana: '', romaji: '' }, { kana: '', romaji: '' }, { kana: '', romaji: '' }, { kana: 'を', romaji: 'wo' }] },
	{ label: 'N', cells: [{ kana: 'ん', romaji: 'n' }] },
]

const KATAKANA_ROWS: KanaRow[] = [
	{ label: 'Vowels', cells: [{ kana: 'ア', romaji: 'a' }, { kana: 'イ', romaji: 'i' }, { kana: 'ウ', romaji: 'u' }, { kana: 'エ', romaji: 'e' }, { kana: 'オ', romaji: 'o' }] },
	{ label: 'K', cells: [{ kana: 'カ', romaji: 'ka' }, { kana: 'キ', romaji: 'ki' }, { kana: 'ク', romaji: 'ku' }, { kana: 'ケ', romaji: 'ke' }, { kana: 'コ', romaji: 'ko' }] },
	{ label: 'S', cells: [{ kana: 'サ', romaji: 'sa' }, { kana: 'シ', romaji: 'shi' }, { kana: 'ス', romaji: 'su' }, { kana: 'セ', romaji: 'se' }, { kana: 'ソ', romaji: 'so' }] },
	{ label: 'T', cells: [{ kana: 'タ', romaji: 'ta' }, { kana: 'チ', romaji: 'chi' }, { kana: 'ツ', romaji: 'tsu' }, { kana: 'テ', romaji: 'te' }, { kana: 'ト', romaji: 'to' }] },
	{ label: 'N', cells: [{ kana: 'ナ', romaji: 'na' }, { kana: 'ニ', romaji: 'ni' }, { kana: 'ヌ', romaji: 'nu' }, { kana: 'ネ', romaji: 'ne' }, { kana: 'ノ', romaji: 'no' }] },
	{ label: 'H', cells: [{ kana: 'ハ', romaji: 'ha' }, { kana: 'ヒ', romaji: 'hi' }, { kana: 'フ', romaji: 'fu' }, { kana: 'ヘ', romaji: 'he' }, { kana: 'ホ', romaji: 'ho' }] },
	{ label: 'M', cells: [{ kana: 'マ', romaji: 'ma' }, { kana: 'ミ', romaji: 'mi' }, { kana: 'ム', romaji: 'mu' }, { kana: 'メ', romaji: 'me' }, { kana: 'モ', romaji: 'mo' }] },
	{ label: 'Y', cells: [{ kana: 'ヤ', romaji: 'ya' }, { kana: '', romaji: '' }, { kana: 'ユ', romaji: 'yu' }, { kana: '', romaji: '' }, { kana: 'ヨ', romaji: 'yo' }] },
	{ label: 'R', cells: [{ kana: 'ラ', romaji: 'ra' }, { kana: 'リ', romaji: 'ri' }, { kana: 'ル', romaji: 'ru' }, { kana: 'レ', romaji: 're' }, { kana: 'ロ', romaji: 'ro' }] },
	{ label: 'W', cells: [{ kana: 'ワ', romaji: 'wa' }, { kana: '', romaji: '' }, { kana: '', romaji: '' }, { kana: '', romaji: '' }, { kana: 'ヲ', romaji: 'wo' }] },
	{ label: 'N', cells: [{ kana: 'ン', romaji: 'n' }] },
]

const HIRAGANA_MARKS: KanaRow[] = [
	{ label: 'G', cells: [{ kana: 'が', romaji: 'ga' }, { kana: 'ぎ', romaji: 'gi' }, { kana: 'ぐ', romaji: 'gu' }, { kana: 'げ', romaji: 'ge' }, { kana: 'ご', romaji: 'go' }] },
	{ label: 'Z', cells: [{ kana: 'ざ', romaji: 'za' }, { kana: 'じ', romaji: 'ji' }, { kana: 'ず', romaji: 'zu' }, { kana: 'ぜ', romaji: 'ze' }, { kana: 'ぞ', romaji: 'zo' }] },
	{ label: 'D', cells: [{ kana: 'だ', romaji: 'da' }, { kana: 'ぢ', romaji: 'ji' }, { kana: 'づ', romaji: 'zu' }, { kana: 'で', romaji: 'de' }, { kana: 'ど', romaji: 'do' }] },
	{ label: 'B', cells: [{ kana: 'ば', romaji: 'ba' }, { kana: 'び', romaji: 'bi' }, { kana: 'ぶ', romaji: 'bu' }, { kana: 'べ', romaji: 'be' }, { kana: 'ぼ', romaji: 'bo' }] },
	{ label: 'P', cells: [{ kana: 'ぱ', romaji: 'pa' }, { kana: 'ぴ', romaji: 'pi' }, { kana: 'ぷ', romaji: 'pu' }, { kana: 'ぺ', romaji: 'pe' }, { kana: 'ぽ', romaji: 'po' }] },
]

const KATAKANA_MARKS: KanaRow[] = [
	{ label: 'G', cells: [{ kana: 'ガ', romaji: 'ga' }, { kana: 'ギ', romaji: 'gi' }, { kana: 'グ', romaji: 'gu' }, { kana: 'ゲ', romaji: 'ge' }, { kana: 'ゴ', romaji: 'go' }] },
	{ label: 'Z', cells: [{ kana: 'ザ', romaji: 'za' }, { kana: 'ジ', romaji: 'ji' }, { kana: 'ズ', romaji: 'zu' }, { kana: 'ゼ', romaji: 'ze' }, { kana: 'ゾ', romaji: 'zo' }] },
	{ label: 'D', cells: [{ kana: 'ダ', romaji: 'da' }, { kana: 'ヂ', romaji: 'ji' }, { kana: 'ヅ', romaji: 'zu' }, { kana: 'デ', romaji: 'de' }, { kana: 'ド', romaji: 'do' }] },
	{ label: 'B', cells: [{ kana: 'バ', romaji: 'ba' }, { kana: 'ビ', romaji: 'bi' }, { kana: 'ブ', romaji: 'bu' }, { kana: 'ベ', romaji: 'be' }, { kana: 'ボ', romaji: 'bo' }] },
	{ label: 'P', cells: [{ kana: 'パ', romaji: 'pa' }, { kana: 'ピ', romaji: 'pi' }, { kana: 'プ', romaji: 'pu' }, { kana: 'ペ', romaji: 'pe' }, { kana: 'ポ', romaji: 'po' }] },
]

const HIRAGANA_YOON: KanaCell[] = [
	{ kana: 'きゃ', romaji: 'kya' }, { kana: 'きゅ', romaji: 'kyu' }, { kana: 'きょ', romaji: 'kyo' },
	{ kana: 'しゃ', romaji: 'sha' }, { kana: 'しゅ', romaji: 'shu' }, { kana: 'しょ', romaji: 'sho' },
	{ kana: 'ちゃ', romaji: 'cha' }, { kana: 'ちゅ', romaji: 'chu' }, { kana: 'ちょ', romaji: 'cho' },
	{ kana: 'にゃ', romaji: 'nya' }, { kana: 'にゅ', romaji: 'nyu' }, { kana: 'にょ', romaji: 'nyo' },
	{ kana: 'ひゃ', romaji: 'hya' }, { kana: 'ひゅ', romaji: 'hyu' }, { kana: 'ひょ', romaji: 'hyo' },
	{ kana: 'みゃ', romaji: 'mya' }, { kana: 'みゅ', romaji: 'myu' }, { kana: 'みょ', romaji: 'myo' },
	{ kana: 'りゃ', romaji: 'rya' }, { kana: 'りゅ', romaji: 'ryu' }, { kana: 'りょ', romaji: 'ryo' },
	{ kana: 'ぎゃ', romaji: 'gya' }, { kana: 'ぎゅ', romaji: 'gyu' }, { kana: 'ぎょ', romaji: 'gyo' },
	{ kana: 'じゃ', romaji: 'ja' }, { kana: 'じゅ', romaji: 'ju' }, { kana: 'じょ', romaji: 'jo' },
	{ kana: 'びゃ', romaji: 'bya' }, { kana: 'びゅ', romaji: 'byu' }, { kana: 'びょ', romaji: 'byo' },
	{ kana: 'ぴゃ', romaji: 'pya' }, { kana: 'ぴゅ', romaji: 'pyu' }, { kana: 'ぴょ', romaji: 'pyo' },
]

const KATAKANA_YOON: KanaCell[] = [
	{ kana: 'キャ', romaji: 'kya' }, { kana: 'キュ', romaji: 'kyu' }, { kana: 'キョ', romaji: 'kyo' },
	{ kana: 'シャ', romaji: 'sha' }, { kana: 'シュ', romaji: 'shu' }, { kana: 'ショ', romaji: 'sho' },
	{ kana: 'チャ', romaji: 'cha' }, { kana: 'チュ', romaji: 'chu' }, { kana: 'チョ', romaji: 'cho' },
	{ kana: 'ニャ', romaji: 'nya' }, { kana: 'ニュ', romaji: 'nyu' }, { kana: 'ニョ', romaji: 'nyo' },
	{ kana: 'ヒャ', romaji: 'hya' }, { kana: 'ヒュ', romaji: 'hyu' }, { kana: 'ヒョ', romaji: 'hyo' },
	{ kana: 'ミャ', romaji: 'mya' }, { kana: 'ミュ', romaji: 'myu' }, { kana: 'ミョ', romaji: 'myo' },
	{ kana: 'リャ', romaji: 'rya' }, { kana: 'リュ', romaji: 'ryu' }, { kana: 'リョ', romaji: 'ryo' },
	{ kana: 'ギャ', romaji: 'gya' }, { kana: 'ギュ', romaji: 'gyu' }, { kana: 'ギョ', romaji: 'gyo' },
	{ kana: 'ジャ', romaji: 'ja' }, { kana: 'ジュ', romaji: 'ju' }, { kana: 'ジョ', romaji: 'jo' },
	{ kana: 'ビャ', romaji: 'bya' }, { kana: 'ビュ', romaji: 'byu' }, { kana: 'ビョ', romaji: 'byo' },
	{ kana: 'ピャ', romaji: 'pya' }, { kana: 'ピュ', romaji: 'pyu' }, { kana: 'ピョ', romaji: 'pyo' },
]

function KanaRowGrid({ row }: { row: KanaRow }) {
	const paddedCells = [...row.cells]
	while (paddedCells.length < 5) {
		paddedCells.push({ kana: '', romaji: '' })
	}

	return (
		<div className="grid grid-cols-5 gap-3">
			{paddedCells.map((cell, index) => (
				<div
					key={`${row.label}-${index}-${cell.kana || 'empty'}`}
					className={`rounded-2xl border px-3 py-4 text-center ${
						cell.kana
							? 'border-emerald-400/20 bg-emerald-500/8'
							: 'border-slate-800/80 bg-slate-950/20'
					}`}
				>
					{cell.kana ? (
						<>
							<div className="text-3xl font-semibold text-emerald-100">{cell.kana}</div>
							<div className="mt-2 text-xs uppercase tracking-[0.2em] text-emerald-200/75">
								{cell.romaji}
							</div>
						</>
					) : (
						<div className="h-full min-h-14" />
					)}
				</div>
			))}
		</div>
	)
}

export default function KanaChartPage() {
	const [mode, setMode] = useState<KanaMode>('hiragana')

	const rows = useMemo(() => (mode === 'hiragana' ? HIRAGANA_ROWS : KATAKANA_ROWS), [mode])
	const markedRows = useMemo(() => (mode === 'hiragana' ? HIRAGANA_MARKS : KATAKANA_MARKS), [mode])
	const yoonCells = useMemo(() => (mode === 'hiragana' ? HIRAGANA_YOON : KATAKANA_YOON), [mode])

	return (
		<div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.16),transparent_28%),linear-gradient(180deg,#0f172a_0%,#111827_52%,#020617_100%)] px-6 py-10 text-slate-100">
			<div className="mx-auto max-w-7xl">
				<div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
					<div>
						<h1 className="text-3xl font-bold text-slate-100">Kana Chart</h1>
						<p className="mt-2 max-w-3xl text-sm text-slate-300">
							Switch between hiragana and katakana, then review each kana with its romaji reading.
						</p>
					</div>
					<div className="inline-flex rounded-2xl border border-slate-700 bg-slate-900/75 p-1">
						<button
							type="button"
							onClick={() => setMode('hiragana')}
							className={`rounded-xl px-4 py-2 text-sm transition ${
								mode === 'hiragana'
									? 'bg-emerald-400 text-slate-950'
									: 'text-slate-300 hover:bg-slate-800'
							}`}
						>
							Hiragana
						</button>
						<button
							type="button"
							onClick={() => setMode('katakana')}
							className={`rounded-xl px-4 py-2 text-sm transition ${
								mode === 'katakana'
									? 'bg-emerald-400 text-slate-950'
									: 'text-slate-300 hover:bg-slate-800'
							}`}
						>
							Katakana
						</button>
					</div>
				</div>

				<div className="space-y-10">
					<section className="rounded-3xl border border-slate-700/80 bg-slate-900/75 p-6 shadow-xl shadow-black/20 ring-1 ring-white/5">
						<div className="mb-4 text-sm font-medium text-slate-300">Basic Chart</div>
						<div className="space-y-3 overflow-x-auto">
							{rows.map((row) => (
								<KanaRowGrid key={`${mode}-${row.label}`} row={row} />
							))}
						</div>
					</section>

					<section className="rounded-3xl border border-slate-700/80 bg-slate-900/75 p-6 shadow-xl shadow-black/20 ring-1 ring-white/5">
						<div className="mb-4 text-sm font-medium text-slate-300">Dakuten / Handakuten</div>
						<div className="space-y-3 overflow-x-auto">
							{markedRows.map((row) => (
								<KanaRowGrid key={`${mode}-marks-${row.label}`} row={row} />
							))}
						</div>
					</section>

					<section className="rounded-3xl border border-slate-700/80 bg-slate-900/75 p-6 shadow-xl shadow-black/20 ring-1 ring-white/5">
						<div className="mb-4 text-sm font-medium text-slate-300">Yoon</div>
						<div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
							{yoonCells.map((cell) => (
								<div
									key={`${mode}-${cell.kana}`}
									className="rounded-2xl border border-emerald-400/20 bg-emerald-500/8 px-3 py-4 text-center"
								>
									<div className="text-3xl font-semibold text-emerald-100">{cell.kana}</div>
									<div className="mt-2 text-xs uppercase tracking-[0.2em] text-emerald-200/75">
										{cell.romaji}
									</div>
								</div>
							))}
						</div>
					</section>
				</div>
			</div>
		</div>
	)
}
