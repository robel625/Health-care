import { Icon } from "@/components/icon";
import { useUserInfo } from "@/store/userStore";
import { Badge } from "@/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/card";
import { Text } from "@/ui/typography";

export default function ProfileTab() {
	const userInfo = useUserInfo();
	const username = userInfo?.username || "User";
	const email = userInfo?.email || "";
	const firstName = userInfo?.first_name || "";
	const lastName = userInfo?.last_name || "";
	const isStaff = userInfo?.is_staff || false;
	const dateJoined = userInfo?.date_joined || "";

	const displayName = [firstName, lastName].filter(Boolean).join(" ") || username;

	const AboutItems = [
		{
			icon: <Icon icon="fa-solid:user" size={18} />,
			label: "Full Name",
			val: displayName,
		},
		{
			icon: <Icon icon="eos-icons:role-binding" size={18} />,
			label: "Role",
			val: isStaff ? "Administrator" : "User",
		},
		{
			icon: <Icon icon="ic:baseline-email" size={18} />,
			label: "Email",
			val: email,
		},
		{
			icon: <Icon icon="ph:phone-fill" size={18} />,
			label: "Username",
			val: username,
		},
		{
			icon: <Icon icon="ion:language" size={18} />,
			label: "Language",
			val: "English",
		},
		{
			icon: <Icon icon="tabler:calendar-filled" size={18} />,
			label: "Joined",
			val: dateJoined ? new Date(dateJoined).toLocaleDateString() : "N/A",
		},
	];

	return (
		<div className="flex flex-col gap-4">
			<div className="grid grid-cols-1 gap-4 md:grid-cols-3">
				<Card className="col-span-1">
					<CardHeader>
						<CardTitle>About</CardTitle>
						<CardDescription>User profile information from the Healthcare system</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="flex flex-col gap-4">
							{AboutItems.map((item) => (
								<div className="flex" key={item.label}>
									<div className="mr-2">{item.icon}</div>
									<div className="mr-2">{item.label}:</div>
									<div className="opacity-50">{item.val}</div>
								</div>
							))}
						</div>
					</CardContent>
				</Card>

				<Card className="col-span-1 md:col-span-2">
					<CardHeader>
						<CardTitle>Account Details</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
							<div className="flex flex-col gap-2 p-4 rounded-lg bg-bg-neutral">
								<div className="flex items-center gap-2">
									<Icon icon="solar:shield-bold" size={20} className="text-green-500" />
									<Text variant="body2" className="font-semibold">Account Status</Text>
								</div>
								<Badge variant={userInfo?.is_active !== false ? "success" : "error"}>
									{userInfo?.is_active !== false ? "Active" : "Inactive"}
								</Badge>
							</div>
							<div className="flex flex-col gap-2 p-4 rounded-lg bg-bg-neutral">
								<div className="flex items-center gap-2">
									<Icon icon="solar:USER-circle-bold" size={20} className="text-blue-500" />
									<Text variant="body2" className="font-semibold">Account Type</Text>
								</div>
								<Badge variant={isStaff ? "info" : "default"}>
									{isStaff ? "Staff" : "Regular User"}
								</Badge>
							</div>
							<div className="flex flex-col gap-2 p-4 rounded-lg bg-bg-neutral">
								<div className="flex items-center gap-2">
									<Icon icon="solar:calendar-bold" size={20} className="text-purple-500" />
									<Text variant="body2" className="font-semibold">User ID</Text>
								</div>
								<Text variant="body2" className="text-text-secondary">
									{String(userInfo?.id || "N/A")}
								</Text>
							</div>
							<div className="flex flex-col gap-2 p-4 rounded-lg bg-bg-neutral">
								<div className="flex items-center gap-2">
									<Icon icon="solar:clock-circle-bold" size={20} className="text-orange-500" />
									<Text variant="body2" className="font-semibold">Last Updated</Text>
								</div>
								<Text variant="body2" className="text-text-secondary">
									{dateJoined ? new Date(dateJoined).toLocaleString() : "N/A"}
								</Text>
							</div>
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
