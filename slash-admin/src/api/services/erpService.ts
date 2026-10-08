import apiClient from "../apiClient";

// ============================================
// Authentication
// ============================================
export interface LoginReq {
  username: string;
  password: string;
}

export interface LoginRes {
  user: UserInfo;
  accessToken: string;
  refreshToken: string;
}

export interface UserInfo {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  is_staff: boolean;
  date_joined: string;
}

export const AuthApi = {
  login: (data: LoginReq) => apiClient.post<LoginRes>({ url: "/auth/login/", data }),
  register: (data: LoginReq & { email: string }) =>
    apiClient.post<LoginRes>({ url: "/auth/register/", data }),
  profile: () => apiClient.get<UserInfo>({ url: "/auth/profile/" }),
  refresh: (refreshToken: string) =>
    apiClient.post<{ accessToken: string }>({
      url: "/auth/refresh/",
      data: { refreshToken },
    }),
};





// ============================================
// Warehouses
// ============================================
export interface Warehouse {
  id: number;
  warehouse_name: string;
  warehouse_type: string;
  company: number | null;
  address: string;
  is_active: boolean;
  creation: string;
  modified: string;
}

export const WarehouseApi = {
  list: (params?: Record<string, any>) =>
    apiClient.get<{ results: Warehouse[]; count: number }>({
      url: "/healthcare/pharmacy-warehouses/",
      params,
    }),
  get: (id: number) => apiClient.get<Warehouse>({ url: `/healthcare/pharmacy-warehouses/${id}/` }),
  create: (data: Partial<Warehouse>) =>
    apiClient.post<Warehouse>({ url: "/healthcare/pharmacy-warehouses/", data }),
  update: (id: number, data: Partial<Warehouse>) =>
    apiClient.put<Warehouse>({ url: `/healthcare/pharmacy-warehouses/${id}/`, data }),
  delete: (id: number) => apiClient.delete({ url: `/healthcare/pharmacy-warehouses/${id}/` }),
};



// ============================================
// Roles & Permissions (Frappe-style)
// ============================================
export interface ErpRole {
  id: number;
  name: string;
  description: string;
  is_system_role: boolean;
  is_active: boolean;
  users_count: number;
  permissions_count: number;
}

export interface ErpPermission {
  id: number;
  doctype: number;
  doctype_name: string;
  permission_type: string;
  conditions: Record<string, any>;
}

export interface PermissionMatrix {
  roles: Array<{
    id: number;
    name: string;
    permissions: Record<string, string[]>;
  }>;
  doctypes: string[];
}

export const RoleApi = {
  list: (params?: Record<string, any>) =>
    apiClient.get<{ results: ErpRole[]; count: number }>({ url: "/roles/roles/", params }),
  get: (id: number) => apiClient.get<ErpRole>({ url: `/roles/roles/${id}/` }),
  create: (data: Partial<ErpRole>) => apiClient.post<ErpRole>({ url: "/roles/roles/", data }),
  update: (id: number, data: Partial<ErpRole>) =>
    apiClient.put<ErpRole>({ url: `/roles/roles/${id}/`, data }),
  delete: (id: number) => apiClient.delete({ url: `/roles/roles/${id}/` }),
};

export const PermissionMatrixApi = {
  get: () => apiClient.get<PermissionMatrix>({ url: "/roles/matrix/" }),
};

export const MyPermissionsApi = {
  get: () =>
    apiClient.get<{ roles: string[]; permissions: Record<string, string[]>; is_staff: boolean }>({
      url: "/roles/my/",
    }),
};

// ============================================
// Permission Inspector (Frappe-style)
// ============================================
export interface PermissionInspectorResult {
  user: string;
  ref_doctype: string;
  docname: string;
  permission_type: string;
  result: boolean;
  user_roles: string[];
  doctype_permissions: Array<{
    role: string;
    permlevel: number;
    if_owner: boolean;
    active_permissions: string[];
  }>;
}

export const PermissionInspectorApi = {
  inspect: (data: { ref_doctype: string; user: string; permission_type?: string; docname?: string }) =>
    apiClient.post<PermissionInspectorResult>({ url: "/roles/permission-inspector/", data }),
};

// ============================================
// User & Role APIs for Inspector dropdowns
// ============================================
export interface UserListItem {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  is_staff: boolean;
  is_active: boolean;
  roles: Array<{ id: string; name: string }>;
}

export interface DocTypeListItem {
  id: number;
  name: string;
  module: string;
  is_submittable: boolean;
  is_active: boolean;
}

export const UserListApi = {
  list: (params?: Record<string, any>) =>
    apiClient.get<{ results: UserListItem[]; count: number }>({ url: "/roles/users/", params }),
};

export const DocTypeListApi = {
  list: (params?: Record<string, any>) =>
    apiClient.get<{ results: DocTypeListItem[]; count: number }>({ url: "/roles/doctypes/", params }),
};

// ============================================
// User Permissions (Frappe-style row-level)
// ============================================
export interface UserPermission {
  id: number;
  user: number;
  user_username: string;
  allow: string;
  for_value: string;
  is_default: boolean;
  apply_to_all_doctypes: boolean;
  applicable_for: string;
  hide_descendants: boolean;
  creation: string;
  modified: string;
}

export const UserPermissionApi = {
  list: (params?: Record<string, any>) =>
    apiClient.get<{ results: UserPermission[]; count: number }>({ url: "/roles/user-permissions/", params }),
  get: (id: number) => apiClient.get<UserPermission>({ url: `/roles/user-permissions/${id}/` }),
  create: (data: Partial<UserPermission>) =>
    apiClient.post<UserPermission>({ url: "/roles/user-permissions/", data }),
  update: (id: number, data: Partial<UserPermission>) =>
    apiClient.put<UserPermission>({ url: `/roles/user-permissions/${id}/`, data }),
  delete: (id: number) => apiClient.delete({ url: `/roles/user-permissions/${id}/` }),
};

// ============================================
// DocShare (Frappe-style document sharing)
// ============================================
export interface DocShare {
  id: number;
  user: number | null;
  user_username: string;
  share_doctype: string;
  share_name: string;
  everyone: boolean;
  read: boolean;
  write: boolean;
  submit: boolean;
  share: boolean;
  notify_by_email: boolean;
  owner: string;
  creation: string;
  modified: string;
}

export const DocShareApi = {
  list: (params?: Record<string, any>) =>
    apiClient.get<{ results: DocShare[]; count: number }>({ url: "/roles/doc-shares/", params }),
  get: (id: number) => apiClient.get<DocShare>({ url: `/roles/doc-shares/${id}/` }),
  create: (data: Partial<DocShare>) =>
    apiClient.post<DocShare>({ url: "/roles/doc-shares/", data }),
  update: (id: number, data: Partial<DocShare>) =>
    apiClient.put<DocShare>({ url: `/roles/doc-shares/${id}/`, data }),
  delete: (id: number) => apiClient.delete({ url: `/roles/doc-shares/${id}/` }),
};

// ============================================
// Data Import (Frappe-style)
// ============================================
export interface DataImport {
  id: string;
  reference_doctype: string;
  import_file: string;
  google_sheets_url: string;
  import_type: string;
  status: string;
  submit_after_import: boolean;
  mute_emails: boolean;
  payload_count: number;
  show_failed_logs: boolean;
  template_options: string;
  template_warnings: string;
  custom_delimiters: boolean;
  delimiter_options: string;
  use_csv_sniffer: boolean;
  owner: string;
  creation: string;
  modified: string;
}

export interface DataImportLog {
  id: string;
  data_import: string;
  log_index: number;
  success: boolean;
  docname: string;
  messages: string;
  exception: string;
  row_indexes: number[];
  import_action: string;
  creation: string;
}

export const DataImportApi = {
  list: (params?: Record<string, any>) =>
    apiClient.get<{ results: DataImport[]; count: number }>({ url: "/roles/data-imports/", params }),
  get: (id: string) => apiClient.get<DataImport>({ url: `/roles/data-imports/${id}/` }),
  create: (data: Partial<DataImport>) =>
    apiClient.post<DataImport>({ url: "/roles/data-imports/", data }),
  update: (id: string, data: Partial<DataImport>) =>
    apiClient.put<DataImport>({ url: `/roles/data-imports/${id}/`, data }),
  delete: (id: string) => apiClient.delete({ url: `/roles/data-imports/${id}/` }),
};

// ============================================
// Data Export (Frappe-style)
// ============================================
export interface DataExport {
  id: string;
  reference_doctype: string;
  file_type: string;
  export_without_main_header: boolean;
  owner: string;
  creation: string;
  modified: string;
}

export const DataExportApi = {
  list: (params?: Record<string, any>) =>
    apiClient.get<{ results: DataExport[]; count: number }>({ url: "/roles/data-exports/", params }),
  get: (id: string) => apiClient.get<DataExport>({ url: `/roles/data-exports/${id}/` }),
  create: (data: Partial<DataExport>) =>
    apiClient.post<DataExport>({ url: "/roles/data-exports/", data }),
  delete: (id: string) => apiClient.delete({ url: `/roles/data-exports/${id}/` }),
};

// ============================================
// Comments (Frappe-style)
// ============================================
export interface Comment {
  id: number | string;
  comment_type: string;
  comment_email: string;
  comment_by: string;
  subject: string;
  content: string;
  published: boolean;
  seen: boolean;
  reference_doctype: string;
  reference_name: string;
  reference_owner: string;
  ip_address: string;
  owner: string;
  comment_user_name: string;
  timeline_links_count: number;
  creation: string;
  modified: string;
}

export const CommentApi = {
  list: (params?: Record<string, any>) =>
    apiClient.get<{ results: Comment[]; count: number }>({ url: "/roles/comments/", params }),
  get: (id: number | string) => apiClient.get<Comment>({ url: `/roles/comments/${id}/` }),
  create: (data: Partial<Comment>) => apiClient.post<Comment>({ url: "/roles/comments/", data }),
  update: (id: number | string, data: Partial<Comment>) =>
    apiClient.put<Comment>({ url: `/roles/comments/${id}/`, data }),
  delete: (id: number | string) => apiClient.delete({ url: `/roles/comments/${id}/` }),
  timeline: (reference_doctype: string, reference_name: string) =>
    apiClient.get<Array<{ type: string; data: Comment; date: string }>>({
      url: "/roles/comments/timeline/",
      params: { reference_doctype, reference_name },
    }),
};

// ============================================
// Communications (Frappe-style)
// ============================================
export interface Communication {
  id: number;
  subject: string;
  content: string;
  text_content: string;
  communication_medium: string;
  communication_type: string;
  status: string;
  sent_or_received: string;
  delivery_status: string;
  sender: string;
  sender_full_name: string;
  sender_name_display: string;
  recipients: string;
  cc: string;
  bcc: string;
  phone_no: string;
  communication_date: string;
  user: number;
  user_name: string;
  reference_doctype: string;
  reference_name: string;
  reference_owner: string;
  email_account: string;
  in_reply_to: string;
  message_id: string;
  email_status: string;
  seen: boolean;
  read_by_recipient: boolean;
  read_by_recipient_on: string;
  has_attachment: boolean;
  send_after: string;
  timeline_links: CommunicationLink[];
  to_list: string[];
  cc_list: string[];
  owner: string;
  creation: string;
  modified: string;
}

export interface CommunicationLink {
  id: number;
  link_doctype: string;
  link_name: string;
  link_title: string;
  communication_date: string;
}

export const CommunicationApi = {
  list: (params?: Record<string, any>) =>
    apiClient.get<{ results: Communication[]; count: number }>({ url: "/roles/communications/", params }),
  get: (id: number) => apiClient.get<Communication>({ url: `/roles/communications/${id}/` }),
  create: (data: Partial<Communication> & { timeline_links_data?: Array<{ link_doctype: string; link_name: string }> }) =>
    apiClient.post<Communication>({ url: "/roles/communications/", data }),
  update: (id: number, data: Partial<Communication>) =>
    apiClient.put<Communication>({ url: `/roles/communications/${id}/`, data }),
  delete: (id: number) => apiClient.delete({ url: `/roles/communications/${id}/` }),
  addLink: (id: number, data: { link_doctype: string; link_name: string }) =>
    apiClient.post<CommunicationLink>({ url: `/roles/communications/${id}/add-link/`, data }),
  removeLink: (id: number, data: { link_doctype: string; link_name: string }) =>
    apiClient.post<{ deleted: number }>({ url: `/roles/communications/${id}/remove-link/`, data }),
  markRead: (id: number) =>
    apiClient.post<{ status: string }>({ url: `/roles/communications/${id}/mark-read/` }),
  timeline: (reference_doctype: string, reference_name: string) =>
    apiClient.get<Communication[]>({
      url: "/roles/communications/timeline/",
      params: { reference_doctype, reference_name },
    }),
  bulkSend: (data: {
    subject: string;
    content: string;
    communication_medium: string;
    recipients: string[];
    cc?: string[];
    reference_doctype?: string;
    reference_name?: string;
  }) =>
    apiClient.post<{ detail: string; count: number; communications: Communication[] }>({
      url: "/roles/communications/bulk-send/",
      data,
    }),
};

// ============================================
// Error Logs
// ============================================
export interface ErrorLog {
  id: number;
  method: string;
  error: string;
  reference_doctype: string;
  reference_name: string;
  seen: boolean;
  fingerprint: string;
  trace_id: string;
  metadata: Record<string, any>;
  creation: string;
}

export const ErrorLogApi = {
  list: (params?: Record<string, any>) =>
    apiClient.get<{ results: ErrorLog[]; count: number }>({ url: "/roles/error-logs/", params }),
  get: (id: number) => apiClient.get<ErrorLog>({ url: `/roles/error-logs/${id}/` }),
  delete: (id: number) => apiClient.delete({ url: `/roles/error-logs/${id}/` }),
  clearAll: () => apiClient.post<{ status: string }>({ url: "/roles/error-logs/clear-all/" }),
};

// ============================================
// View Logs
// ============================================
export interface ViewLog {
  id: number;
  reference_doctype: string;
  reference_name: string;
  viewed_by: number;
  viewed_by_username: string;
  creation: string;
}

export const ViewLogApi = {
  list: (params?: Record<string, any>) =>
    apiClient.get<{ results: ViewLog[]; count: number }>({ url: "/roles/view-logs/", params }),
};

// ============================================
// Versions
// ============================================
export interface Version {
  id: number;
  ref_doctype: string;
  docname: string;
  data: Record<string, any>;
  owner: string;
  creation: string;
}

export const VersionApi = {
  list: (params?: Record<string, any>) =>
    apiClient.get<{ results: Version[]; count: number }>({ url: "/roles/versions/", params }),
};

// ============================================
// Scheduled Jobs
// ============================================
export interface ScheduledJobType {
  id: number;
  method: string;
  frequency: string;
  cron_format: string;
  queue: string;
  stopped: boolean;
  create_log: boolean;
  last_execution: string;
  last_execution_display: string;
  server_script: number | null;
  scheduler_event: string;
  owner: string;
  creation: string;
  modified: string;
}

export const ScheduledJobApi = {
  list: (params?: Record<string, any>) =>
    apiClient.get<{ results: ScheduledJobType[]; count: number }>({ url: "/roles/job-types/", params }),
  get: (id: number) => apiClient.get<ScheduledJobType>({ url: `/roles/job-types/${id}/` }),
  create: (data: Partial<ScheduledJobType>) =>
    apiClient.post<ScheduledJobType>({ url: "/roles/job-types/", data }),
  update: (id: number, data: Partial<ScheduledJobType>) =>
    apiClient.put<ScheduledJobType>({ url: `/roles/job-types/${id}/`, data }),
  delete: (id: number) => apiClient.delete({ url: `/roles/job-types/${id}/` }),
  execute: (id: number) =>
    apiClient.post<{ status: string }>({ url: `/roles/job-types/${id}/execute/` }),
};

// ============================================
// Server Scripts
// ============================================
export interface ServerScript {
  id: number;
  name_display: string;
  script_type: string;
  reference_doctype: string;
  module: string;
  script: string;
  disabled: boolean;
  allow_guest: boolean;
  event_frequency: string;
  cron_format: string;
  api_method: string;
  enable_rate_limit: boolean;
  rate_limit_count: number;
  rate_limit_seconds: number;
  owner: string;
  creation: string;
  modified: string;
}

export const ServerScriptApi = {
  list: (params?: Record<string, any>) =>
    apiClient.get<{ results: ServerScript[]; count: number }>({ url: "/roles/server-scripts/", params }),
  get: (id: string | number) => apiClient.get<ServerScript>({ url: `/roles/server-scripts/${id}/` }),
  create: (data: Partial<ServerScript>) =>
    apiClient.post<ServerScript>({ url: "/roles/server-scripts/", data }),
  update: (id: string | number, data: Partial<ServerScript>) =>
    apiClient.put<ServerScript>({ url: `/roles/server-scripts/${id}/`, data }),
  delete: (id: string | number) => apiClient.delete({ url: `/roles/server-scripts/${id}/` }),
};
