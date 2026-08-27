/**
 * PrivacyPage — 隐私政策
 */
import PublicLayout from './PublicLayout';

const sections = [
  {
    title: '1. 信息收集',
    content: [
      '我们收集的个人信息包括：注册时提供的姓名、邮箱、手机号；工作中创建的配方数据、实验记录及协作信息；系统自动收集的登录 IP 与操作日志。',
      '所有个人数据均采用 AES-256 加密存储，传输过程使用 TLS 1.3 协议加密，确保数据在存储与传输过程中的安全性。',
    ],
  },
  {
    title: '2. 信息使用',
    content: [
      '您的个人信息仅用于以下目的：提供产品研发服务、账户管理与安全验证、发送重要通知（如系统维护、法规更新）、改进产品体验。',
      '我们不会将您的个人数据出售给第三方，也不会用于未经您同意的营销目的。配方数据的所有权归属于您或您所在机构。',
    ],
  },
  {
    title: '3. 信息共享',
    content: [
      '除非获得您的明确授权或法律法规要求，我们不会向第三方共享您的个人信息。',
      '在以下情况下，我们可能共享必要信息：与您的合作机构（如同一企业的团队成员）、云服务提供商（用于数据存储与计算）、监管机构（在法律要求下）。',
    ],
  },
  {
    title: '4. 数据保留',
    content: [
      '您的数据将在账户活跃期间持续保留。您可以随时在"设置"中导出数据或删除账户，删除后数据将在 30 天内从备份中清除。',
      '实验记录与配方数据属于机构资产，删除操作需经机构管理员确认。',
    ],
  },
  {
    title: '5. 您的权利',
    content: [
      '您有权访问、更正或删除您的个人信息。如有需求，请通过 contact@rmfood.cn 联系我们。',
      '对于企业用户，管理员可配置团队成员的数据访问权限（RBAC 五级权限体系），确保最小必要访问原则。',
    ],
  },
  {
    title: '6.  cookies 与追踪',
    content: [
      '我们使用必要的 session cookies 维持登录状态，以及分析 cookies 了解页面使用情况（不追踪个人身份）。',
      '您可以浏览器设置中管理 cookie 偏好，但禁用必要 cookie 可能影响部分功能正常使用。',
    ],
  },
  {
    title: '7. 未成年人保护',
    content: [
      'RMFOOD 面向科研及企业用户，不建议未成年人注册使用。如发现未成年人使用，我们将立即删除相关数据。',
    ],
  },
  {
    title: '8. 政策更新',
    content: [
      '本政策可能随业务发展和法规变化而更新。重大变更将通过站内公告或邮件通知您。最新版始终发布于本平台。',
      '本政策最后更新日期：2025 年 7 月。',
    ],
  },
];

export default function PrivacyPage() {
  return (
    <PublicLayout>
      <section style={{ background: '#fff', borderBottom: '1px solid #e2e8f0' }}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest block mb-3">Legal</span>
          <h1 className="text-[clamp(1.75rem,4vw,2.5rem)] font-bold leading-[1.15] text-slate-900 mb-4">隐私政策</h1>
          <p className="text-[13px] text-slate-500">最后更新日期：2025 年 7 月</p>
        </div>
      </section>

      <section style={{ background: '#fafafa' }}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          {sections.map((sec, i) => (
            <div key={i} className="mb-10 last:mb-0">
              <h2 className="text-[14px] font-bold text-slate-900 mb-4">{sec.title}</h2>
              {sec.content.map((p, j) => (
                <p key={j} className="text-[13px] leading-[1.75] text-slate-600 mb-3 last:mb-0">{p}</p>
              ))}
            </div>
          ))}

          <div className="mt-10 pt-6 border-t" style={{ borderColor: '#e2e8f0' }}>
            <p className="text-[12px] text-slate-500">
              如您对本隐私政策有任何疑问，请联系：<a href="mailto:contact@rmfood.cn" className="text-emerald-600 hover:underline">contact@rmfood.cn</a>
            </p>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
