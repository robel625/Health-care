import bannerImage from "@/assets/images/background/banner-1.png";
import { Icon } from "@/components/icon";
import { useUserInfo } from "@/store/userStore";
import { themeVars } from "@/theme/theme.css";
import { Avatar, AvatarFallback, AvatarImage } from "@/ui/avatar";
import { Badge } from "@/ui/badge";
import { Separator } from "@/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/ui/tabs";
import { Text, Title } from "@/ui/typography";
import type { CSSProperties } from "react";
import ProfileTab from "./profile-tab";
import GeneralTab from "../account/general-tab";
import SecurityTab from "../account/security-tab";
import NotificationsTab from "../account/notifications-tab";

function UserProfile() {
  const userInfo = useUserInfo();
  const username = userInfo?.username || "User";
  const email = userInfo?.email || "";
  const firstName = userInfo?.first_name || "";
  const lastName = userInfo?.last_name || "";
  const avatar = userInfo?.avatar || "";
  const isStaff = userInfo?.is_staff || false;
  const isSuperuser = (userInfo as any)?.is_superuser || false;
  const roles = userInfo?.roles || [];
  const permissions = userInfo?.permissions || [];
  const lastLogin = (userInfo as any)?.last_login || "";

  const displayName = [firstName, lastName].filter(Boolean).join(" ") || username;

  const bgStyle: CSSProperties = {
    position: "absolute",
    inset: 0,
    background: `url(${bannerImage})`,
    backgroundSize: "cover",
    backgroundPosition: "50%",
    backgroundRepeat: "no-repeat",
  };

  return (
    <Tabs defaultValue="profile" className="w-full">
      {/* Header with banner and avatar */}
      <div className="relative flex flex-col justify-center items-center gap-4 p-4">
        <div style={bgStyle} className="h-full w-full z-1" />
        <div className="flex flex-col items-center justify-center gap-3 z-2">
          <Avatar className="h-24 w-24 ring-4 ring-background">
            {avatar ? <AvatarImage src={avatar} className="rounded-full" /> : null}
            <AvatarFallback className="text-2xl font-bold bg-primary/10 text-primary">
              {(displayName?.[0] || "U").toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col items-center gap-1">
            <div className="flex items-center gap-2">
              <Title as="h5" className="text-xl">{displayName}</Title>
              <Icon icon="heroicons:check-badge-solid" size={20} color={themeVars.colors.palette.primary.default} />
            </div>
            <Text variant="body2" color="secondary">{email}</Text>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant={isStaff ? "default" : "secondary"}>
                {isSuperuser ? "Superuser" : isStaff ? "Staff" : "User"}
              </Badge>
              {roles.slice(0, 3).map((role: any) => (
                <Badge key={typeof role === "string" ? role : role.name} variant="outline" className="text-[10px]">
                  {typeof role === "string" ? role : role.name}
                </Badge>
              ))}
              {roles.length > 3 && (
                <Badge variant="secondary" className="text-[10px]">+{roles.length - 3}</Badge>
              )}
            </div>
          </div>
        </div>

        {/* Quick stats */}
        <div className="z-2 flex items-center gap-6 text-center">
          <div>
            <Text variant="subTitle2" className="text-lg font-bold">{permissions.length}</Text>
            <Text variant="caption" color="secondary">Permissions</Text>
          </div>
          <Separator orientation="vertical" className="h-8" />
          <div>
            <Text variant="subTitle2" className="text-lg font-bold">{roles.length}</Text>
            <Text variant="caption" color="secondary">Roles</Text>
          </div>
          <Separator orientation="vertical" className="h-8" />
          <div>
            <Text variant="subTitle2" className="text-lg font-bold">
              {lastLogin ? new Date(lastLogin).toLocaleDateString() : "Never"}
            </Text>
            <Text variant="caption" color="secondary">Last Login</Text>
          </div>
        </div>

        {/* Tabs */}
        <TabsList className="z-5">
          <TabsTrigger value="profile">
            <Icon icon="solar:user-id-bold" size={18} className="mr-1.5" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="account">
            <Icon icon="solar:settings-bold" size={18} className="mr-1.5" />
            Account
          </TabsTrigger>
          <TabsTrigger value="security">
            <Icon icon="solar:lock-bold" size={18} className="mr-1.5" />
            Security
          </TabsTrigger>
          <TabsTrigger value="notifications">
            <Icon icon="solar:bell-bold" size={18} className="mr-1.5" />
            Notifications
          </TabsTrigger>
        </TabsList>
      </div>

      {/* Tab Content */}
      <TabsContent value="profile">
        <ProfileTab />
      </TabsContent>
      <TabsContent value="account">
        <GeneralTab />
      </TabsContent>
      <TabsContent value="security">
        <SecurityTab />
      </TabsContent>
      <TabsContent value="notifications">
        <NotificationsTab />
      </TabsContent>
    </Tabs>
  );
}

export default UserProfile;
