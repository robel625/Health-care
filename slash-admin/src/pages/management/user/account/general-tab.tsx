import { UploadAvatar } from "@/components/upload";
import { useUserInfo, useUserActions } from "@/store/userStore";
import apiClient from "@/api/apiClient";
import { Button } from "@/ui/button";
import { Card, CardContent } from "@/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/ui/form";
import { Input } from "@/ui/input";
import { Switch } from "@/ui/switch";
import { Text } from "@/ui/typography";
import { useForm } from "react-hook-form";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

type FieldType = {
	username?: string;
	email?: string;
	first_name?: string;
	last_name?: string;
};

export default function GeneralTab() {
	const userInfo = useUserInfo();
	const { setUserInfo } = useUserActions();
	const [loading, setLoading] = useState(false);

	const form = useForm<FieldType>({
		defaultValues: {
			username: userInfo?.username || "",
			email: userInfo?.email || "",
			first_name: userInfo?.first_name || "",
			last_name: userInfo?.last_name || "",
		},
	});

	const handleClick = async (values: FieldType) => {
		setLoading(true);
		try {
			// Update profile via Django backend
			const updated = await apiClient.put<any>({
				url: "/auth/profile/",
				data: {
					first_name: values.first_name,
					last_name: values.last_name,
					email: values.email,
				},
			});

			// Update local store with new data
			setUserInfo({
				...userInfo,
				...updated,
			} as any);

			toast.success("Profile updated successfully!", {
				position: "top-center",
			});
		} catch (err: any) {
			const msg = err?.response?.data?.detail
				|| err?.response?.data?.error
				|| err?.message
				|| "Failed to update profile";
			toast.error(msg, {
				position: "top-center",
			});
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
			<div className="col-span-1">
				<Card className="flex-col items-center px-6! pb-10! pt-20!">
					<UploadAvatar defaultAvatar={userInfo?.avatar} />

					<div className="flex items-center py-6 gap-2 w-40">
						<Text variant="body1">Public Profile</Text>
						<Switch defaultChecked={userInfo?.is_active !== false} disabled />
					</div>
				</Card>
			</div>
			<div className="col-span-1">
				<Card>
					<CardContent>
						<Form {...form}>
							<form onSubmit={form.handleSubmit(handleClick)}>
								<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
									<FormField
										control={form.control}
										name="username"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Username</FormLabel>
												<FormControl>
													<Input {...field} disabled />
												</FormControl>
											</FormItem>
										)}
									/>
									<FormField
										control={form.control}
										name="email"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Email</FormLabel>
												<FormControl>
													<Input type="email" {...field} />
												</FormControl>
											</FormItem>
										)}
									/>
									<FormField
										control={form.control}
										name="first_name"
										render={({ field }) => (
											<FormItem>
												<FormLabel>First Name</FormLabel>
												<FormControl>
													<Input {...field} />
												</FormControl>
											</FormItem>
										)}
									/>
									<FormField
										control={form.control}
										name="last_name"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Last Name</FormLabel>
												<FormControl>
													<Input {...field} />
												</FormControl>
											</FormItem>
										)}
									/>
								</div>
								<div className="mt-4 flex justify-end">
									<Button type="submit" disabled={loading}>
										{loading && <Loader2 className="animate-spin mr-2" />}
										Save Changes
									</Button>
								</div>
							</form>
						</Form>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
