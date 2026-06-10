import type { User } from '@/types'

export interface UserProfile extends User {
  position?: string;
  bio?: string;
  website?: string;
  github?: string;
  linkedin?: string;
}

export interface PersonalInfoFormData {
  fullName: string;
  email: string;
  phone: string;
  department: string;
  position: string;
  bio: string;
  website: string;
  github: string;
  linkedin: string;
}

export interface FormValidationErrors {
  fullName?: string;
  email?: string;
  phone?: string;
  department?: string;
  position?: string;
  bio?: string;
  website?: string;
  github?: string;
  linkedin?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface AvatarUploadResponse {
  avatarUrl: string;
}
