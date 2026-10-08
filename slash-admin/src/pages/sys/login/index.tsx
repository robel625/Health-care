import LocalePicker from "@/components/locale-picker";
import Logo from "@/components/logo";
import { GLOBAL_CONFIG } from "@/global-config";
import SettingButton from "@/layouts/components/setting-button";
import { useUserToken } from "@/store/userStore";
import { Navigate } from "react-router";
import { Icon } from "@/components/icon";
import eeuLogoImg from "@/assets/images/eeu-logo.png";
import LoginForm from "./login-form";
import MobileForm from "./mobile-form";
import { LoginProvider } from "./providers/login-provider";
import QrCodeFrom from "./qrcode-form";
import RegisterForm from "./register-form";
import ResetForm from "./reset-form";

function LoginPage() {
	const token = useUserToken();

	if (token.accessToken) {
		return <Navigate to={GLOBAL_CONFIG.defaultRoute} replace />;
	}

	return (
		<div className="relative grid min-h-svh lg:grid-cols-12 bg-background selection:bg-emerald-500/20">
			{/* Left Column: Form & Access */}
			<div className="lg:col-span-5 flex flex-col justify-between p-6 sm:p-10 md:p-12 z-10">
				{/* Top Branding */}
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-3">
						<Logo size={42} withBorder />
						<div className="flex flex-col">
							<span className="text-base font-extrabold tracking-tight text-foreground">
								EEU Health Services
							</span>
							<span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
								የኢትዮጵያ ኤሌክትሪክ አገልግሎት
							</span>
						</div>
					</div>

					<div className="flex items-center gap-1">
						<LocalePicker />
						<SettingButton />
					</div>
				</div>

				{/* Middle Login Container */}
				<div className="flex flex-col items-center justify-center my-8">
					<div className="w-full max-w-sm">
						<div className="mb-6 space-y-1.5 text-left">
							<div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 mb-2">
								<span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
								Staff & Occupational Medical Portal
							</div>
							<h1 className="text-2xl font-bold tracking-tight text-foreground">
								Sign In to Medical Console
							</h1>
							<p className="text-xs text-muted-foreground">
								Authorized portal for EEU physicians, nurses, pharmacists, and medical administration.
							</p>
						</div>

						<LoginProvider>
							<LoginForm />
							<MobileForm />
							<QrCodeFrom />
							<RegisterForm />
							<ResetForm />
						</LoginProvider>

						{/* Quick Access Credential Hint */}
						<div className="mt-6 p-3 rounded-xl bg-muted/50 border border-border/60 text-xs text-muted-foreground flex items-center justify-between">
							<div className="flex items-center gap-2">
								<Icon icon="solar:shield-keyhole-bold-duotone" size={18} className="text-emerald-600" />
								<span>Default Administrator:</span>
							</div>
							<code className="font-mono text-foreground font-semibold px-2 py-0.5 rounded bg-background border text-[11px]">
								admin / admin123
							</code>
						</div>
					</div>
				</div>

				{/* Bottom Footer */}
				<div className="text-xs text-muted-foreground/80 flex flex-col sm:flex-row items-center justify-between gap-2 pt-4 border-t border-border/40">
					<span>© 2026 Ethiopian Electric Utility (EEU)</span>
					<span className="text-[11px]">Health Services Directorate • Addis Ababa</span>
				</div>
			</div>

			{/* Right Column: EEU Health Department Showcase */}
			<div className="relative hidden lg:col-span-7 lg:flex flex-col justify-between overflow-hidden bg-gradient-to-br from-[#0c2a11] via-[#14421b] to-[#081b0c] p-12 text-white">
				{/* Ambient Glows & Vector Accents */}
				<div className="absolute -right-24 -top-24 w-96 h-96 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />
				<div className="absolute -left-20 bottom-10 w-96 h-96 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />
				<div className="absolute inset-0 bg-[radial-gradient(#ffffff0a_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none" />

				{/* Header badge */}
				<div className="relative z-10 flex items-center justify-between">
					<div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-xs font-semibold text-emerald-200">
						<Icon icon="solar:bolt-bold" size={14} className="text-amber-400" />
						Powering Occupational Health & Wellness
					</div>
					<span className="text-xs text-white/60 tracking-widest font-mono">EEU-HEALTH-SYSTEM-v1.0</span>
				</div>

				{/* Center Brand Identity */}
				<div className="relative z-10 my-auto py-8 max-w-xl">
					<div className="flex items-center gap-5 mb-6">
						<div className="p-2 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/25 shadow-2xl shrink-0">
							<img
								src={eeuLogoImg}
								alt="EEU Logo"
								className="w-20 h-20 rounded-full object-contain aspect-square drop-shadow-md"
							/>
						</div>
						<div>
							<h2 className="text-2xl font-black tracking-tight text-white font-sans">
								የኢትዮጵያ ኤሌክትሪክ አገልግሎት
							</h2>
							<h3 className="text-lg font-bold text-amber-300/95 tracking-wide">
								Ethiopian Electric Utility (EEU)
							</h3>
							<p className="text-xs text-emerald-100/80 font-medium">
								Health Services Directorate • የጤና አገልግሎት ዳይሬክቶሬት
							</p>
						</div>
					</div>

					<p className="text-sm text-emerald-50/90 leading-relaxed mb-8">
						Dedicated clinical information system managing occupational health, field personnel screening, outpatient clinical consultations, clinical pathology lab, and pharmaceutical distribution across all EEU regions.
					</p>

					{/* 4 Feature Pillars */}
					<div className="grid grid-cols-2 gap-3.5">
						<div className="p-3.5 rounded-xl bg-white/10 hover:bg-white/15 backdrop-blur-md border border-white/15 transition-all">
							<div className="flex items-center gap-2.5 mb-1.5">
								<div className="p-1.5 rounded-lg bg-amber-400/20 text-amber-300">
									<Icon icon="solar:bolt-circle-bold-duotone" size={20} />
								</div>
								<h4 className="text-xs font-bold text-white">Occupational Safety</h4>
							</div>
							<p className="text-[11px] text-emerald-100/75 leading-relaxed">
								Specialized surveillance for electrical linesmen, substation crews, and power technicians.
							</p>
						</div>

						<div className="p-3.5 rounded-xl bg-white/10 hover:bg-white/15 backdrop-blur-md border border-white/15 transition-all">
							<div className="flex items-center gap-2.5 mb-1.5">
								<div className="p-1.5 rounded-lg bg-emerald-400/20 text-emerald-300">
									<Icon icon="solar:stethoscope-bold-duotone" size={20} />
								</div>
								<h4 className="text-xs font-bold text-white">Clinical Encounters</h4>
							</div>
							<p className="text-[11px] text-emerald-100/75 leading-relaxed">
								Full outpatient OPD, digital diagnosis, clinical vitals, and physician appointment booking.
							</p>
						</div>

						<div className="p-3.5 rounded-xl bg-white/10 hover:bg-white/15 backdrop-blur-md border border-white/15 transition-all">
							<div className="flex items-center gap-2.5 mb-1.5">
								<div className="p-1.5 rounded-lg bg-cyan-400/20 text-cyan-300">
									<Icon icon="solar:test-tube-bold-duotone" size={20} />
								</div>
								<h4 className="text-xs font-bold text-white">Diagnostics & Lab</h4>
							</div>
							<p className="text-[11px] text-emerald-100/75 leading-relaxed">
								Automated lab test pipelines, abnormal range flags, doctor approval, and real-time alerts.
							</p>
						</div>

						<div className="p-3.5 rounded-xl bg-white/10 hover:bg-white/15 backdrop-blur-md border border-white/15 transition-all">
							<div className="flex items-center gap-2.5 mb-1.5">
								<div className="p-1.5 rounded-lg bg-rose-400/20 text-rose-300">
									<Icon icon="solar:pill-bold-duotone" size={20} />
								</div>
								<h4 className="text-xs font-bold text-white">Staff Pharmacy</h4>
							</div>
							<p className="text-[11px] text-emerald-100/75 leading-relaxed">
								EEU formulary catalog, outpatient dispensing receipts, and centralized stock balances.
							</p>
						</div>
					</div>
				</div>

				{/* Bottom Quality Footnote */}
				<div className="relative z-10 flex items-center justify-between text-xs text-white/50 pt-4 border-t border-white/10">
					<span>Serving EEU Staff & Dependents Nationwide</span>
					<span className="flex items-center gap-1.5 text-emerald-300">
						<span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
						Systems Operational
					</span>
				</div>
			</div>
		</div>
	);
}

export default LoginPage;
