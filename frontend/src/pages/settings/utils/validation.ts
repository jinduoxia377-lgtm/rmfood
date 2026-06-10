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

  const urlRegex = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([\/\w .-]*)*\/?$/;
  if (data.website && !urlRegex.test(data.website)) {
    errors.website = '请输入有效的网址';
  }

  const githubRegex = /^@?([a-zA-Z0-9-]){1,39}$/;
  if (data.github && !githubRegex.test(data.github)) {
    errors.github = '请输入有效的 GitHub 用户名';
  }

  const linkedinRegex = /^(https?:\/\/)?([\w]{2,3}\.)?linkedin\.com\/in\/[\w-]+\/?$/;
  if (data.linkedin && !linkedinRegex.test(data.linkedin)) {
    errors.linkedin = '请输入有效的 LinkedIn URL';
  }

  return errors;
};

export const hasErrors = (errors: FormValidationErrors): boolean => {
  return Object.keys(errors).length > 0;
};
