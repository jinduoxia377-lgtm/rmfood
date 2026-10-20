import React from 'react';
import { Input } from '@/components/ui';
import { FormField } from './FormField';
import type { PersonalInfoFormData, FormValidationErrors } from '../types/user';
import {
  UserCircle, Mail, Phone, Building2, Briefcase,
  Globe, Github, Linkedin,
} from 'lucide-react';

interface PersonalInfoFormProps {
  data: PersonalInfoFormData;
  errors: FormValidationErrors;
  onChange: <K extends keyof PersonalInfoFormData>(key: K, value: PersonalInfoFormData[K]) => void;
  disabled?: boolean;
}

export const PersonalInfoForm: React.FC<PersonalInfoFormProps> = ({
  data,
  errors,
  onChange,
  disabled = false,
}) => {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-[var(--space-apple-md)]">
          基本信息
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="姓名" error={errors.fullName} required>
            <Input
              value={data.fullName}
              onChange={(e) => onChange('fullName', e.target.value)}
              prefix={<UserCircle className="w-4 h-4" />}
              placeholder="请输入姓名"
              disabled={disabled}
              error={!!errors.fullName}
            />
          </FormField>

          <FormField label="邮箱" error={errors.email} required>
            <Input
              type="email"
              value={data.email}
              onChange={(e) => onChange('email', e.target.value)}
              prefix={<Mail className="w-4 h-4" />}
              placeholder="请输入邮箱"
              disabled={disabled}
              error={!!errors.email}
            />
          </FormField>

          <FormField label="手机号" error={errors.phone}>
            <Input
              value={data.phone}
              onChange={(e) => onChange('phone', e.target.value)}
              prefix={<Phone className="w-4 h-4" />}
              placeholder="请输入手机号"
              disabled={disabled}
              error={!!errors.phone}
            />
          </FormField>

          <FormField label="部门" error={errors.department}>
            <Input
              value={data.department}
              onChange={(e) => onChange('department', e.target.value)}
              prefix={<Building2 className="w-4 h-4" />}
              placeholder="请输入部门"
              disabled={disabled}
            />
          </FormField>

          <FormField label="职位" error={errors.position}>
            <Input
              value={data.position}
              onChange={(e) => onChange('position', e.target.value)}
              prefix={<Briefcase className="w-4 h-4" />}
              placeholder="请输入职位"
              disabled={disabled}
            />
          </FormField>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-[var(--space-apple-md)]">
          个人简介
        </h3>
        <FormField label="简介" error={errors.bio}>
          <div className="relative">
            {/* A-26：外层 FormField 的 <label> 没有 htmlFor，而它下面是 <div> 包壳，
                FormField 自动挂 aria-labelledby 挂不到真正的控件上，所以这里显式命名。 */}
            <textarea
              aria-label="个人简介"
              value={data.bio}
              onChange={(e) => onChange('bio', e.target.value)}
              placeholder="介绍一下自己..."
              disabled={disabled}
              rows={4}
              maxLength={500}
              className={`
                w-full px-[var(--space-apple-sm)] py-2 pr-12 rounded-[var(--radius-Apple-sm)] border bg-[var(--bg-secondary)]
                text-[var(--text-primary)] text-sm
                placeholder:text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]
                focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)]
                disabled:opacity-50 disabled:cursor-not-allowed
                resize-none
                ${errors.bio
                  ? 'border-danger-400 focus:ring-danger-500'
                  : 'border-[var(--border-color)]'
                }
              `}
            />
            <span className="absolute bottom-2 right-3 text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
              {data.bio.length}/500
            </span>
          </div>
        </FormField>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-[var(--space-apple-md)]">
          社交链接
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="个人网站" error={errors.website}>
            <Input
              value={data.website}
              onChange={(e) => onChange('website', e.target.value)}
              prefix={<Globe className="w-4 h-4" />}
              placeholder="https://example.com"
              disabled={disabled}
              error={!!errors.website}
            />
          </FormField>

          <FormField label="GitHub" error={errors.github}>
            <Input
              value={data.github}
              onChange={(e) => onChange('github', e.target.value)}
              prefix={<Github className="w-4 h-4" />}
              placeholder="GitHub 用户名"
              disabled={disabled}
              error={!!errors.github}
            />
          </FormField>

          <FormField label="LinkedIn" error={errors.linkedin}>
            <Input
              value={data.linkedin}
              onChange={(e) => onChange('linkedin', e.target.value)}
              prefix={<Linkedin className="w-4 h-4" />}
              placeholder="linkedin.com/in/username"
              disabled={disabled}
              error={!!errors.linkedin}
            />
          </FormField>
        </div>
      </div>
    </div>
  );
};
