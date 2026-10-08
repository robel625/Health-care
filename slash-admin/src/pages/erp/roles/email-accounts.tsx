import { Icon } from "@/components/icon";
import apiClient from "@/api/apiClient";
import { Button } from "@/ui/button";
import { Badge } from "@/ui/badge";
import { ScrollArea } from "@/ui/scroll-area";
import { Separator } from "@/ui/separator";
import { Text } from "@/ui/typography";
import { useCallback, useEffect, useState } from "react";

// ── Types ──────────────────────────────────────────────────────

interface EmailAccount {
  id: number;
  email_account_name: string;
  email_id: string;
  email_sender_name: string;
  smtp_server: string;
  smtp_port: number;
  smtp_username: string;
  smtp_password: string;
  use_tls: boolean;
  use_ssl: boolean;
  incoming_server: string;
  incoming_port: number;
  use_imap: boolean;
  default_incoming: boolean;
  default_outgoing: boolean;
  enable_outgoing: boolean;
  enable_incoming: boolean;
  anonymized: boolean;
  always_use_account_name: boolean;
  bcc_address: string;
  footer: string;
  footer_included: boolean;
  creation: string;
  modified: string;
}

// ── Main Component ─────────────────────────────────────────────

export default function EmailAccountsPage() {
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<EmailAccount | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [testResults, setTestResults] = useState<Record<number, { success: boolean; message: string }>>({});
  const [testingId, setTestingId] = useState<number | null>(null);

  const fetchAccounts = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiClient.get<{ results: EmailAccount[] }>({
        url: "/roles/email-accounts/",
        params: { page_size: "50", ordering: "-default_outgoing" },
      });
      setAccounts(data.results || []);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const testConnection = useCallback(async (id: number) => {
    setTestingId(id);
    try {
      const data = await apiClient.post<{ success: boolean; message: string; error?: string }>({
        url: `/roles/email-accounts/${id}/test_connection/`,
      });
      setTestResults((prev) => ({
        ...prev,
        [id]: { success: data.success, message: data.message || data.error || "" },
      }));
    } catch (err: any) {
      setTestResults((prev) => ({
        ...prev,
        [id]: { success: false, message: err?.response?.data?.error || "Connection failed" },
      }));
    } finally {
      setTestingId(null);
    }
  }, []);

  const sendTestEmail = useCallback(async (id: number, toEmail: string) => {
    setTestingId(id);
    try {
      const data = await apiClient.post<{ success: boolean; message: string }>({
        url: `/roles/email-accounts/${id}/send_test_email/`,
        data: { to_email: toEmail },
      });
      setTestResults((prev) => ({
        ...prev,
        [id]: { success: data.success, message: data.message },
      }));
    } catch (err: any) {
      setTestResults((prev) => ({
        ...prev,
        [id]: { success: false, message: err?.response?.data?.error || "Send failed" },
      }));
    } finally {
      setTestingId(null);
    }
  }, []);

  const deleteAccount = useCallback(async (id: number) => {
    try {
      await apiClient.delete({ url: `/roles/email-accounts/${id}/` });
      await fetchAccounts();
    } catch {
      // silently fail
    }
  }, [fetchAccounts]);

  const toggleDefault = useCallback(async (id: number, field: string, current: boolean) => {
    try {
      const account = accounts.find((a) => a.id === id);
      if (account) {
        await apiClient.put({
          url: `/roles/email-accounts/${id}/`,
          data: { ...account, [field]: !current },
        });
      }
      await fetchAccounts();
    } catch {
      // silently fail
    }
  }, [fetchAccounts]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Icon icon="solar:refresh-bold" size={24} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Text variant="subTitle1" className="flex items-center gap-2 text-lg font-semibold">
            <Icon icon="solar:letter-bold" size={24} className="text-primary" />
            Email Accounts
          </Text>
          <Text variant="body2" color="secondary" className="mt-1">
            Configure SMTP settings for outgoing notification emails
          </Text>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">
            {accounts.filter((a) => a.enable_outgoing).length} active
          </Badge>
          <Button
            size="sm"
            onClick={() => {
              setEditing(null);
              setShowForm(true);
            }}
          >
            <Icon icon="solar:add-circle-bold" size={16} className="mr-1" />
            Add Account
          </Button>
        </div>
      </div>

      <Separator />

      {/* Account cards */}
      <ScrollArea className="h-[calc(100vh-240px)]">
        <div className="space-y-4 pr-4">
          {accounts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Icon icon="solar:letter-unread-bold" size={40} className="mb-3 opacity-50" />
              <Text variant="subTitle2">No email accounts configured</Text>
              <Text variant="caption" color="secondary">
                Add an email account to enable email notifications
              </Text>
            </div>
          ) : (
            accounts.map((account) => (
              <AccountCard
                key={account.id}
                account={account}
                testResult={testResults[account.id]}
                testing={testingId === account.id}
                onTestConnection={testConnection}
                onSendTestEmail={sendTestEmail}
                onEdit={() => {
                  setEditing(account);
                  setShowForm(true);
                }}
                onDelete={deleteAccount}
                onToggleDefault={toggleDefault}
              />
            ))
          )}
        </div>
      </ScrollArea>

      {/* Create/Edit Form Dialog */}
      {showForm && (
        <AccountFormDialog
          account={editing}
          onClose={() => {
            setShowForm(false);
            setEditing(null);
          }}
          onSave={async () => {
            setShowForm(false);
            setEditing(null);
            await fetchAccounts();
          }}
        />
      )}
    </div>
  );
}

// ── Account Card ───────────────────────────────────────────────

interface AccountCardProps {
  account: EmailAccount;
  testResult?: { success: boolean; message: string };
  testing: boolean;
  onTestConnection: (id: number) => void;
  onSendTestEmail: (id: number, email: string) => void;
  onEdit: () => void;
  onDelete: (id: number) => void;
  onToggleDefault: (id: number, field: string, current: boolean) => void;
}

function AccountCard({
  account,
  testResult,
  testing,
  onTestConnection,
  onSendTestEmail,
  onEdit,
  onDelete,
  onToggleDefault,
}: AccountCardProps) {
  const [showTestInput, setShowTestInput] = useState(false);
  const [testEmail, setTestEmail] = useState("");

  return (
    <div className={`border rounded-lg overflow-hidden ${account.default_outgoing ? "border-primary/30" : ""}`}>
      {/* Header */}
      <div className="px-4 py-3 bg-muted/30 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
            account.enable_outgoing ? "bg-primary/10" : "bg-muted"
          }`}>
            <Icon
              icon="solar:letter-bold"
              size={20}
              className={account.enable_outgoing ? "text-primary" : "text-muted-foreground"}
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <Text variant="subTitle2">{account.email_account_name}</Text>
              {account.default_outgoing && (
                <Badge variant="default" className="text-[10px] px-1.5">Default</Badge>
              )}
              {account.enable_outgoing ? (
                <Badge variant="success" className="text-[10px] px-1.5">Active</Badge>
              ) : (
                <Badge variant="secondary" className="text-[10px] px-1.5">Disabled</Badge>
              )}
            </div>
            <Text variant="caption" color="secondary">
              {account.email_sender_name
                ? `${account.email_sender_name} <${account.email_id}>`
                : account.email_id}
            </Text>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit} title="Edit">
            <Icon icon="solar:pen-bold" size={16} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive"
            onClick={() => {
              if (confirm(`Delete "${account.email_account_name}"?`)) onDelete(account.id);
            }}
            title="Delete"
          >
            <Icon icon="solar:trash-bin-minimalistic-bold" size={16} />
          </Button>
        </div>
      </div>

      {/* Details */}
      <div className="px-4 py-3 space-y-2">
        {/* SMTP Config */}
        <div className="flex items-center gap-6 text-sm">
          <div className="flex items-center gap-1.5">
            <Icon icon="solar:server-bold" size={14} className="text-muted-foreground" />
            <Text variant="caption">
              {account.smtp_server || "Console (no SMTP)"}:{account.smtp_port}
            </Text>
          </div>
          <div className="flex items-center gap-1.5">
            <Icon icon="solar:lock-bold" size={14} className="text-muted-foreground" />
            <Text variant="caption">
              {account.use_ssl ? "SSL" : account.use_tls ? "TLS" : "None"}
            </Text>
          </div>
          {account.smtp_username && (
            <div className="flex items-center gap-1.5">
              <Icon icon="solar:user-bold" size={14} className="text-muted-foreground" />
              <Text variant="caption">{account.smtp_username}</Text>
            </div>
          )}
        </div>

        {/* Flags */}
        <div className="flex items-center gap-3 flex-wrap">
          <button
            className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-md transition-colors ${
              account.default_outgoing
                ? "bg-primary/10 text-primary"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
            onClick={() => onToggleDefault(account.id, "default_outgoing", account.default_outgoing)}
            title="Toggle default outgoing"
          >
            <Icon icon="solar:export-bold" size={12} />
            Default Outgoing
          </button>
          {account.bcc_address && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Icon icon="solar:copy-bold" size={12} />
              BCC: {account.bcc_address}
            </div>
          )}
          {account.footer_included && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Icon icon="solar:text-field-bold" size={12} />
              Footer included
            </div>
          )}
        </div>

        {/* Test result */}
        {testResult && (
          <div className={`p-2 rounded text-xs ${
            testResult.success
              ? "bg-success/10 text-success-dark"
              : "bg-destructive/10 text-destructive"
          }`}>
            {testResult.message}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="px-4 py-2 border-t flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onTestConnection(account.id)}
          disabled={testing || !account.smtp_server}
        >
          {testing ? (
            <Icon icon="solar:refresh-bold" size={14} className="mr-1 animate-spin" />
          ) : (
            <Icon icon="solar:plug-circle-bold" size={14} className="mr-1" />
          )}
          Test Connection
        </Button>

        {showTestInput ? (
          <div className="flex items-center gap-2 flex-1">
            <input
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="test@example.com"
              className="px-2 py-1 rounded border bg-background text-sm flex-1"
            />
            <Button
              size="sm"
              onClick={() => {
                if (testEmail) {
                  onSendTestEmail(account.id, testEmail);
                  setShowTestInput(false);
                  setTestEmail("");
                }
              }}
              disabled={!testEmail || testing}
            >
              Send
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setShowTestInput(false)}>
              Cancel
            </Button>
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowTestInput(true)}
            disabled={!account.enable_outgoing}
          >
            <Icon icon="solar:mail-bold" size={14} className="mr-1" />
            Send Test Email
          </Button>
        )}
      </div>
    </div>
  );
}

// ── Account Form Dialog ────────────────────────────────────────

interface AccountFormDialogProps {
  account: EmailAccount | null;
  onClose: () => void;
  onSave: () => void;
}

function AccountFormDialog({ account, onClose, onSave }: AccountFormDialogProps) {
  const [form, setForm] = useState({
    email_account_name: account?.email_account_name || "",
    email_id: account?.email_id || "",
    email_sender_name: account?.email_sender_name || "",
    smtp_server: account?.smtp_server || "",
    smtp_port: account?.smtp_port || 587,
    smtp_username: account?.smtp_username || "",
    smtp_password: account?.smtp_password || "",
    use_tls: account?.use_tls ?? true,
    use_ssl: account?.use_ssl ?? false,
    default_outgoing: account?.default_outgoing ?? false,
    enable_outgoing: account?.enable_outgoing ?? true,
    bcc_address: account?.bcc_address || "",
    footer: account?.footer || "",
    footer_included: account?.footer_included ?? false,
  });
  const [saving, setSaving] = useState(false);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      if (account) {
        await apiClient.put({
          url: `/roles/email-accounts/${account.id}/`,
          data: form,
        });
      } else {
        await apiClient.post({
          url: "/roles/email-accounts/",
          data: form,
        });
      }
      onSave();
    } catch {
      // silently fail
    } finally {
      setSaving(false);
    }
  }, [account, form, onSave]);

  const update = (field: string, value: any) => setForm((prev) => ({ ...prev, [field]: value }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <Text variant="subTitle1">
            {account ? "Edit Email Account" : "Add Email Account"}
          </Text>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <Icon icon="solar:close-bold" size={20} />
          </Button>
        </div>

        {/* Form */}
        <ScrollArea className="max-h-[calc(90vh-140px)]">
          <div className="px-6 py-4 space-y-4">
            {/* Account Name */}
            <div>
              <label className="block text-sm font-medium mb-1">Account Name *</label>
              <input
                type="text"
                value={form.email_account_name}
                onChange={(e) => update("email_account_name", e.target.value)}
                placeholder="Healthcare Notifications"
                className="w-full px-3 py-2 rounded-md border bg-background text-sm"
              />
            </div>

            {/* Email */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Email Address *</label>
                <input
                  type="email"
                  value={form.email_id}
                  onChange={(e) => update("email_id", e.target.value)}
                  placeholder="noreply@hospital.local"
                  className="w-full px-3 py-2 rounded-md border bg-background text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Sender Name</label>
                <input
                  type="text"
                  value={form.email_sender_name}
                  onChange={(e) => update("email_sender_name", e.target.value)}
                  placeholder="Healthcare System"
                  className="w-full px-3 py-2 rounded-md border bg-background text-sm"
                />
              </div>
            </div>

            <Separator />

            {/* SMTP */}
            <Text variant="subTitle2" className="flex items-center gap-2">
              <Icon icon="solar:server-bold" size={16} />
              SMTP Settings
            </Text>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="block text-sm font-medium mb-1">SMTP Server</label>
                <input
                  type="text"
                  value={form.smtp_server}
                  onChange={(e) => update("smtp_server", e.target.value)}
                  placeholder="smtp.gmail.com (blank = console)"
                  className="w-full px-3 py-2 rounded-md border bg-background text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Port</label>
                <input
                  type="number"
                  value={form.smtp_port}
                  onChange={(e) => update("smtp_port", parseInt(e.target.value) || 587)}
                  className="w-full px-3 py-2 rounded-md border bg-background text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Username</label>
                <input
                  type="text"
                  value={form.smtp_username}
                  onChange={(e) => update("smtp_username", e.target.value)}
                  placeholder="(optional)"
                  className="w-full px-3 py-2 rounded-md border bg-background text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Password</label>
                <input
                  type="password"
                  value={form.smtp_password}
                  onChange={(e) => update("smtp_password", e.target.value)}
                  placeholder="(optional)"
                  className="w-full px-3 py-2 rounded-md border bg-background text-sm"
                />
              </div>
            </div>

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.use_tls}
                  onChange={(e) => {
                    update("use_tls", e.target.checked);
                    if (e.target.checked) update("use_ssl", false);
                  }}
                  className="rounded"
                />
                <Text variant="caption">STARTTLS (port 587)</Text>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.use_ssl}
                  onChange={(e) => {
                    update("use_ssl", e.target.checked);
                    if (e.target.checked) update("use_tls", false);
                  }}
                  className="rounded"
                />
                <Text variant="caption">SSL (port 465)</Text>
              </label>
            </div>

            <Separator />

            {/* Options */}
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.enable_outgoing}
                  onChange={(e) => update("enable_outgoing", e.target.checked)}
                  className="rounded"
                />
                <Text variant="caption">Enable outgoing</Text>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.default_outgoing}
                  onChange={(e) => update("default_outgoing", e.target.checked)}
                  className="rounded"
                />
                <Text variant="caption">Default outgoing</Text>
              </label>
            </div>

            {/* BCC */}
            <div>
              <label className="block text-sm font-medium mb-1">BCC Address</label>
              <input
                type="email"
                value={form.bcc_address}
                onChange={(e) => update("bcc_address", e.target.value)}
                placeholder="(optional)"
                className="w-full px-3 py-2 rounded-md border bg-background text-sm"
              />
            </div>

            {/* Footer */}
            <div>
              <label className="block text-sm font-medium mb-1">Email Footer (HTML)</label>
              <textarea
                value={form.footer}
                onChange={(e) => update("footer", e.target.value)}
                placeholder="<p>This is an automated notification.</p>"
                rows={3}
                className="w-full px-3 py-2 rounded-md border bg-background text-sm font-mono"
              />
              <label className="flex items-center gap-2 cursor-pointer mt-1">
                <input
                  type="checkbox"
                  checked={form.footer_included}
                  onChange={(e) => update("footer_included", e.target.checked)}
                  className="rounded"
                />
                <Text variant="caption">Include footer in outgoing emails</Text>
              </label>
            </div>
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="px-6 py-4 border-t flex items-center justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !form.email_account_name || !form.email_id}>
            {saving ? (
              <Icon icon="solar:refresh-bold" size={16} className="mr-1 animate-spin" />
            ) : (
              <Icon icon="solar:check-read-bold" size={16} className="mr-1" />
            )}
            {account ? "Save Changes" : "Create Account"}
          </Button>
        </div>
      </div>
    </div>
  );
}
