import { useState, useCallback, useEffect, useRef } from 'react';
import { userService } from '../services/userService';
import { useAuthStore } from '@/stores/auth';
import type { UserProfile, PersonalInfoFormData, FormValidationErrors } from '../types/user';
import { validatePersonalInfo, hasErrors, normalizePersonalInfo } from '../utils/validation';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface UsePersonalInfoReturn {
  profile: UserProfile | null;
  formData: PersonalInfoFormData;
  loading: boolean;
  saving: boolean;
  saveStatus: SaveStatus;
  errors: FormValidationErrors;
  isDirty: boolean;
  fetchProfile: () => Promise<void>;
  updateField: <K extends keyof PersonalInfoFormData>(key: K, value: PersonalInfoFormData[K]) => void;
  validateForm: () => boolean;
  saveProfile: (avatarUrl?: string | null) => Promise<boolean>;
  resetForm: () => void;
}

export const usePersonalInfo = (): UsePersonalInfoReturn => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [formData, setFormData] = useState<PersonalInfoFormData>({
    fullName: '',
    email: '',
    phone: '',
    department: '',
    position: '',
    bio: '',
    website: '',
    github: '',
    linkedin: '',
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [errors, setErrors] = useState<FormValidationErrors>({});
  const [isDirty, setIsDirty] = useState(false);
  const [originalData, setOriginalData] = useState<PersonalInfoFormData | null>(null);
  // 记录是否已成功拉取过资料（用于挂载后兜底重试，避免重复请求）
  const hasLoadedRef = useRef(false);

  // 认证就绪后再拉取资料（页面刷新后静默认证可能晚于组件挂载，
  // 避免首次 401 后不再重试导致表单空白）
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    try {
      const response = await userService.getProfile();
      if (response.success && response.data) {
        hasLoadedRef.current = true;
        const data = response.data;
        setProfile(data);
        const newFormData: PersonalInfoFormData = {
          fullName: data.fullName || '',
          email: data.email || '',
          phone: data.phone || '',
          department: data.department || '',
          position: data.position || '',
          bio: data.bio || '',
          website: data.website || '',
          github: data.github || '',
          linkedin: data.linkedin || '',
        };
        setFormData(newFormData);
        setOriginalData(newFormData);
        setErrors({});
        setIsDirty(false);
        setSaveStatus('idle');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const updateField = useCallback(<K extends keyof PersonalInfoFormData>(
    key: K,
    value: PersonalInfoFormData[K],
  ) => {
    setFormData(prev => ({ ...prev, [key]: value }));
    setIsDirty(true);
    setSaveStatus('idle');
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[key];
      return newErrors;
    });
  }, []);

  const validateForm = useCallback((): boolean => {
    const newErrors = validatePersonalInfo(formData);
    setErrors(newErrors);
    return !hasErrors(newErrors);
  }, [formData]);

  const saveProfile = useCallback(async (avatarUrl?: string | null): Promise<boolean> => {
    if (!validateForm()) {
      setSaveStatus('error');
      return false;
    }

    setSaving(true);
    setSaveStatus('saving');
    try {
      // 保存前规范化社交链接（GitHub URL→用户名、网站补协议、去空格）
      const normalized = normalizePersonalInfo(formData);
      const options = avatarUrl !== undefined ? { avatarUrl } : undefined;
      const response = await userService.updateProfile(normalized, options);
      if (response.success && response.data) {
        setProfile(response.data);
        // 同步全局 auth store，使侧边栏/顶栏等位置即时生效
        useAuthStore.getState().setUser(response.data);
        setOriginalData(normalized);
        setFormData(normalized);
        setIsDirty(false);
        setSaveStatus('saved');
        return true;
      } else {
        setErrors({ fullName: response.error || '保存失败' });
        setSaveStatus('error');
        return false;
      }
    } finally {
      setSaving(false);
    }
  }, [formData, validateForm]);

  const resetForm = useCallback(() => {
    if (originalData) {
      setFormData(originalData);
      setErrors({});
      setIsDirty(false);
      setSaveStatus('idle');
    }
  }, [originalData]);

  // 挂载时无条件拉取一次：即使访问令牌过期，axios 会自动刷新令牌并重试，
  // 避免「静默认证失败导致 isAuthenticated 卡在 false、资料永不回读」的问题
  useEffect(() => {
    fetchProfile();
  }, []);

  // 认证从无到有时，若挂载拉取未成功则补拉一次
  useEffect(() => {
    if (isAuthenticated && !hasLoadedRef.current) {
      fetchProfile();
    }
  }, [isAuthenticated, fetchProfile]);

  return {
    profile,
    formData,
    loading,
    saving,
    saveStatus,
    errors,
    isDirty,
    fetchProfile,
    updateField,
    validateForm,
    saveProfile,
    resetForm,
  };
};