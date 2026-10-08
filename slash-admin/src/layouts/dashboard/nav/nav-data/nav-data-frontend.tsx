import { Icon } from "@/components/icon";
import type { NavProps } from "@/components/nav";

export const frontendNavData: NavProps["data"] = [
	{
		name: "Home",
		items: [
			{
				title: "Healthcare Dashboard",
				path: "/healthcare",
				icon: <Icon icon="solar:widget-5-bold-duotone" size={24} />,
			},
			{
				title: "Clinical Guide (OPD)",
				path: "/erp/guide",
				icon: <Icon icon="solar:stethoscope-bold-duotone" size={24} />,
			},
		],
	},
	{
		name: "EEU Occupational Health & Safety",
		defaultOpen: false,
		items: [
			{
				title: "Occupational Command Center",
				path: "/healthcare/occupational/dashboard",
				icon: <Icon icon="solar:shield-warning-bold-duotone" size={24} />,
				auth: ["EEU Workplace Incident:read", "EEU Fitness Evaluation:read"],
			},
			{
				title: "Workplace & Electrical Incidents",
				path: "/healthcare/occupational/incidents",
				icon: <Icon icon="solar:danger-triangle-bold-duotone" size={24} />,
				auth: ["EEU Workplace Incident:read"],
			},
			{
				title: "Lineman Fitness & Clearance",
				path: "/healthcare/occupational/fitness-evaluations",
				icon: <Icon icon="solar:medal-ribbons-star-bold-duotone" size={24} />,
				auth: ["EEU Fitness Evaluation:read"],
			},
			{
				title: "Official Sick Leave Slips",
				path: "/healthcare/occupational/sick-leave-certificates",
				icon: <Icon icon="solar:document-medicine-bold-duotone" size={24} />,
				auth: ["Medical Leave Slip:read"],
			},
			{
				title: "Substation & Truck First-Aid",
				path: "/healthcare/occupational/first-aid-kits",
				icon: <Icon icon="solar:box-minimalistic-bold-duotone" size={24} />,
				auth: ["EEU First Aid Kit:read"],
			},
			{
				title: "EEU Staff & Dependent Registry",
				path: "/healthcare/occupational/staff-registry",
				icon: <Icon icon="solar:user-id-bold-duotone" size={24} />,
				auth: ["Patient:read"],
			},
			{
				title: "Executive Safety & LTI Report",
				path: "/healthcare/occupational/executive-report",
				icon: <Icon icon="solar:chart-square-bold-duotone" size={24} />,
				auth: ["EEU Workplace Incident:read"],
			},
			{
				title: "Substation Emergency SOS",
				path: "/healthcare/occupational/emergency-sos",
				icon: <Icon icon="solar:ambulance-bold-duotone" size={24} />,
				auth: ["Emergency Record:read", "EEU Workplace Incident:read"],
			},
			{
				title: "Hospital Guarantee of Payment",
				path: "/healthcare/occupational/guarantee-of-payment",
				icon: <Icon icon="solar:diploma-verified-bold-duotone" size={24} />,
				auth: ["Healthcare Payment Record:read"],
			},
			{
				title: "Lineman PME Campaigns",
				path: "/healthcare/occupational/pme-campaigns",
				icon: <Icon icon="solar:calendar-date-bold-duotone" size={24} />,
				auth: ["EEU Fitness Evaluation:read"],
			},
			{
				title: "Chemical & SF6 Surveillance",
				path: "/healthcare/occupational/toxic-surveillance",
				icon: <Icon icon="solar:test-tube-bold-duotone" size={24} />,
				auth: ["EEU Workplace Incident:read"],
			},
			{
				title: "Substation Trauma & EHS Guide",
				path: "/healthcare/occupational/guide",
				icon: <Icon icon="solar:book-bookmark-bold-duotone" size={24} />,
			},
		],
	},
	{
		name: "Clinical Operations",
		items: [
			{
				title: "Patients",
				path: "/healthcare/patients",
				icon: <Icon icon="solar:users-group-two-rounded-bold-duotone" size={24} />,
				auth: ["Patient:read"],
			},
			{
				title: "Patient History",
				path: "/healthcare/patient-history",
				icon: <Icon icon="solar:history-bold-duotone" size={24} />,
				auth: ["Patient:read"],
			},
			{
				title: "Practitioners",
				path: "/healthcare/practitioners",
				icon: <Icon icon="solar:stethoscope-bold-duotone" size={24} />,
				auth: ["Healthcare Practitioner:read"],
			},
			{
				title: "Practitioner Schedule",
				path: "/healthcare/practitioners/practitioner-schedule",
				icon: <Icon icon="solar:calendar-date-bold-duotone" size={24} />,
				auth: ["Practitioner Schedule:read"],
			},
			{
				title: "Appointments",
				path: "/healthcare/appointments",
				icon: <Icon icon="solar:calendar-mark-bold-duotone" size={24} />,
				auth: ["Patient Appointment:read"],
			},
			{
				title: "Encounters",
				path: "/healthcare/encounters",
				icon: <Icon icon="solar:notes-bold-duotone" size={24} />,
				auth: ["Patient Encounter:read"],
			},
			{
				title: "Vital Signs",
				path: "/healthcare/vital-signs",
				icon: <Icon icon="solar:heart-pulse-bold-duotone" size={24} />,
				auth: ["Vital Signs:read"],
			},
			{
				title: "Prescriptions",
				path: "/healthcare/prescriptions",
				icon: <Icon icon="solar:document-medicine-bold-duotone" size={24} />,
				auth: ["Drug Prescription:read"],
			},
			{
				title: "Service Requests",
				path: "/healthcare/service-requests",
				icon: <Icon icon="solar:clipboard-list-bold-duotone" size={24} />,
				auth: ["Service Request:read"],
			},
		],
	},
	{
		name: "Diagnostics & Laboratory",
		items: [
			{
				title: "Laboratory",
				path: "/healthcare/lab-dashboard",
				icon: <Icon icon="solar:test-tube-bold-duotone" size={24} />,
				children: [
					{
						title: "Lab Dashboard",
						path: "/healthcare/lab-dashboard",
						auth: ["Lab Test:read"],
					},
					{
						title: "Lab Tests",
						path: "/healthcare/lab-tests",
						auth: ["Lab Test:read"],
					},
					{
						title: "Lab Test Templates",
						path: "/healthcare/lab-test-templates",
						auth: ["Lab Test Template:read"],
					},
					{
						title: "Lab Test UOM",
						path: "/healthcare/lab-test-uoms",
						auth: ["Lab Test UOM:read"],
					},
					{
						title: "Lab Test Samples",
						path: "/healthcare/lab-test-samples",
						auth: ["Lab Test Sample:read"],
					},
					{
						title: "Sample Collections",
						path: "/healthcare/sample-collections",
						auth: ["Sample Collection:read"],
					},
					{
						title: "Observations",
						path: "/healthcare/observations",
						auth: ["Observation:read"],
					},
					{
						title: "Observation Templates",
						path: "/healthcare/observation-templates",
						auth: ["Observation:read"],
					},
					{
						title: "Diagnostic Reports",
						path: "/healthcare/diagnostics/reports",
						auth: ["Diagnostic Report:read"],
					},
				],
			},
		],
	},
	{
		name: "Inpatient & Nursing",
		items: [
			{
				title: "Inpatient Care",
				path: "/healthcare/inpatient",
				icon: <Icon icon="solar:bed-bold-duotone" size={24} />,
				children: [
					{
						title: "Inpatient Records",
						path: "/healthcare/inpatient",
						auth: ["Inpatient Record:read"],
					},
					{
						title: "Emergency Records",
						path: "/healthcare/emergency",
						auth: ["Emergency Record:read"],
					},
					{
						title: "Nursing Tasks",
						path: "/healthcare/nursing",
						auth: ["Nursing Task:read"],
					},
					{
						title: "Discharge Summaries",
						path: "/healthcare/discharge",
						auth: ["Discharge Summary:read"],
					},
				],
			},
		],
	},
	{
		name: "Pharmacy & Formulary",
		items: [
			{
				title: "Pharmacy",
				path: "/healthcare/pharmacy",
				icon: <Icon icon="solar:pill-bold-duotone" size={24} />,
				children: [
					{
						title: "Pharmacy Dashboard",
						path: "/healthcare/pharmacy",
						auth: ["Medication:read"],
					},
					{
						title: "Outpatient Dispensing",
						path: "/healthcare/pharmacy/outpatient",
						auth: ["Medication Request:read"],
					},
					{
						title: "Inpatient Medication Entry",
						path: "/healthcare/pharmacy/medication-entry",
						auth: ["Inpatient Medication Entry:read"],
					},
					{
						title: "Prescriptions Queue",
						path: "/healthcare/pharmacy/medication-requests",
						auth: ["Medication Request:read"],
					},
					{
						title: "Pharmacy Stock",
						path: "/healthcare/pharmacy/stock",
						auth: ["Medication:read"],
					},
					{
						title: "Medication Formulary",
						path: "/healthcare/pharmacy/medications",
						auth: ["Medication:read"],
					},
				],
			},
		],
	},
	{
		name: "Therapy & Rehab",
		items: [
			{
				title: "Therapy Management",
				path: "/healthcare/therapy",
				icon: <Icon icon="solar:wheelchair-bold-duotone" size={24} />,
				children: [
					{
						title: "Therapy Plans & Sessions",
						path: "/healthcare/therapy",
						auth: ["Therapy Plan:read"],
					},
					{
						title: "Treatment Plan Templates",
						path: "/healthcare/treatment-plan-templates",
						auth: ["Treatment Plan Template:read"],
					},
				],
			},
		],
	},
	{
		name: "Healthcare Administration",
		items: [
			{
				title: "Hospital Reference",
				path: "/healthcare/reference-data",
				icon: <Icon icon="solar:folder-with-files-bold-duotone" size={24} />,
				children: [
					{
						title: "Medical Departments",
						path: "/healthcare/departments",
						auth: ["Medical Department:read"],
					},
					{
						title: "Insurance & Claims",
						path: "/healthcare/insurance",
						auth: ["Insurance Claim:read"],
					},
					{
						title: "Medications Master",
						path: "/healthcare/medications",
						auth: ["Medication:read"],
					},
					{
						title: "Allergies Registry",
						path: "/healthcare/allergies",
						auth: ["Allergy:read"],
					},
					{
						title: "Reference Data",
						path: "/healthcare/reference-data",
						auth: ["Healthcare Settings:read"],
					},
					{
						title: "Patient Payments",
						path: "/healthcare/payments",
						auth: ["Healthcare Payment Record:read"],
					},
				],
			},
		],
	},
	{
		name: "Settings",
		items: [
			{
				title: "Settings",
				path: "/erp/settings",
				icon: <Icon icon="solar:settings-bold" size={24} />,
				children: [
					{
						title: "Users",
						path: "/erp/users",
						auth: ["User:read"],
					},
					{
						title: "Roles & Permissions",
						path: "/erp/roles",
						auth: ["Role:read"],
					},
					{
						title: "User Roles",
						path: "/erp/user-roles",
						auth: ["Role:read"],
					},
					{
						title: "Permission Matrix",
						path: "/erp/permission-matrix",
						auth: ["Role:read"],
					},
					{
						title: "Doc Types",
						path: "/erp/doctypes",
						auth: ["DocType:read"],
					},
					{
						title: "My Profile",
						path: "/erp/profile",
					},
					{
						title: "My Account",
						path: "/erp/account",
					},
					{
						title: "Comments",
						path: "/erp/comments",
						auth: ["Comment:read"],
					},
					{
						title: "Communications",
						path: "/erp/communications",
						auth: ["Communication:read"],
					},
					{
						title: "Error Logs",
						path: "/erp/error-logs",
						auth: ["Error Log:read"],
					},
					{
						title: "Scheduled Jobs",
						path: "/erp/scheduled-jobs",
						auth: ["Scheduled Job Type:read"],
					},
					{
						title: "Permission Inspector",
						path: "/erp/permission-inspector",
						auth: ["User:read", "Role:read"],
					},
					{
						title: "User Permissions",
						path: "/erp/user-permissions",
						auth: ["User:read"],
					},
					{
						title: "Document Shares",
						path: "/erp/doc-shares",
						auth: ["Role:read"],
					},
					{
						title: "Server Scripts",
						path: "/erp/server-scripts",
						auth: ["Server Script:read"],
					},
					{
						title: "Data Import/Export",
						path: "/erp/data-import-export",
						auth: ["User:read"],
					},
					{
						title: "Naming Rules",
						path: "/erp/naming-rules",
						auth: ["Document Naming Rule:read"],
					},
					{
						title: "Bulk Messaging",
						path: "/erp/bulk-messaging",
						auth: ["Communication:read"],
					},
					{
						title: "Workflow Designer",
						path: "/erp/workflows",
						auth: ["Workflow:read"],
					},
					{
						title: "Email Templates",
						path: "/erp/email-templates",
						auth: ["Email Template:read"],
					},
					{
						title: "System Settings",
						path: "/erp/system-settings",
						auth: ["System Settings:read"],
					},
					{
						title: "Notification Settings",
						path: "/erp/notification-settings",
						auth: ["Notification Settings:read"],
					},
					{
						title: "Notification Log",
						path: "/erp/notification-delivery-log",
						auth: ["User:read"],
					},
					{
						title: "My Notifications",
						path: "/erp/my-notification-prefs",
					},
					{
						title: "Email Accounts",
						path: "/erp/email-accounts",
						auth: ["Email Account:read"],
					},
				],
			},
		],
	},
];
