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

export enum UserApi {
  SignIn = "/auth/login/",
  SignUp = "/auth/register/",
  Logout = "/auth/logout/",
  Refresh = "/auth/refresh/",
  User = "/auth/users/",
  Profile = "/auth/profile/",
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
 * Logout (optional - client-side token clear).
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

export default {
  signin,
  signup,
  findById,
  logout,
  getProfile,
  refreshToken,
};
