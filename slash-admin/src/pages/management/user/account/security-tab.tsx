import { Icon } from "@/components/icon";
import { useUserInfo } from "@/store/userStore";
import apiClient from "@/api/apiClient";
import { Button } from "@/ui/button";
import { Badge } from "@/ui/badge";
import { Separator } from "@/ui/separator";
import { Text } from "@/ui/typography";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/ui/form";
import { Input } from "@/ui/input";

type FieldType = {
  oldPassword: string;
  newPassword: string;
  confirmPassword: string;
};

export default function SecurityTab() {
  const userInfo = useUserInfo();
  const [loading, setLoading] = useState(false);

  const form = useForm<FieldType>({
    defaultValues: { oldPassword: "", newPassword: "", confirmPassword: "" },
  });

  const handleSubmit = useCallback(async (values: FieldType) => {
    setLoading(true);
    try {
      await apiClient.post({
        url: "/auth/change-password/",
        data: { old_password: values.oldPassword, new_password: values.newPassword },
      });
      toast.success("Password changed successfully!", { position: "top-center" });
      form.reset();
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.response?.data?.error || err?.response?.data?.old_password || "Failed to change password";
      toast.error(msg, { position: "top-center" });
    } finally {
      setLoading(false);
    }
  }, [form]);

  const newPassword = form.watch("newPassword");

  // Password strength
  const getStrength = (pwd: string) => {
    let score = 0;
    if (pwd.length >= 8) score++;
    if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) score++;
    if (/\d/.test(pwd)) score++;
    if (/[^a-zA-Z0-9]/.test(pwd)) score++;
    return score;
  };
  const strength = getStrength(newPassword || "");
  const strengthLabels = ["", "Weak", "Fair", "Good", "Strong"];
  const strengthColors = ["", "bg-destructive", "bg-warning", "bg-info", "bg-success"];

  return (
    <div className="space-y-6 max-w-2xl mx-auto p-4">
      {/* Account Status */}
      <div className="border rounded-lg p-4">
        <Text variant="subTitle2" className="flex items-center gap-2 mb-3">
          <Icon icon="solar:shield-check-bold" size={16} />
          Account Status
        </Text>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full ${userInfo?.is_active !== false ? "bg-success" : "bg-destructive"}`} />
            <Text variant="caption">
              {userInfo?.is_active !== false ? "Account Active" : "Account Disabled"}
            </Text>
          </div>
          <div className="flex items-center gap-2">
            <Icon icon="solar:user-bold" size={14} className="text-muted-foreground" />
            <Text variant="caption">
              {(userInfo as any)?.is_superuser ? "Superuser" : userInfo?.is_staff ? "Staff User" : "Regular User"}
            </Text>
          </div>
          <div className="flex items-center gap-2">
            <Icon icon="solar:calendar-bold" size={14} className="text-muted-foreground" />
            <Text variant="caption">
              Joined: {userInfo?.date_joined ? new Date(userInfo.date_joined).toLocaleDateString() : "Unknown"}
            </Text>
          </div>
          <div className="flex items-center gap-2">
            <Icon icon="solar:clock-circle-bold" size={14} className="text-muted-foreground" />
            <Text variant="caption">
              Last login: {(userInfo as any)?.last_login ? new Date((userInfo as any).last_login).toLocaleString() : "Never"}
            </Text>
          </div>
        </div>
      </div>

      <Separator />

      {/* Password Change */}
      <div className="border rounded-lg p-4">
        <Text variant="subTitle2" className="flex items-center gap-2 mb-4">
          <Icon icon="solar:key-bold" size={16} />
          Change Password
        </Text>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="oldPassword"
              rules={{ required: "Current password is required" }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Current Password</FormLabel>
                  <FormControl>
                    <Input type="password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="newPassword"
              rules={{
                required: "New password is required",
                minLength: { value: 6, message: "Password must be at least 6 characters" },
              }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New Password</FormLabel>
                  <FormControl>
                    <Input type="password" {...field} />
                  </FormControl>
                  {/* Strength meter */}
                  {newPassword && (
                    <div className="mt-2 space-y-1">
                      <div className="flex gap-1">
                        {[1, 2, 3, 4].map((i) => (
                          <div
                            key={i}
                            className={`h-1.5 flex-1 rounded-full transition-colors ${
                              i <= strength ? strengthColors[strength] : "bg-muted"
                            }`}
                          />
                        ))}
                      </div>
                      <Text variant="caption" color="secondary">
                        {strengthLabels[strength]} — {strength < 3 ? "Add more character types for a stronger password" : "Strong password"}
                      </Text>
                    </div>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="confirmPassword"
              rules={{
                required: "Please confirm your password",
                validate: (value) => value === form.getValues("newPassword") || "Passwords do not match",
              }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirm New Password</FormLabel>
                  <FormControl>
                    <Input type="password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end">
              <Button type="submit" disabled={loading}>
                {loading && <Icon icon="solar:refresh-bold" size={14} className="mr-1 animate-spin" />}
                Change Password
              </Button>
            </div>
          </form>
        </Form>
      </div>

      <Separator />

      {/* Password requirements */}
      <div className="border rounded-lg p-4">
        <Text variant="subTitle2" className="flex items-center gap-2 mb-3">
          <Icon icon="solar:info-circle-bold" size={16} />
          Password Requirements
        </Text>
        <div className="grid grid-cols-2 gap-2">
          {[
            { met: (newPassword || "").length >= 6, label: "At least 6 characters" },
            { met: /[a-z]/.test(newPassword || "") && /[A-Z]/.test(newPassword || ""), label: "Upper and lowercase letters" },
            { met: /\d/.test(newPassword || ""), label: "At least one number" },
            { met: /[^a-zA-Z0-9]/.test(newPassword || ""), label: "At least one special character" },
          ].map((req) => (
            <div key={req.label} className="flex items-center gap-2">
              <Icon
                icon={req.met ? "solar:check-circle-bold" : "solar:close-circle-bold"}
                size={14}
                className={req.met ? "text-success" : "text-muted-foreground"}
              />
              <Text variant="caption" color={req.met ? "default" : "secondary"}>
                {req.label}
              </Text>
            </div>
          ))}
        </div>
      </div>

      <Separator />

      {/* Roles summary */}
      {userInfo?.roles && userInfo.roles.length > 0 && (
        <div className="border rounded-lg p-4">
          <Text variant="subTitle2" className="flex items-center gap-2 mb-3">
            <Icon icon="solar:shield-user-bold" size={16} />
            Your Roles
          </Text>
          <div className="flex flex-wrap gap-2">
            {userInfo.roles.map((role: any) => (
              <Badge key={typeof role === "string" ? role : role.name} variant="outline">
                {typeof role === "string" ? role : role.name}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
