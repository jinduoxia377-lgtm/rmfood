import { useState, useCallback, useEffect, useRef } from 'react';
import { userService } from '../services/userService';
import type { UserProfile, PersonalInfoFormData, FormValidationErrors } from '../types/user';
import { validatePersonalInfo, hasErrors } from '../utils/validation';

interface UsePersonalInfoReturn {
  profile: UserProfile | null;
  formData: PersonalInfoFormData;
  loading: boolean;
  saving: boolean;
  errors: FormValidationErrors;
  isDirty: boolean;
  fetchProfile: () => Promise<void>;
  updateField: <K extends keyof PersonalInfoFormData>(key: K, value: PersonalInfoFormData[K]) => void;
  validateForm: () => boolean;
  saveProfile: () => Promise<boolean>;
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
  const [errors, setErrors] = useState<FormValidationErrors>({});
  const [isDirty, setIsDirty] = useState(false);
  const [originalData, setOriginalData] = useState<PersonalInfoFormData | null>(null);

  const hasFetchedRef = useRef(false);

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    try {
      const response = await userService.getProfile();
      if (response.success && response.data) {
        setProfile(response.data);
        const newFormData = {
          fullName: (response.data as any).full_name || '',
          email: response.data.email || '',
          phone: response.data.phone || '',
          department: response.data.department || '',
          position: response.data.position || '',
          bio: response.data.bio || '',
          website: response.data.website || '',
          github: response.data.github || '',
          linkedin: response.data.linkedin || '',
        };
        setFormData(newFormData);
        setOriginalData(newFormData);
        setErrors({});
        setIsDirty(false);
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

  const saveProfile = useCallback(async (): Promise<boolean> => {
    if (!validateForm()) {
      return false;
    }

    setSaving(true);
    try {
      const response = await userService.updateProfile(formData);
      if (response.success) {
        if (response.data) {
          setProfile(response.data);
        }
        setOriginalData(formData);
        setIsDirty(false);
        return true;
      } else {
        setErrors({ fullName: response.error || '保存失败' });
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
    }
  }, [originalData]);

  // 使用 ref 避免循环依赖问题
  useEffect(() => {
    if (!hasFetchedRef.current) {
      hasFetchedRef.current = true;
      fetchProfile();
    }
  }, [fetchProfile]);

  return {
    profile,
    formData,
    loading,
    saving,
    errors,
    isDirty,
    fetchProfile,
    updateField,
    validateForm,
    saveProfile,
    resetForm,
  };
};
