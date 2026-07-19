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
        <h3 className="text-sm font-semibold text-neutral-900 dark:text-white mb-4">
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
        <h3 className="text-sm font-semibold text-neutral-900 dark:text-white mb-4">
          个人简介
        </h3>
        <FormField label="简介" error={errors.bio}>
          <div className="relative">
            <textarea
              value={data.bio}
              onChange={(e) => onChange('bio', e.target.value)}
              placeholder="介绍一下自己..."
              disabled={disabled}
              rows={4}
              maxLength={500}
              className={`
                w-full px-3 py-2 pr-12 rounded-lg border bg-white dark:bg-neutral-900
                text-neutral-900 dark:text-white text-sm
                placeholder:text-neutral-400
                focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500
                disabled:opacity-50 disabled:cursor-not-allowed
                resize-none
                ${errors.bio
                  ? 'border-rose-400 focus:ring-rose-500'
                  : 'border-neutral-200 dark:border-neutral-700'
                }
              `}
            />
            <span className="absolute bottom-2 right-3 text-xs text-neutral-400">
              {data.bio.length}/500
            </span>
          </div>
        </FormField>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-neutral-900 dark:text-white mb-4">
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
              placeholder="username"
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
