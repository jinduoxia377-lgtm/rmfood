import { useState, useEffect } from 'react'
import { CheckCircle2, ChevronRight, Palette } from 'lucide-react'

const ONBOARDING_KEY = 'rmfood-theme-onboarding-done'
const TOTAL_STEPS = 4

interface Step {
	title: string
	body: string
	icon: string
}

const STEPS: Step[] = [
	{
		title: '欢迎来到主题管理',
		body: '在这里你可以自定义 RMFOOD 的外观和风格，让界面更符合你的使用习惯。',
		icon: '🎨',
	},
	{
		title: '选择主题预设',
		body: '点击下方"主题预设"区域，选择 Ocean Blue 或 Default Dark，也可以点击"新建主题"创建自定义配色。',
		icon: '🎭',
	},
	{
		title: '实时调整细节',
		body: '在"外观设置"中可以精确调整颜色、字体、圆角和阴影。右侧的预览区会即时反映你的修改。',
		icon: '✨',
	},
	{
		title: '保存与分享',
		body: '调好的主题可以点击"新建主题"保存到"我的主题"，也可以导出为 JSON 文件分享给团队成员。',
		icon: '💾',
	},
]

interface ThemeOnboardingProps {
	onComplete: () => void
}

export function ThemeOnboarding({ onComplete }: ThemeOnboardingProps) {
	const [step, setStep] = useState(0)
	const [isVisible, setIsVisible] = useState(false)

	useEffect(() => {
		const done = localStorage.getItem(ONBOARDING_KEY)
		if (done) return
		// Small delay so the page renders first
		const t = setTimeout(() => setIsVisible(true), 500)
		return () => clearTimeout(t)
	}, [])

	const handleNext = () => {
		if (step < TOTAL_STEPS - 1) {
			setStep(step + 1)
		} else {
			localStorage.setItem(ONBOARDING_KEY, '1')
			setIsVisible(false)
			setTimeout(onComplete, 300)
		}
	}

	const handleSkip = () => {
		localStorage.setItem(ONBOARDING_KEY, '1')
		setIsVisible(false)
		setTimeout(onComplete, 300)
	}

	if (!isVisible) return null

	return (
		<div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
			<div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
			<div className="relative bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-in">
				{/* Progress bar */}
				<div className="h-1 bg-neutral-100 dark:bg-neutral-800">
					<div
						className="h-full bg-[#0066cc] transition-all duration-300"
						style={{ width: `${((step + 1) / TOTAL_STEPS) * 100}%` }}
					/>
				</div>

				{/* Content */}
				<div className="p-8">
					<div className="text-4xl mb-4">{STEPS[step].icon}</div>
					<h2 className="text-lg font-semibold text-neutral-900 dark:text-white mb-2">
						{STEPS[step].title}
					</h2>
					<p className="text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed">
						{STEPS[step].body}
					</p>
				</div>

				{/* Footer */}
				<div className="flex items-center justify-between px-8 py-4 bg-neutral-50 dark:bg-neutral-800/50 border-t border-neutral-100 dark:border-neutral-800">
					<button
						onClick={handleSkip}
						className="text-xs text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
					>
						跳过引导
					</button>
					<div className="flex items-center gap-3">
						<span className="text-xs text-neutral-400">
							{step + 1} / {TOTAL_STEPS}
						</span>
						<button
							onClick={handleNext}
							className="flex items-center gap-1 px-4 py-2 bg-[#0066cc] text-white text-sm font-medium rounded-full hover:opacity-90 transition-opacity"
						>
							{step === TOTAL_STEPS - 1 ? (
								<>
									<CheckCircle2 className="w-3.5 h-3.5" />
									完成
								</>
							) : (
								<>
									下一步
									<ChevronRight className="w-3.5 h-3.5" />
								</>
							)}
						</button>
					</div>
				</div>
			</div>
		</div>
	)
}
