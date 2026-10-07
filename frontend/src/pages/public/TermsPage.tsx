/**
 * TermsPage — 服务条款
 * 莱茵分子药食同源配方平台用户协议
 */
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Shield, Scale, FileText, AlertCircle, CheckCircle2,
  Building2, BrainCircuit, Database, ChevronRight,
} from 'lucide-react'
import PublicLayout from './PublicLayout'

const sections = [
  {
    id: 'acceptance',
    icon: CheckCircle2,
    title: '1. 条款接受',
    content: [
      '欢迎使用莱茵（厦门）分子生物科技有限公司（以下简称"莱茵分子"或"我们"）运营的 RMFOOD 药食同源配方平台（以下简称"本平台"）。',
      '请您在注册或使用本平台服务之前，仔细阅读并充分理解本服务条款（以下简称"本条款"）。一旦您注册、登录或使用本平台服务，即表示您已阅读、理解并同意接受本条款的全部内容和附件。如果您不同意本条款的任何内容，请立即停止使用本平台。',
      '本条款对我们双方具有法律约束力。我们可能会根据业务发展需要不时修改本条款，修改后的条款将在本平台公布后立即生效。您继续使用本平台即视为接受修改后的条款。',
    ],
  },
  {
    id: 'service',
    icon: BrainCircuit,
    title: '2. 服务说明',
    content: [
      '本平台是一款面向药食同源功能性食品研发的专业工具，集成中医药知识图谱、分子生物学数据库与 AI 配方优化引擎，为用户提供从食材筛选到配方设计的全链路辅助服务。',
      '平台核心功能包括但不限于：AI 配方生成与优化、药材成分查询、功效机制解析、配伍禁忌检测、合规标准对照、实验数据管理。各功能模块的详细使用说明以平台内展示为准。',
      '本平台提供的所有内容（包括但不限于配方建议、成分分析、功效说明）仅供科研参考与决策辅助，不构成医疗建议、诊断或治疗方案。用户在临床应用中应结合专业医师指导和本单位规范独立判断。',
    ],
  },
  {
    id: 'account',
    icon: Building2,
    title: '3. 账户注册与管理',
    content: [
      '本平台暂未开放自助注册，新用户须通过机构管理员邀请或联系 support@rmfood.cn 申请开通账号。',
      '您应对您的账户和密码安全负全部责任，不得将账户分享给他人使用。如发现账户被盗用或存在其他安全问题，请立即通知我们要进行处理。',
      '机构管理员可为团队成员分配不同权限等级的账户（RBAC 五级体系），各账户的操作记录和权限变更均留痕可查。',
    ],
  },
  {
    id: 'data',
    icon: Database,
    title: '4. 数据所有权与使用',
    content: [
      '您在平台上创建、上传或生成的配方数据、实验记录和分析结果的知识产权归属于您或您所在的机构。我们不对您的数据主张任何权利。',
      '为优化 AI 推荐算法和服务质量，我们可能会对脱敏后的使用数据进行聚合分析，此类分析不涉及可识别您个人或机构身份的信息。',
      '您有权随时导出您的全部数据（支持 JSON、CSV 格式）。数据删除后，我们将在 30 天内从生产系统清除，但法律要求保留的日志数据除外。',
    ],
  },
  {
    id: 'conduct',
    icon: Scale,
    title: '5. 用户行为规范',
    content: [
      '您承诺不使用本平台从事任何违法违规活动，包括但不限于：分享虚假或误导性科研数据、利用平台输出内容进行未经审核的临床应用、侵犯第三方知识产权。',
      '您不得使用本平台进行反向工程、反编译、破解或试图获取平台源代码和底层算法逻辑。',
      '您不得利用本平台批量爬取公开数据库内容或进行超出正常使用频率的数据请求。',
    ],
  },
  {
    id: 'ip',
    icon: Shield,
    title: '6. 知识产权声明',
    content: [
      '本平台包含的所有内容，包括但不限于文字、图形、图标、界面设计、代码、算法模型及其文档，均受著作权法、商标法及相关知识产权法律保护。',
      '平台集成的 TCMSP、OpenFoodFacts 等第三方数据库数据，其知识产权归属 respective 原始权利人，本平台仅提供查询与可视化接口，不享有该等数据的权利。',
      '未经书面许可，您不得以任何形式复制、传播、修改或以其他方式使用平台的核心技术与数据结构。',
    ],
  },
  {
    id: 'liability',
    icon: AlertCircle,
    title: '7. 责任限制与免责',
    content: [
      '本平台基于"现状"和"可用"原则提供服务。我们不保证平台服务不会中断、无错误或不包含病毒，也不保证特定功能一定能实现预期的商业或科研效果。',
      '对于因您使用本平台输出结果而导致的任何间接性、偶然性、特殊性或惩罚性损害，我们在法律允许的最大范围内不承担责任。',
      '平台中的 AI 配方建议是基于算法模型的综合评估结果，可能因训练数据、参数设定等因素存在偏差。使用者应对输出结果进行独立验证后再做决策。',
    ],
  },
  {
    id: 'termination',
    icon: FileText,
    title: '8. 条款终止',
    content: [
      '您有权随时通过注销账户终止本条款。账户注销后，您将无法继续使用本平台服务，相关数据将按照隐私政策处理。',
      '如您违反本条款的任何规定，我们有权暂停或终止您的账户访问权限，并保留追究法律责任的权利。',
      '条款终止后，第 6 条（知识产权）、第 7 条（责任限制）、第 9 条（适用法律与争议解决）继续有效。',
    ],
  },
  {
    id: 'governing',
    icon: Scale,
    title: '9. 适用法律与争议解决',
    content: [
      '本条款的订立、执行和解释及争议的解决均适用中华人民共和国法律（不含冲突法规则）。',
      '因本条款引起的或与本条款有关的任何争议，双方应首先通过友好协商解决；协商不成的，任何一方均可向原告所在地有管辖权的人民法院提起诉讼。',
      '如本条款的任何条款被认定为无效或不可执行，其余条款仍保持完全有效和可执行。',
    ],
  },
]

export default function TermsPage() {
  const [activeSection, setActiveSection] = useState('')

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id)
          }
        })
      },
      { rootMargin: '-20% 0px -60% 0px' }
    )

    sections.forEach((s) => {
      const el = document.getElementById(s.id)
      if (el) observer.observe(el)
    })

    return () => observer.disconnect()
  }, [])

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <PublicLayout>
      {/* Hero */}
      <section
        style={{
          background: 'linear-gradient(135deg, rgba(37,99,235,0.06) 0%, rgba(37,99,235,0.02) 100%)',
          borderBottom: '1px solid rgba(37,99,235,0.12)',
        }}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
          <span className="text-[10px] font-mono text-blue-600 uppercase tracking-widest block mb-3">Legal</span>
          <h1 className="text-[clamp(1.75rem,4vw,2.5rem)] font-bold leading-[1.15] text-slate-900 mb-4">
            服务条款
          </h1>
          <p className="text-[14px] leading-[1.75] text-slate-600 max-w-2xl">
            感谢您选择 RMFOOD 药食同源配方平台。本服务条款是您与莱茵（厦门）分子生物科技有限公司之间关于您使用本平台服务所订立的法律协议。
            请在注册或使用本平台前仔细阅读本条款。
          </p>
          <p className="text-[12px] text-slate-400 mt-3">最后更新日期：2025 年 7 月 1 日</p>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        <div className="flex gap-8 lg:gap-12">
          {/* 目录侧边栏 */}
          <aside className="hidden lg:block w-52 shrink-0">
            <nav className="sticky top-6">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-3">目录</p>
              <ul className="space-y-0.5">
                {sections.map((s) => {
                  const IconComp = s.icon
                  return (
                    <li key={s.id}>
                      <button
                        onClick={() => scrollTo(s.id)}
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-[12px] font-medium transition-all text-left ${
                          activeSection === s.id
                            ? 'bg-blue-50 text-blue-700'
                            : 'text-slate-600 hover:bg-slate-50 dark:bg-neutral-800 hover:text-slate-900'
                        }`}
                      >
                        <IconComp size={13} className="shrink-0 opacity-60" />
                        <span className="truncate">{s.title}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </nav>
          </aside>

          {/* 正文 */}
          <main className="flex-1 min-w-0">
            {sections.map((sec, i) => {
              const IconComp = sec.icon
              return (
                <section
                  key={i}
                  id={sec.id}
                  className="mb-8 scroll-mt-6"
                  style={{
                    background: '#fff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '10px',
                    padding: '24px 28px',
                  }}
                >
                  <div className="flex items-center gap-3 mb-5">
                    <div
                      className="w-8 h-8 rounded-md flex items-center justify-center shrink-0"
                      style={{ background: 'rgba(37,99,235,0.1)' }}
                    >
                      <IconComp size={15} style={{ color: '#2563EB' }} />
                    </div>
                    <h2 className="text-[14px] font-bold text-slate-900">{sec.title}</h2>
                  </div>
                  {sec.content.map((p, j) => (
                    <p key={j} className="text-[13px] leading-[1.8] text-slate-600 mb-3 last:mb-0 pl-11">
                      {p}
                    </p>
                  ))}
                </section>
              )
            })}

            {/* 关联链接区块 */}
            <div
              className="rounded-xl p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4"
              style={{ background: 'rgba(37,99,235,0.05)', border: '1px solid rgba(37,99,235,0.15)' }}
            >
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: 'rgba(37,99,235,0.15)' }}
              >
                <FileText size={18} style={{ color: '#2563EB' }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-slate-900 mb-1">相关文件</p>
                <p className="text-[12px] text-slate-600">
                  本服务条款与我们的
                  <a href="/privacy" className="text-blue-600 hover:underline font-medium">
                    隐私政策
                  </a>
                  共同构成完整的用户使用协议。如对条款有任何疑问，请联系 support@rmfood.cn。
                </p>
              </div>
              <Link
                to="/privacy"
                className="shrink-0 flex items-center gap-1 text-[12px] font-medium text-blue-600 hover:text-blue-700 transition-colors"
              >
                查看隐私政策 <ChevronRight size={13} />
              </Link>
            </div>
          </main>
        </div>
      </div>
    </PublicLayout>
  )
}
