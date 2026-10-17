import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import userService from "@/api/services/userService";
import { Icon } from "@/components/icon";
import { Button } from "@/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/ui/form";
import { Input } from "@/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/ui/tabs";
import { ReturnButton } from "./components/ReturnButton";
import { LoginStateEnum, useLoginStateContext } from "./providers/login-provider";

interface RequestCodeFormValues {
	identifier: string;
}

interface ConfirmResetFormValues {
	code: string;
	new_password: string;
	confirm_password: string;
}

export function ResetForm() {
	const { t } = useTranslation();
	const { loginState, backToLogin } = useLoginStateContext();

	// Step 1 = Request code (via Email or Phone), Step 2 = Enter code & new password
	const [step, setStep] = useState<1 | 2>(1);
	const [channelType, setChannelType] = useState<"email" | "phone">("email");
	const [loading, setLoading] = useState(false);
	const [sessionToken, setSessionToken] = useState("");
	const [targetMasked, setTargetMasked] = useState("");
	const [debugCode, setDebugCode] = useState<string | null>(null);
	const [sentIdentifier, setSentIdentifier] = useState("");

	const requestForm = useForm<RequestCodeFormValues>({
		defaultValues: {
			identifier: "",
		},
	});

	const confirmForm = useForm<ConfirmResetFormValues>({
		defaultValues: {
			code: "",
			new_password: "",
			confirm_password: "",
		},
	});

	if (loginState !== LoginStateEnum.RESET_PASSWORD) return null;

	// Reset state when navigating back
	const handleBackToLogin = () => {
		setStep(1);
		requestForm.reset();
		confirmForm.reset();
		setDebugCode(null);
		backToLogin();
	};

	// Step 1: Request verification code via Email OR Phone
	const handleRequestCode = async (values: RequestCodeFormValues) => {
		const rawInput = values.identifier.trim();
		if (!rawInput) {
			toast.error(
				channelType === "email"
					? "Please enter your email address"
					: "Please enter your phone number"
			);
			return;
		}

		setLoading(true);
		try {
			const res = await userService.forgotPassword({ identifier: rawInput });
			if (res && res.success) {
				setSessionToken(res.token);
				setTargetMasked(res.target_masked || rawInput);
				setSentIdentifier(rawInput);
				setDebugCode(res.debug_code || null);
				setStep(2);
				toast.success(res.message || "Verification code dispatched successfully!");
			} else {
				toast.error(res?.message || "Failed to send verification code");
			}
		} catch (err: any) {
			const detail = err?.response?.data?.detail || err?.message || "User account not found";
			toast.error(detail);
		} finally {
			setLoading(false);
		}
	};

	// Resend verification code
	const handleResendCode = async () => {
		if (!sentIdentifier) return;
		setLoading(true);
		try {
			const res = await userService.forgotPassword({ identifier: sentIdentifier });
			if (res && res.success) {
				setSessionToken(res.token);
				setDebugCode(res.debug_code || null);
				toast.success("A new verification code has been sent!");
			}
		} catch (err: any) {
			toast.error(err?.response?.data?.detail || "Could not resend code");
		} finally {
			setLoading(false);
		}
	};

	// Step 2: Confirm OTP & set new password
	const handleConfirmReset = async (values: ConfirmResetFormValues) => {
		const code = values.code.trim();
		const newPassword = values.new_password;
		const confirmPassword = values.confirm_password;

		if (!code) {
			toast.error("Please enter the 6-digit verification code");
			return;
		}

		if (!newPassword || newPassword.length < 6) {
			toast.error("New password must be at least 6 characters");
			return;
		}

		if (newPassword !== confirmPassword) {
			toast.error("The passwords do not match");
			return;
		}

		setLoading(true);
		try {
			const res = await userService.resetPassword({
				token: sessionToken,
				identifier: sentIdentifier,
				code,
				new_password: newPassword,
			});

			if (res && res.success) {
				toast.success(res.message || "Password reset successfully! Please log in.");
				handleBackToLogin();
			} else {
				toast.error(res?.message || "Failed to reset password");
			}
		} catch (err: any) {
			const detail = err?.response?.data?.detail || err?.message || "Failed to reset password";
			toast.error(detail);
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="space-y-6">
			{/* Top Icon */}
			<div className="flex justify-center">
				<div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
					{step === 1 ? (
						<Icon icon="solar:shield-keyhole-bold-duotone" size={40} />
					) : (
						<Icon icon="solar:lock-password-bold-duotone" size={40} />
					)}
				</div>
			</div>

			{/* ==================== STEP 1: Request Code ==================== */}
			{step === 1 && (
				<div className="space-y-4">
					<div className="flex flex-col items-center gap-1.5 text-center">
						<h1 className="text-2xl font-bold tracking-tight">
							{t("sys.login.forgetFormTitle", "Reset Password")}
						</h1>
						<p className="text-xs text-muted-foreground max-w-xs">
							Enter your registered email address or phone number to receive a 6-digit verification code.
						</p>
					</div>

					{/* Channel Picker Tabs: Email vs Phone */}
					<div className="flex justify-center pt-1">
						<Tabs
							value={channelType}
							onValueChange={(val) => {
								setChannelType(val as "email" | "phone");
								requestForm.setValue("identifier", "");
							}}
							className="w-full"
						>
							<TabsList className="grid grid-cols-2 w-full h-10 p-1 bg-muted/70 rounded-xl">
								<TabsTrigger value="email" className="text-xs font-semibold flex items-center gap-2">
									<Icon icon="solar:letter-bold-duotone" size={16} />
									{t("sys.login.email", "Email Address")}
								</TabsTrigger>
								<TabsTrigger value="phone" className="text-xs font-semibold flex items-center gap-2">
									<Icon icon="solar:phone-calling-bold-duotone" size={16} />
									{t("sys.login.mobile", "Phone Number")}
								</TabsTrigger>
							</TabsList>
						</Tabs>
					</div>

					<Form {...requestForm}>
						<form onSubmit={requestForm.handleSubmit(handleRequestCode)} className="space-y-4">
							<FormField
								control={requestForm.control}
								name="identifier"
								rules={{
									required:
										channelType === "email"
											? "Email address is required"
											: "Phone number is required",
								}}
								render={({ field }) => (
									<FormItem>
										<FormLabel className="text-xs font-medium">
											{channelType === "email" ? "Registered Email" : "Registered Phone Number"}
										</FormLabel>
										<FormControl>
											<div className="relative">
												<Input
													placeholder={
														channelType === "email"
															? "e.g. admin@erp.com"
															: "e.g. +251911000000 or 0911000000"
													}
													type={channelType === "email" ? "email" : "tel"}
													autoComplete={channelType === "email" ? "email" : "tel"}
													className="h-10"
													{...field}
												/>
											</div>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>

							<Button type="submit" disabled={loading} className="w-full h-10 font-medium">
								{loading && <Loader2 className="animate-spin mr-2 h-4 w-4" />}
								Send Verification Code
							</Button>

							<ReturnButton onClick={handleBackToLogin} />
						</form>
					</Form>
				</div>
			)}

			{/* ==================== STEP 2: Verify OTP & New Password ==================== */}
			{step === 2 && (
				<div className="space-y-4">
					<div className="flex flex-col items-center gap-1.5 text-center">
						<h1 className="text-2xl font-bold tracking-tight">Set New Password</h1>
						<p className="text-xs text-muted-foreground max-w-xs">
							Enter the 6-digit verification code sent to{" "}
							<span className="font-semibold text-foreground">{targetMasked}</span>.
						</p>
					</div>

					{/* Development hint helper if code is returned in debug mode */}
					{debugCode && (
						<div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-400 flex items-center justify-between">
							<div className="flex items-center gap-2">
								<Icon icon="solar:info-circle-bold" size={16} />
								<span>Dev / Local Code: <strong className="font-mono">{debugCode}</strong></span>
							</div>
							<Button
								type="button"
								variant="ghost"
								size="sm"
								className="h-7 px-2 text-[11px] font-semibold text-amber-700 dark:text-amber-300"
								onClick={() => confirmForm.setValue("code", debugCode)}
							>
								Fill Code
							</Button>
						</div>
					)}

					<Form {...confirmForm}>
						<form onSubmit={confirmForm.handleSubmit(handleConfirmReset)} className="space-y-3.5">
							{/* Code */}
							<FormField
								control={confirmForm.control}
								name="code"
								rules={{ required: "Verification code is required" }}
								render={({ field }) => (
									<FormItem>
										<FormLabel className="text-xs font-medium">6-Digit Verification Code</FormLabel>
										<FormControl>
											<Input
												placeholder="••••••"
												maxLength={10}
												className="h-10 text-center font-mono text-lg tracking-widest uppercase font-semibold"
												{...field}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>

							{/* New Password */}
							<FormField
								control={confirmForm.control}
								name="new_password"
								rules={{
									required: "New password is required",
									minLength: { value: 6, message: "Minimum 6 characters" },
								}}
								render={({ field }) => (
									<FormItem>
										<FormLabel className="text-xs font-medium">New Password</FormLabel>
										<FormControl>
											<Input
												type="password"
												placeholder="••••••••"
												className="h-10"
												{...field}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>

							{/* Confirm New Password */}
							<FormField
								control={confirmForm.control}
								name="confirm_password"
								rules={{ required: "Please confirm your password" }}
								render={({ field }) => (
									<FormItem>
										<FormLabel className="text-xs font-medium">Confirm New Password</FormLabel>
										<FormControl>
											<Input
												type="password"
												placeholder="••••••••"
												className="h-10"
												{...field}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>

							{/* Submit Button */}
							<Button type="submit" disabled={loading} className="w-full h-10 font-medium">
								{loading && <Loader2 className="animate-spin mr-2 h-4 w-4" />}
								Reset & Save Password
							</Button>

							{/* Resend and Step 1 Back Buttons */}
							<div className="flex items-center justify-between pt-1 text-xs">
								<button
									type="button"
									onClick={() => setStep(1)}
									className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
								>
									Change Email / Phone
								</button>
								<button
									type="button"
									onClick={handleResendCode}
									disabled={loading}
									className="text-emerald-600 dark:text-emerald-400 hover:underline font-semibold cursor-pointer"
								>
									Resend Code
								</button>
							</div>

							<ReturnButton onClick={handleBackToLogin} />
						</form>
					</Form>
				</div>
			)}
		</div>
	);
}

export default ResetForm;
