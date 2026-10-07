/**
 * PrivacyPage — 隐私政策
 * 莱茵分子药食同源配方平台隐私保护声明
 */
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Shield, Eye, Lock, Database, Users, AlertCircle, ChevronRight, FileText } from 'lucide-react'
import PublicLayout from './PublicLayout'

const sections = [
  {
    id: 'collection',
    icon: Database,
    title: '1. 信息收集',
    content: [
      '我们收集的个人信息包括：注册时提供的姓名、邮箱、手机号；工作中创建的配方数据、实验记录及协作信息；系统自动收集的登录 IP、设备类型与操作日志。',
      '所有个人数据均采用 AES-256 加密存储，传输过程使用 TLS 1.3 协议加密，确保数据在存储与传输过程中的安全性。',
      '我们遵循最小必要原则，仅收集实现产品功能所必需的数据，不对用户行为进行超出服务范围的追踪。',
    ],
  },
  {
    id: 'usage',
    icon: Eye,
    title: '2. 信息使用',
    content: [
      '您的个人信息仅用于以下目的：提供产品研发与配方设计服务、账户管理与安全验证、发送重要通知（如系统维护、法规更新）、改进产品体验与功能优化。',
      '我们不会将您的个人数据出售给第三方，也不会用于未经您明确同意的营销推广目的。配方数据的所有权始终归属于您或您所在的机构。',
      '系统会自动分析使用模式以优化 AI 推荐算法，但分析结果不涉及可识别个人身份的信息。',
    ],
  },
  {
    id: 'sharing',
    icon: Users,
    title: '3. 信息共享与披露',
    content: [
      '除非获得您的明确授权或法律法规要求，我们不会向第三方共享您的个人信息。',
      '在以下情况下，我们可能共享必要信息：与您的合作机构（如同一企业的团队成员，通过 RBAC 权限体系控制访问范围）、云服务提供商（用于数据存储与计算，受严格数据处理协议约束）、监管机构（在法律明确要求下）。',
      '任何第三方共享行为均会在隐私控制面板中记录，供您随时查阅。',
    ],
  },
  {
    id: 'retention',
    icon: FileText,
    title: '4. 数据保留与删除',
    content: [
      '您的数据将在账户活跃期间持续保留。您可以随时在"设置"中导出数据或删除账户，删除后数据将在 30 天内从生产系统和备份中清除。',
      '实验记录与配方数据属于机构资产，删除操作需经机构管理员确认。删除前我们将提示您确认操作范围与影响。',
      '法律要求保留的数据（如交易记录、合规审计日志）将按相关法规要求继续保留，不受账户删除影响。',
    ],
  },
  {
    id: 'rights',
    icon: Shield,
    title: '5. 您的权利',
    content: [
      '您有权访问、更正、补充或删除您的个人信息。对于企业用户，管理员可配置团队成员的数据访问权限（RBAC 五级权限体系），确保最小必要访问原则。',
      '您有权撤回此前授予的数据处理同意，撤回不影响撤回前基于同意已进行的合法处理。',
      '如有需求，请通过 contact@rmfood.cn 联系我们，我们承诺在 15 个工作日内响应您的请求。',
    ],
  },
  {
    id: 'cookies',
    icon: Lock,
    title: '6. Cookies 与追踪技术',
    content: [
      '我们使用必要的 session cookies 维持登录状态与会话连续性，以及分析 cookies 了解页面使用情况（不追踪个人身份，仅做聚合统计）。',
      '您可以浏览器设置中管理 cookie 偏好，但禁用必要 cookie 可能影响登录、购物车等核心功能正常使用。',
      '我们不使用第三方广告追踪 cookie，不参与跨站用户画像构建。',
    ],
  },
  {
    id: 'children',
    icon: AlertCircle,
    title: '7. 未成年人保护',
    content: [
      'RMFOOD 面向科研及企业用户，不建议未成年人注册使用。如发现未成年人使用，我们将立即删除相关数据并通知监护人。',
      '平台内容包含专业科学知识，建议在指导下使用，以确保信息的正确理解与应用。',
    ],
  },
  {
    id: 'updates',
    icon: Shield,
    title: '8. 政策更新',
    content: [
      '本政策可能随业务发展和法规变化而更新。重大变更将通过站内公告、邮件通知或在登录页显著位置公示的方式告知您。',
      '继续使用本平台即表示您同意更新后的隐私政策。建议您定期查阅本页面以了解最新内容。',
      '本政策最后更新日期：2025 年 7 月。',
    ],
  },
]

export default function PrivacyPage() {
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
          background: 'linear-gradient(135deg, rgba(5,150,105,0.06) 0%, rgba(5,150,105,0.02) 100%)',
          borderBottom: '1px solid rgba(5,150,105,0.12)',
        }}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
          <span className="text-[10px] font-mono text-emerald-600 uppercase tracking-widest block mb-3">Legal</span>
          <h1 className="text-[clamp(1.75rem,4vw,2.5rem)] font-bold leading-[1.15] text-slate-900 mb-4">
            隐私政策
          </h1>
          <p className="text-[14px] leading-[1.75] text-slate-600 max-w-2xl">
            莱茵（厦门）分子生物科技有限公司（简称"莱茵分子"或"我们"）深知个人信息对您的重要性，
            我们将按照法律法规要求，采取合理的安全措施保护您的个人信息。本政策向您说明我们如何收集、
            使用、存储和保护您的信息。
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
                            ? 'bg-emerald-50 text-emerald-700'
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
                      style={{ background: 'rgba(5,150,105,0.1)' }}
                    >
                      <IconComp size={15} style={{ color: '#059669' }} />
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

            {/* 联系区块 */}
            <div
              className="rounded-xl p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4"
              style={{ background: 'rgba(5,150,105,0.05)', border: '1px solid rgba(5,150,105,0.15)' }}
            >
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: 'rgba(5,150,105,0.15)' }}
              >
                <Shield size={18} style={{ color: '#059669' }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-slate-900 mb-1">如有疑问</p>
                <p className="text-[12px] text-slate-600">
                  如您对本隐私政策有任何疑问、意见或投诉，请联系我们的数据保护专员：
                  <a href="mailto:contact@rmfood.cn" className="text-emerald-600 hover:underline font-medium">
                    contact@rmfood.cn
                  </a>
                </p>
              </div>
              <Link
                to="/terms"
                className="shrink-0 flex items-center gap-1 text-[12px] font-medium text-emerald-600 hover:text-emerald-700 transition-colors"
              >
                查看服务条款 <ChevronRight size={13} />
              </Link>
            </div>
          </main>
        </div>
      </div>
    </PublicLayout>
  )
}
