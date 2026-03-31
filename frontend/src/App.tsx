import { useEffect, useState } from 'react'
import { Route, Routes } from 'react-router-dom'

import Navbar from './components/navbar'
import AllToolsPage from './pages/All-tools'
import CompressPdf from './pages/Compress-pdf'
import ExamMultipleChoices from './pages/Exam-multiple-choices'
import DictionaryPage from './pages/dictionary'
import ExtractPdfImagesPage from './pages/Extract-pdf-images'
import ExtractPdfPagesPage from './pages/Extract-pdf-pages'
import Home from './pages/Home'
import ImageOcrPage from './pages/Image-ocr'
import ImagesToPdfPage from './pages/Images-to-pdf'
import KanjiReadingPage from './pages/Kanji-reading'
import KanaChartPage from './pages/Kana-chart'
import MergePdf from './pages/Merge-pdf'
import NewsReading from './pages/News-reading'
import PdfConverterPage from './pages/PDF-converter'
import PdfToImagesPage from './pages/PDF-to-images'
import ProtectPdfPage from './pages/Protect-pdf'
import PutCharacterInGrid from './pages/Put-character-in-grid'
import PutVocabularyInGrid from './pages/Put-vocabulary-in-grid'
import RadicalChartPage from './pages/Radical-chart'
import RearrangePdfPagesPage from './pages/Rearrange-pdf-pages'
import RemovePdfPagesPage from './pages/Remove-pdf-pages'
import SentenceBreakdownPage from './pages/Sentence-breakdown'
import SplitPdfPage from './pages/Split-pdf'
import TemplateCreate from './pages/Template-create'
import UnlockPdfPage from './pages/Unlock-pdf'
import VocabExtract from './pages/Vocab-extract'
import UmaCharactersPage from './pages/Uma-characters'
import UmaCharacterDetailPage from './pages/Uma-character-detail'
import UmaSkillPage from './pages/Uma-skill'
import UmaSkillDetailPage from './pages/Uma-skill-detail'
import UmaSupportDetailPage from './pages/Uma-support-detail'
import UmaSupportsPage from './pages/Uma-supports'

export type AppFont = 'klee-regular' | 'klee-semibold'

const FONT_STORAGE_KEY = 'converter.appFont'

export default function App() {
	const [appFont, setAppFont] = useState<AppFont>(() => {
		const saved = localStorage.getItem(FONT_STORAGE_KEY)
		return saved === 'klee-semibold' ? 'klee-semibold' : 'klee-regular'
	})

	useEffect(() => {
		localStorage.setItem(FONT_STORAGE_KEY, appFont)
	}, [appFont])

  return (
    <div className={appFont === 'klee-semibold' ? 'app-font-klee-semibold' : 'app-font-klee-regular'}>
      <Navbar appFont={appFont} onFontChange={setAppFont} />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/all-tools" element={<AllToolsPage />} />
        <Route path="/merge-pdf" element={<MergePdf />} />
        <Route path="/split-pdf" element={<SplitPdfPage />} />
        <Route path="/compress-pdf" element={<CompressPdf />} />
        <Route path="/protect-pdf" element={<ProtectPdfPage />} />
        <Route path="/unlock-pdf" element={<UnlockPdfPage />} />
        <Route path="/pdf-converter" element={<PdfConverterPage />} />
        <Route path="/images-to-pdf" element={<ImagesToPdfPage />} />
        <Route path="/pdf-to-images" element={<PdfToImagesPage />} />
        <Route path="/extract-pdf-images" element={<ExtractPdfImagesPage />} />
        <Route path="/remove-pdf-pages" element={<RemovePdfPagesPage />} />
        <Route path="/extract-pdf-pages" element={<ExtractPdfPagesPage />} />
        <Route path="/rearrange-pdf-pages" element={<RearrangePdfPagesPage />} />
        <Route path="/dictionary" element={<DictionaryPage />} />
        <Route path="/image-ocr" element={<ImageOcrPage />} />
        <Route path="/kanji-reading" element={<KanjiReadingPage />} />
        <Route path="/kana-chart" element={<KanaChartPage />} />
        <Route path="/radical-chart" element={<RadicalChartPage />} />
        <Route path="/sentence-breakdown" element={<SentenceBreakdownPage />} />
        <Route path="/template-create" element={<TemplateCreate />} />
        <Route path="/vocab-extract" element={<VocabExtract />} />
        <Route path="/put-character-grid" element={<PutCharacterInGrid />} />
        <Route path="/put-vocabulary-grid" element={<PutVocabularyInGrid />} />
        <Route path="/news-reading" element={<NewsReading />} />
        <Route path="/exam-multiple-choices" element={<ExamMultipleChoices />} />
        <Route path="/uma-skills" element={<UmaSkillPage />} />
        <Route path="/uma-supports" element={<UmaSupportsPage />} />
        <Route path="/uma-characters" element={<UmaCharactersPage />} />
        <Route path="/uma-skills/:id" element={<UmaSkillDetailPage />} />
        <Route path="/uma-supports/:id" element={<UmaSupportDetailPage />} />
        <Route path="/uma-characters/:id" element={<UmaCharacterDetailPage />} />
      </Routes>
    </div>
  )
}
