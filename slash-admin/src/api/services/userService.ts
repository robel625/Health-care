import apiClient from "../apiClient";

import type { UserInfo, UserToken } from "#/entity";

export interface SignInReq {
  username: string;
  password: string;
}

export interface SignUpReq extends SignInReq {
  email: string;
}

export type SignInRes = UserToken & { user: UserInfo };

export interface ForgotPasswordReq {
  identifier: string; // Email address OR Phone number
}

export interface ForgotPasswordRes {
  success: boolean;
  message: string;
  channel: "email" | "phone";
  target_masked: string;
  token: string;
  debug_code?: string;
}

export interface VerifyResetCodeReq {
  code: string;
  token?: string;
  identifier?: string;
}

export interface ResetPasswordReq {
  code: string;
  new_password: string;
  token?: string;
  identifier?: string;
}

export interface ResetPasswordRes {
  success: boolean;
  message: string;
  username?: string;
}

export enum UserApi {
  SignIn = "/auth/login/",
  SignUp = "/auth/register/",
  Logout = "/auth/logout/",
  Refresh = "/auth/refresh/",
  User = "/auth/users/",
  Profile = "/auth/profile/",
  ForgotPassword = "/auth/forgot-password/",
  VerifyResetCode = "/auth/verify-reset-code/",
  ResetPassword = "/auth/reset-password/",
}

/**
 * Sign in with username and password.
 * Django backend returns: { user: UserInfo, accessToken: string, refreshToken: string }
 */
const signin = (data: SignInReq) => apiClient.post<SignInRes>({ url: UserApi.SignIn, data });

/**
 * Register a new user.
 */
const signup = (data: SignUpReq) => apiClient.post<SignInRes>({ url: UserApi.SignUp, data });

/**
 * Logout (client-side token clear).
 */
const logout = () => apiClient.get({ url: UserApi.Logout });

/**
 * Get user by ID.
 */
const findById = (id: string) => apiClient.get<UserInfo>({ url: `${UserApi.User}${id}/` });

/**
 * Get current user profile from Django backend.
 */
const getProfile = () => apiClient.get<UserInfo>({ url: UserApi.Profile });

/**
 * Refresh JWT token.
 */
const refreshToken = (refreshToken: string) =>
  apiClient.post<{ accessToken: string }>({
    url: UserApi.Refresh,
    data: { refreshToken },
  });

/**
 * Request password reset using Email address or Phone number.
 */
const forgotPassword = (data: ForgotPasswordReq) =>
  apiClient.post<ForgotPasswordRes>({
    url: UserApi.ForgotPassword,
    data,
  });

/**
 * Verify 6-digit password reset OTP.
 */
const verifyResetCode = (data: VerifyResetCodeReq) =>
  apiClient.post<{ valid: boolean; message: string }>({
    url: UserApi.VerifyResetCode,
    data,
  });

/**
 * Reset password with verification code.
 */
const resetPassword = (data: ResetPasswordReq) =>
  apiClient.post<ResetPasswordRes>({
    url: UserApi.ResetPassword,
    data,
  });

export default {
  signin,
  signup,
  findById,
  logout,
  getProfile,
  refreshToken,
  forgotPassword,
  verifyResetCode,
  resetPassword,
};
