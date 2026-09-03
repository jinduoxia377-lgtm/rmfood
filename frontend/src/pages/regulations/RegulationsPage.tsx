/**
 * 合规标准页面 — 独立页面版
 * 展示国家标准（GB 2760/GB 14880/药食同源）、禁忌搭配、合规检查
 *
 * 原为 DatabasePage 的 regulations Tab，现独立为 /regulations 路由
 */
import { PageHeader } from '@/components/ui';
import { ShieldCheck } from 'lucide-react';
import ComplianceTab from '@/pages/database/tabs/ComplianceTab';

export default function RegulationsPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="合规标准"
        description="国家标准查询 · 药食同源目录 · 禁忌搭配检查"
      />
      <ComplianceTab />
    </div>
  );
}
