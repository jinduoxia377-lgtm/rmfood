import type { FormValidationErrors, PersonalInfoFormData } from '../types/user';

export const validatePersonalInfo = (data: PersonalInfoFormData): FormValidationErrors => {
  const errors: FormValidationErrors = {};

  if (!data.fullName.trim()) {
    errors.fullName = '请输入姓名';
  } else if (data.fullName.length < 2 || data.fullName.length > 50) {
    errors.fullName = '姓名长度应为2-50个字符';
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!data.email.trim()) {
    errors.email = '请输入邮箱地址';
  } else if (!emailRegex.test(data.email)) {
    errors.email = '请输入有效的邮箱地址';
  }

  const phoneRegex = /^1[3-9]\d{9}$/;
  if (data.phone && !phoneRegex.test(data.phone)) {
    errors.phone = '请输入有效的手机号码';
  }

  if (data.bio && data.bio.length > 500) {
    errors.bio = '个人简介不能超过500字符';
  }

  // 放宽网址校验：支持协议可选、常见域名/端口/路径/查询参数，忽略大小写
  const urlRegex =
    /^(https?:\/\/)?([\w-]+\.)+[\w-]{2,}(:\d{1,5})?(\/[\w\-._~:/?#[\]@!$&'()*+,;=%]*)?$/i;
  if (data.website && !urlRegex.test(data.website.trim())) {
    errors.website = '请输入有效的网址';
  }

  // GitHub：支持纯用户名 或 github.com/用户名 完整链接
  const githubRegex =
    /^(https?:\/\/)?(www\.)?github\.com\/@?([a-zA-Z0-9-]{1,39})\/?$|^@?([a-zA-Z0-9-]{1,39})$/;
  if (data.github && !githubRegex.test(data.github.trim())) {
    errors.github = '请输入有效的 GitHub 用户名或主页链接';
  }

  // LinkedIn：支持有无协议前缀、有无 www
  const linkedinRegex = /^(https?:\/\/)?([\w]{2,3}\.)?linkedin\.com\/in\/[\w-]+\/?$/i;
  if (data.linkedin && !linkedinRegex.test(data.linkedin.trim())) {
    errors.linkedin = '请输入有效的 LinkedIn URL';
  }

  return errors;
};

/**
 * 规范化社交链接字段（保存前调用）：
 * - 去除首尾空白
 * - GitHub 完整链接 → 提取用户名（去掉 https://github.com/ 前缀）
 * - 网站缺少协议 → 自动补 https://
 */
export const normalizePersonalInfo = (data: PersonalInfoFormData): PersonalInfoFormData => {
  let github = data.github.trim();
  if (github) {
    const m = github.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/@?([a-zA-Z0-9-]{1,39})/i);
    if (m) github = m[1];
  }

  let website = data.website.trim();
  if (website && !/^https?:\/\//i.test(website)) {
    website = `https://${website}`;
  }

  return {
    ...data,
    fullName: data.fullName.trim(),
    email: data.email.trim(),
    phone: data.phone.trim(),
    department: data.department.trim(),
    position: data.position.trim(),
    bio: data.bio,
    website,
    github,
    linkedin: data.linkedin.trim(),
  };
};

export const hasErrors = (errors: FormValidationErrors): boolean => {
  return Object.keys(errors).length > 0;
};