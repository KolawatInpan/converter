import {
	BookOpen,
	CircleHelp,
	FileImage,
	Grid2x2,
	Lock,
	LockOpen,
	Merge,
	Minimize2,
	Newspaper,
	ScanText,
	Type,
} from 'lucide-react'

type ToolIconProps = {
	tool: string
	className?: string
}

export default function ToolIcon({ tool, className = 'h-7 w-7 text-slate-300' }: ToolIconProps) {
	if (tool === 'Merge PDF') {
		return <Merge className={className} />
	}

	if (tool === 'Put Character in Grid') {
		return <Type className={className} />
	}

	if (tool === 'Put Vocabulary in Grid') {
		return <BookOpen className={className} />
	}

	if (tool === 'News Reading') {
		return <Newspaper className={className} />
	}

	if (tool === 'Exam Multiple Choices') {
		return <CircleHelp className={className} />
	}

	if (tool === 'Template Create') {
		return <Grid2x2 className={className} />
	}

	if (tool === 'Protect PDF') {
		return <Lock className={className} />
	}

	if (tool === 'Unlock PDF') {
		return <LockOpen className={className} />
	}

	if (tool === 'Images to PDF' || tool === 'PDF to Images' || tool === 'Extract PDF images') {
		return <FileImage className={className} />
	}

	if (
		tool === 'Dictionary' ||
		tool === 'Kanji Reading' ||
		tool === 'Radical Chart' ||
		tool === 'Sentence Breakdown'
	) {
		return <BookOpen className={className} />
	}

	if (tool === 'Kana Chart') {
		return <Type className={className} />
	}

	if (tool === 'Vocab Extract') {
		return <ScanText className={className} />
	}

	if (tool === 'Image OCR' || tool === 'UMA Skills' || tool === 'UMA Supports' || tool === 'UMA Characters') {
		return <ScanText className={className} />
	}

	return <Minimize2 className={className} />
}
