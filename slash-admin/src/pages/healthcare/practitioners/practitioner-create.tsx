import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate } from "react-router";
import { Icon } from "@/components/icon";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/ui/card";
import { Badge } from "@/ui/badge";
import { Separator } from "@/ui/separator";
import { Textarea } from "@/ui/textarea";
import { Progress } from "@/ui/progress";
import Avatar from "@/components/Avatar";
import { HealthcareApi } from "@/api/services/healthcareService";
import type { MedicalDepartment } from "@/api/services/healthcareService";
import { useDoctypePermissions } from "@/utils/permissions";
import EntitySelect from "@/components/healthcare/EntitySelect";
import { cn } from "@/utils";
import { toast } from "sonner";

// ─── Curated Professional Avatars ─────────────────────────────────────────────
const AVATAR_PRESETS = [
  {
    id: "female-1",
    label: "Female Physician (Cardiology)",
    url: "https://images.unsplash.com/photo-1594824813673-455b85a30554?auto=format&fit=crop&q=80&w=256",
  },
  {
    id: "male-1",
    label: "Male Physician (Pediatrics)",
    url: "https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&q=80&w=256",
  },
  {
    id: "female-2",
    label: "Female Surgeon (General Surgery)",
    url: "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&q=80&w=256",
  },
  {
    id: "male-2",
    label: "Male Surgeon (Orthopedics)",
    url: "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?auto=format&fit=crop&q=80&w=256",
  },
  {
    id: "female-3",
    label: "Female Specialist (Internal Medicine)",
    url: "https://images.unsplash.com/photo-1527613426441-4da17471b66d?auto=format&fit=crop&q=80&w=256",
  },
  {
    id: "male-3",
    label: "Senior Consultant (Neurology)",
    url: "https://images.unsplash.com/photo-1537368910025-700350fe46c7?auto=format&fit=crop&q=80&w=256",
  },
];

// Common clinical designations for fast 1-click selection
const POPULAR_DESIGNATIONS = [
  "Consultant Physician",
  "Senior Surgeon",
  "Chief Medical Officer",
  "Pediatrician",
  "Cardiologist",
  "General Practitioner",
  "Resident Physician",
  "Anesthesiologist",
  "Radiologist",
  "Physiotherapist",
  "Clinical Neurologist",
  "Dermatologist",
];

// ─── 1-Click Fast Pre-fill Clinical Templates ────────────────────────────────
const CLINICAL_TEMPLATES = [
  {
    name: "Dr. Sarah Chen",
    role: "Cardiologist",
    icon: "solar:heart-pulse-bold",
    badge: "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20",
    data: {
      title_prefix: "Dr.",
      first_name: "Sarah",
      middle_name: "M.",
      last_name: "Chen",
      gender: "Female",
      status: "Active",
      practitioner_type: "Internal",
      designation: "Senior Consultant Cardiologist",
      deptKeyword: "cardio",
      mobile_phone: "+1 (555) 234-8901",
      email: "sarah.chen@metropolitan.org",
      hospital: "Metropolitan Heart & Vascular Center",
      employee: "EMP-CARD-042",
      op_consulting_charge: 160,
      inpatient_visit_charge: 240,
      enable_free_follow_ups: true,
      valid_days: 7,
      max_visits: 1,
      image: "https://images.unsplash.com/photo-1594824813673-455b85a30554?auto=format&fit=crop&q=80&w=256",
      bio: "Board-certified cardiologist specializing in adult echocardiography, non-invasive imaging, and preventative cardiac care.",
      subspecialties: ["Echocardiography", "Preventative Care", "Hypertension"],
      office_room: "Suite 402, Heart Center",
      slot_duration: 20,
      max_appointments: 20,
      schedule_days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      start_time: "09:00",
      end_time: "17:00",
    },
  },
  {
    name: "Dr. Marcus Vance",
    role: "Pediatrician",
    icon: "solar:user-bold",
    badge: "bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/20",
    data: {
      title_prefix: "Dr.",
      first_name: "Marcus",
      middle_name: "L.",
      last_name: "Vance",
      gender: "Male",
      status: "Active",
      practitioner_type: "Internal",
      designation: "Chief Pediatrician",
      deptKeyword: "pediatr",
      mobile_phone: "+1 (555) 432-1098",
      email: "marcus.vance@metropolitan.org",
      hospital: "Children's Health Pavilion",
      employee: "EMP-PED-018",
      op_consulting_charge: 95,
      inpatient_visit_charge: 140,
      enable_free_follow_ups: true,
      valid_days: 10,
      max_visits: 2,
      image: "https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&q=80&w=256",
      bio: "Fellow of the American Academy of Pediatrics with 12+ years providing compassionate pediatric outpatient and neonatology care.",
      subspecialties: ["Neonatal Care", "Adolescent Medicine", "Immunizations"],
      office_room: "Room 105, Children's Wing",
      slot_duration: 15,
      max_appointments: 25,
      schedule_days: ["Monday", "Tuesday", "Wednesday", "Thursday"],
      start_time: "08:30",
      end_time: "16:30",
    },
  },
  {
    name: "Dr. Elena Rostova",
    role: "Lead Surgeon",
    icon: "solar:medical-kit-bold",
    badge: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
    data: {
      title_prefix: "Dr.",
      first_name: "Elena",
      middle_name: "K.",
      last_name: "Rostova",
      gender: "Female",
      status: "Active",
      practitioner_type: "Internal",
      designation: "Lead Consultant Surgeon",
      deptKeyword: "surg",
      mobile_phone: "+1 (555) 789-3456",
      email: "elena.rostova@metropolitan.org",
      hospital: "Metropolitan Surgical Institute",
      employee: "EMP-SURG-099",
      op_consulting_charge: 190,
      inpatient_visit_charge: 300,
      enable_free_follow_ups: true,
      valid_days: 14,
      max_visits: 1,
      image: "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&q=80&w=256",
      bio: "Specializing in advanced laparoscopic surgery, oncology resections, and emergency surgical intervention with over 1,500 procedures completed.",
      subspecialties: ["Laparoscopic Surgery", "Oncology Surgery", "Trauma"],
      office_room: "OR Suite 3, Surgical Tower",
      slot_duration: 30,
      max_appointments: 15,
      schedule_days: ["Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
      start_time: "08:00",
      end_time: "15:00",
    },
  },
  {
    name: "Prof. Julian Sterling",
    role: "Neurologist",
    icon: "solar:atom-bold",
    badge: "bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-500/20",
    data: {
      title_prefix: "Prof.",
      first_name: "Julian",
      middle_name: "E.",
      last_name: "Sterling",
      gender: "Male",
      status: "Active",
      practitioner_type: "External",
      designation: "Professor of Clinical Neurology",
      deptKeyword: "neuro",
      mobile_phone: "+1 (555) 890-1234",
      email: "julian.sterling@neuro-institute.org",
      hospital: "Neuroscience Institute & Research Hospital",
      employee: "VISIT-NEURO-007",
      op_consulting_charge: 220,
      inpatient_visit_charge: 350,
      enable_free_follow_ups: false,
      valid_days: 0,
      max_visits: 0,
      image: "https://images.unsplash.com/photo-1537368910025-700350fe46c7?auto=format&fit=crop&q=80&w=256",
      bio: "Director of Cognitive Neurology, leading clinical trials in neurodegenerative conditions, epilepsy management, and stroke rehabilitation.",
      subspecialties: ["Cognitive Neurology", "Epilepsy", "Neuro-rehabilitation"],
      office_room: "Building C, Suite 501",
      slot_duration: 45,
      max_appointments: 12,
      schedule_days: ["Monday", "Wednesday", "Friday"],
      start_time: "10:00",
      end_time: "18:00",
    },
  },
];

// Department styling utility matching directory page
function getDepartmentStyle(deptName?: string) {
  const name = (deptName || "").toLowerCase();
  if (name.includes("cardio")) {
    return {
      bg: "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30",
      gradient: "from-rose-500/20 via-pink-500/10 to-transparent",
      badgeColor: "bg-rose-500 text-white",
      icon: "solar:heart-pulse-bold",
    };
  }
  if (name.includes("pediatr") || name.includes("child")) {
    return {
      bg: "bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/30",
      gradient: "from-sky-500/20 via-blue-500/10 to-transparent",
      badgeColor: "bg-sky-500 text-white",
      icon: "solar:user-bold",
    };
  }
  if (name.includes("surg") || name.includes("operat")) {
    return {
      bg: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30",
      gradient: "from-amber-500/20 via-orange-500/10 to-transparent",
      badgeColor: "bg-amber-500 text-white",
      icon: "solar:medical-kit-bold",
    };
  }
  if (name.includes("physio") || name.includes("rehab")) {
    return {
      bg: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
      gradient: "from-emerald-500/20 via-teal-500/10 to-transparent",
      badgeColor: "bg-emerald-500 text-white",
      icon: "solar:accessibility-bold",
    };
  }
  if (name.includes("neuro") || name.includes("psych")) {
    return {
      bg: "bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-500/30",
      gradient: "from-violet-500/20 via-purple-500/10 to-transparent",
      badgeColor: "bg-violet-500 text-white",
      icon: "solar:atom-bold",
    };
  }
  return {
    bg: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30",
    gradient: "from-blue-500/20 via-indigo-500/10 to-transparent",
    badgeColor: "bg-blue-500 text-white",
    icon: "solar:stethoscope-bold",
  };
}

const WEEK_DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

export default function PractitionerCreatePage() {
  const navigate = useNavigate();
  const { canCreate } = useDoctypePermissions("Healthcare Practitioner");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Layout & UI Tabs State
  const [activeTab, setActiveTab] = useState<"profile" | "clinical" | "fees" | "schedule">("profile");
  const [viewMode, setViewMode] = useState<"tabs" | "all">("tabs");
  const [previewMode, setPreviewMode] = useState<"card" | "id_badge">("card");

  // State
  const [saving, setSaving] = useState(false);
  const [departments, setDepartments] = useState<MedicalDepartment[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [showSecondaryContact, setShowSecondaryContact] = useState(false);
  const [newSubspecialty, setNewSubspecialty] = useState("");

  // Form State
  const [form, setForm] = useState({
    title_prefix: "Dr.",
    first_name: "",
    middle_name: "",
    last_name: "",
    gender: "Male",
    status: "Active",
    series: "HLC-PRAC-.YYYY.-",
    mobile_phone: "",
    residence_phone: "",
    office_phone: "",
    email: "",
    practitioner_type: "Internal",
    user: null as number | null,
    employee: "",
    hospital: "Main Referral Hospital",
    department: null as number | null,
    designation: "Consultant Physician",
    address: "",
    bio: "",
    subspecialties: ["General Medicine", "Primary Care"],
    office_room: "OPD Consultation Suite 101",
    op_consulting_charge_item: null as number | null,
    op_consulting_charge: 100,
    inpatient_visit_charge_item: null as number | null,
    inpatient_visit_charge: 150,
    enable_free_follow_ups: true,
    valid_days: 7,
    max_visits: 1,
    image: "",
    // Practice Schedule Builder
    create_initial_schedules: true,
    schedule_days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
    start_time: "09:00",
    end_time: "17:00",
    slot_duration: 20,
    max_appointments: 20,
  });

  // Load Reference Entities
  useEffect(() => {
    HealthcareApi.departments
      .list({ page_size: 100 })
      .then((res) => {
        setDepartments(res.results || []);
      })
      .catch(() => {});

    HealthcareApi.stockItems
      .list({ page_size: 100 })
      .then((res) => {
        setItems(res.results || []);
      })
      .catch(() => {});

    HealthcareApi.users
      .list({ page_size: 100 })
      .then((res) => {
        setUsers(res.results || []);
      })
      .catch(() => {});
  }, []);

  const update = useCallback((key: string, value: any) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  // Derived full doctor display name
  const fullDoctorName = useMemo(() => {
    const parts = [
      form.title_prefix,
      form.first_name.trim(),
      form.middle_name.trim(),
      form.last_name.trim(),
    ].filter(Boolean);
    return parts.join(" ") || "Dr. Practitioner Name";
  }, [form.title_prefix, form.first_name, form.middle_name, form.last_name]);

  // Derived initials
  const initials = useMemo(() => {
    const f = form.first_name?.[0] || "";
    const l = form.last_name?.[0] || form.middle_name?.[0] || "";
    return `${f}${l}`.toUpperCase() || "DR";
  }, [form.first_name, form.last_name, form.middle_name]);

  // Selected department details
  const selectedDepartment = useMemo(() => {
    if (!form.department) return null;
    return departments.find((d) => d.id === form.department);
  }, [form.department, departments]);

  const departmentStyle = useMemo(() => {
    return getDepartmentStyle(selectedDepartment?.department);
  }, [selectedDepartment]);

  // Handle Loading Preset Demo Template
  const handleLoadTemplate = (template: typeof CLINICAL_TEMPLATES[0]) => {
    // Find matching department by keyword
    const matchedDept = departments.find((d) =>
      d.department.toLowerCase().includes(template.data.deptKeyword)
    );

    setForm((prev) => ({
      ...prev,
      title_prefix: template.data.title_prefix,
      first_name: template.data.first_name,
      middle_name: template.data.middle_name,
      last_name: template.data.last_name,
      gender: template.data.gender,
      status: template.data.status,
      practitioner_type: template.data.practitioner_type,
      designation: template.data.designation,
      department: matchedDept ? matchedDept.id : prev.department,
      mobile_phone: template.data.mobile_phone,
      email: template.data.email,
      hospital: template.data.hospital,
      employee: template.data.employee,
      op_consulting_charge: template.data.op_consulting_charge,
      inpatient_visit_charge: template.data.inpatient_visit_charge,
      enable_free_follow_ups: template.data.enable_free_follow_ups,
      valid_days: template.data.valid_days,
      max_visits: template.data.max_visits,
      image: template.data.image,
      bio: template.data.bio,
      subspecialties: template.data.subspecialties,
      office_room: template.data.office_room,
      slot_duration: template.data.slot_duration,
      max_appointments: template.data.max_appointments,
      schedule_days: template.data.schedule_days,
      start_time: template.data.start_time,
      end_time: template.data.end_time,
    }));

    toast.success(`Loaded clinical profile: ${template.name} (${template.role})`);
  };

  // Subspecialty Tag Handlers
  const addSubspecialtyTag = () => {
    const trimmed = newSubspecialty.trim();
    if (!trimmed) return;
    if (form.subspecialties.includes(trimmed)) {
      setNewSubspecialty("");
      return;
    }
    setForm((prev) => ({
      ...prev,
      subspecialties: [...prev.subspecialties, trimmed],
    }));
    setNewSubspecialty("");
  };

  const removeSubspecialtyTag = (tag: string) => {
    setForm((prev) => ({
      ...prev,
      subspecialties: prev.subspecialties.filter((t) => t !== tag),
    }));
  };

  // Photo Upload Handler (Local file to Data URL)
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload a valid image file");
      return;
    }

    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      const result = uploadEvent.target?.result as string;
      if (result) {
        update("image", result);
        toast.success("Profile photo uploaded successfully");
      }
    };
    reader.readAsDataURL(file);
  };

  // Registration Completeness Checklist
  const completeness = useMemo(() => {
    const items = [
      { label: "Provider Legal Name", done: Boolean(form.first_name.trim()), step: "profile" as const },
      { label: "Department Assigned", done: Boolean(form.department), step: "clinical" as const },
      { label: "Clinical Designation", done: Boolean(form.designation.trim()), step: "clinical" as const },
      { label: "Consultation Tariff Set", done: Number(form.op_consulting_charge) > 0, step: "fees" as const },
      { label: "Direct Phone or Email", done: Boolean(form.mobile_phone || form.email), step: "profile" as const },
      { label: "Weekly Schedule Roster", done: form.schedule_days.length > 0, step: "schedule" as const },
    ];
    const completedCount = items.filter((i) => i.done).length;
    const percentage = Math.round((completedCount / items.length) * 100);
    return { items, percentage };
  }, [form]);

  // Submit Handler
  const handleSave = async () => {
    if (!form.first_name.trim()) {
      toast.error("Please enter the practitioner's first name");
      setActiveTab("profile");
      return;
    }

    setSaving(true);
    try {
      // Assemble full physical address including room
      const combinedAddress = [form.office_room, form.hospital, form.address]
        .filter(Boolean)
        .join(" • ");

      const payload: any = {
        series: form.series,
        first_name: form.first_name.trim(),
        middle_name: form.middle_name.trim(),
        last_name: form.last_name.trim(),
        gender: form.gender,
        status: form.status,
        practitioner_type: form.practitioner_type,
        department: form.department,
        designation: form.designation.trim(),
        mobile_phone: form.mobile_phone.trim(),
        residence_phone: form.residence_phone.trim(),
        office_phone: form.office_phone.trim(),
        email: form.email.trim(),
        address: combinedAddress,
        hospital: form.hospital.trim(),
        employee: form.employee.trim(),
        user: form.user,
        op_consulting_charge: form.op_consulting_charge,
        op_consulting_charge_item: form.op_consulting_charge_item,
        inpatient_visit_charge: form.inpatient_visit_charge,
        inpatient_visit_charge_item: form.inpatient_visit_charge_item,
        enable_free_follow_ups: form.enable_free_follow_ups,
        valid_days: form.valid_days,
        max_visits: form.max_visits,
        image: form.image.trim(),
      };

      const practitioner: any = await HealthcareApi.practitioners.create(payload);

      // Auto-register initial weekly schedules if checked
      if (form.create_initial_schedules && form.schedule_days.length > 0 && practitioner?.id) {
        try {
          const schedulePromises = form.schedule_days.map((day) =>
            HealthcareApi.practitionerSchedules.create({
              practitioner: practitioner.id,
              day,
              start_time: `${form.start_time}:00`,
              end_time: `${form.end_time}:00`,
              max_appointments: form.max_appointments,
              is_active: true,
            })
          );
          await Promise.all(schedulePromises);
        } catch (scheduleErr) {
          console.warn("Could not auto-create weekly schedule:", scheduleErr);
        }
      }

      toast.success(`${fullDoctorName} credentialed and registered successfully`);
      navigate(`/healthcare/practitioners/${practitioner.id}`);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Failed to create healthcare practitioner");
    } finally {
      setSaving(false);
    }
  };

  // Keyboard shortcut Ctrl+S or Cmd+S to save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (!saving && canCreate && form.first_name.trim()) {
          handleSave();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [saving, canCreate, form.first_name, handleSave]);

  return (
    <div className="max-w-7xl mx-auto pb-24 space-y-6">
      {/* ─── Hidden File Input for Avatar Upload ─── */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handlePhotoUpload}
        accept="image/*"
        className="hidden"
      />

      {/* ─── Executive Top Command Bar ─── */}
      <div className="rounded-2xl border bg-card/95 backdrop-blur-sm p-5 shadow-xs transition-all">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20">
              <Icon icon="solar:user-plus-bold-duotone" size={26} />
            </div>
            <div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <button
                  type="button"
                  onClick={() => navigate("/healthcare")}
                  className="hover:text-foreground flex items-center gap-1 transition-colors"
                >
                  <Icon icon="solar:home-2-bold" size={13} />
                  Healthcare
                </button>
                <span>/</span>
                <button
                  type="button"
                  onClick={() => navigate("/healthcare/practitioners")}
                  className="hover:text-foreground transition-colors"
                >
                  Practitioners
                </button>
                <span>/</span>
                <span className="text-foreground font-semibold">New Registration</span>
              </div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl font-extrabold tracking-tight text-foreground">
                  New Healthcare Practitioner
                </h1>
                <Badge
                  variant="outline"
                  className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 text-[10px] font-bold gap-1 px-2 py-0.5"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                  Intake Draft
                </Badge>
                <span className="text-xs text-muted-foreground hidden sm:inline">
                  • Shortcut: <kbd className="font-mono text-[10px] bg-muted px-1.5 py-0.5 rounded border">Ctrl + S</kbd>
                </span>
              </div>
            </div>
          </div>

          {/* Quick Actions & Fast Preset Dropdown */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Quick Demo Templates */}
            <div className="relative group">
              <Button
                variant="outline"
                size="sm"
                className="h-9 text-xs font-semibold gap-1.5 border-dashed border-primary/40 text-primary hover:bg-primary/5"
              >
                <Icon icon="solar:magic-stick-3-bold" size={14} className="text-primary" />
                Fill Sample Profile
                <Icon icon="solar:alt-arrow-down-bold" size={12} />
              </Button>
              <div className="absolute right-0 top-full mt-1.5 w-64 p-2 rounded-xl border bg-popover shadow-xl z-50 hidden group-hover:block animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-2 py-1">
                  1-Click Clinical Archetypes
                </div>
                <div className="space-y-1">
                  {CLINICAL_TEMPLATES.map((tmpl) => (
                    <button
                      key={tmpl.name}
                      type="button"
                      onClick={() => handleLoadTemplate(tmpl)}
                      className="w-full text-left p-2 rounded-lg hover:bg-muted/80 transition-colors flex items-center gap-2.5 text-xs"
                    >
                      <div className={cn("p-1.5 rounded-md border shrink-0", tmpl.badge)}>
                        <Icon icon={tmpl.icon} size={14} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-foreground truncate">{tmpl.name}</div>
                        <div className="text-[11px] text-muted-foreground truncate">{tmpl.role}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* View Mode Toggle: Tabs vs All */}
            <div className="inline-flex rounded-lg border bg-muted/40 p-0.5">
              <button
                type="button"
                onClick={() => setViewMode("tabs")}
                className={cn(
                  "px-2.5 py-1 text-xs font-semibold rounded-md transition-all flex items-center gap-1",
                  viewMode === "tabs"
                    ? "bg-background text-foreground shadow-2xs font-bold"
                    : "text-muted-foreground hover:text-foreground"
                )}
                title="Step-by-step section tabs"
              >
                <Icon icon="solar:layers-minimalistic-bold" size={13} />
                Tabs
              </button>
              <button
                type="button"
                onClick={() => setViewMode("all")}
                className={cn(
                  "px-2.5 py-1 text-xs font-semibold rounded-md transition-all flex items-center gap-1",
                  viewMode === "all"
                    ? "bg-background text-foreground shadow-2xs font-bold"
                    : "text-muted-foreground hover:text-foreground"
                )}
                title="Show all sections unified"
              >
                <Icon icon="solar:list-check-bold" size={13} />
                All
              </button>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/healthcare/practitioners")}
              className="h-9 text-xs"
            >
              Cancel
            </Button>

            <Button
              onClick={handleSave}
              disabled={saving || !canCreate || !form.first_name.trim()}
              className="h-9 text-xs font-semibold gap-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md shadow-blue-500/20 px-5"
            >
              {saving ? (
                <>
                  <Icon icon="solar:refresh-circle-bold" className="animate-spin" size={15} />
                  Saving...
                </>
              ) : (
                <>
                  <Icon icon="solar:disk-bold" size={15} />
                  Save Practitioner
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* ─── Step Navigation Ribbon (Only in Tabs mode) ─── */}
      {viewMode === "tabs" && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-card rounded-xl p-1.5 border shadow-2xs">
          {[
            {
              id: "profile" as const,
              label: "1. Identity & Profile",
              desc: "Name, photo & contact",
              icon: "solar:user-id-bold",
              done: Boolean(form.first_name.trim() && (form.mobile_phone || form.email)),
            },
            {
              id: "clinical" as const,
              label: "2. Department & Role",
              desc: "Specialty & credentials",
              icon: "solar:medical-kit-bold",
              done: Boolean(form.department && form.designation.trim()),
            },
            {
              id: "fees" as const,
              label: "3. Tariff & Billing",
              desc: "OP/IP fees & policies",
              icon: "solar:dollar-minimalistic-bold-duotone",
              done: Number(form.op_consulting_charge) > 0,
            },
            {
              id: "schedule" as const,
              label: "4. Availability & Roster",
              desc: "Weekly clinic schedule",
              icon: "solar:calendar-date-bold",
              done: form.schedule_days.length > 0,
            },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "p-2.5 rounded-lg text-left transition-all relative flex items-center gap-2.5",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-2xs font-bold"
                    : "hover:bg-muted/60 text-muted-foreground hover:text-foreground"
                )}
              >
                <div
                  className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border",
                    isActive
                      ? "bg-primary-foreground/15 border-primary-foreground/20 text-primary-foreground"
                      : tab.done
                      ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                      : "bg-muted border-border text-muted-foreground"
                  )}
                >
                  <Icon
                    icon={tab.done && !isActive ? "solar:check-circle-bold" : tab.icon}
                    size={16}
                  />
                </div>
                <div className="min-w-0 flex-1 truncate">
                  <div className="text-xs font-bold truncate leading-tight">{tab.label}</div>
                  <div
                    className={cn(
                      "text-[10px] truncate mt-0.5",
                      isActive ? "text-primary-foreground/80" : "text-muted-foreground"
                    )}
                  >
                    {tab.desc}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* ─── 2-Column Clinical Layout ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Form Details (8 Cols) */}
        <div className="lg:col-span-8 space-y-6">
          {/* ════════ SECTION 1: Identity & Profile ════════ */}
          {(viewMode === "all" || activeTab === "profile") && (
            <Card className="shadow-xs border-border overflow-hidden">
              <CardHeader className="pb-3 border-b bg-gradient-to-r from-blue-500/5 via-indigo-500/5 to-transparent">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="h-7 w-7 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center font-bold text-xs border border-blue-500/20">
                      1
                    </div>
                    <div>
                      <CardTitle className="text-sm font-bold flex items-center gap-2">
                        <Icon icon="solar:user-id-bold" size={16} className="text-blue-600" />
                        Provider Identity & Clinical Demographics
                      </CardTitle>
                      <CardDescription className="text-xs text-muted-foreground mt-0.5">
                        Full legal credentials, gender, profile portrait, and contact lines
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[10px] font-mono">
                    Mandatory Step
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="pt-5 space-y-5">
                {/* Avatar Picker & Photo Gallery */}
                <div className="p-4 rounded-xl border bg-muted/20 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <Icon icon="solar:camera-bold" size={14} className="text-primary" />
                        Doctor Portrait / Directory Photo
                      </Label>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Pick a curated clinical portrait, paste a web image URL, or upload from your device.
                      </p>
                    </div>
                    {form.image && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => update("image", "")}
                        className="h-7 text-[11px] text-destructive hover:bg-destructive/10"
                      >
                        <Icon icon="solar:trash-bin-trash-bold" size={12} className="mr-1" />
                        Clear Photo
                      </Button>
                    )}
                  </div>

                  {/* Curated Presets Grid */}
                  <div className="flex items-center gap-3 overflow-x-auto pb-1 pt-1">
                    {AVATAR_PRESETS.map((preset) => {
                      const isSelected = form.image === preset.url;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => update("image", preset.url)}
                          className={cn(
                            "relative rounded-xl overflow-hidden border-2 transition-all p-0.5 shrink-0 group",
                            isSelected
                              ? "border-primary ring-2 ring-primary/30 scale-105"
                              : "border-border/70 hover:border-primary/50 opacity-80 hover:opacity-100"
                          )}
                          title={preset.label}
                        >
                          <img
                            src={preset.url}
                            alt={preset.label}
                            className="w-12 h-12 rounded-lg object-cover"
                          />
                          {isSelected && (
                            <div className="absolute inset-0 bg-primary/20 flex items-center justify-center rounded-lg">
                              <div className="bg-primary text-white rounded-full p-0.5">
                                <Icon icon="solar:check-bold" size={10} />
                              </div>
                            </div>
                          )}
                        </button>
                      );
                    })}

                    {/* Local File Upload Button */}
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-12 h-12 rounded-xl border-2 border-dashed border-primary/40 hover:border-primary hover:bg-primary/5 flex flex-col items-center justify-center text-primary transition-all shrink-0"
                      title="Upload custom image file"
                    >
                      <Icon icon="solar:cloud-upload-bold" size={16} />
                      <span className="text-[8px] font-bold mt-0.5">Upload</span>
                    </button>
                  </div>

                  {/* Manual URL input */}
                  <div className="relative">
                    <Icon
                      icon="solar:link-circle-bold"
                      size={14}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    />
                    <Input
                      placeholder="Or paste external image URL (https://...)"
                      value={form.image}
                      onChange={(e) => update("image", e.target.value)}
                      className="pl-8 h-8 text-xs font-mono"
                    />
                  </div>
                </div>

                {/* Name Breakdown: Prefix, First, Middle, Last */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  <div className="sm:col-span-3">
                    <Label className="text-xs font-semibold text-muted-foreground">Title Prefix</Label>
                    <select
                      className="mt-1 w-full h-9 border border-input rounded-md px-2.5 text-xs bg-background font-semibold focus:ring-1 focus:ring-primary outline-none"
                      value={form.title_prefix}
                      onChange={(e) => update("title_prefix", e.target.value)}
                    >
                      <option value="Dr.">Dr.</option>
                      <option value="Prof.">Prof.</option>
                      <option value="Assoc. Prof.">Assoc. Prof.</option>
                      <option value="Mr.">Mr.</option>
                      <option value="Ms.">Ms.</option>
                      <option value="Mrs.">Mrs.</option>
                    </select>
                  </div>

                  <div className="sm:col-span-3">
                    <Label className="text-xs font-semibold text-foreground">
                      First Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      placeholder="e.g. Sarah"
                      value={form.first_name}
                      onChange={(e) => update("first_name", e.target.value)}
                      className="mt-1 h-9 text-xs font-medium"
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <Label className="text-xs font-semibold text-muted-foreground">Middle Name</Label>
                    <Input
                      placeholder="Optional"
                      value={form.middle_name}
                      onChange={(e) => update("middle_name", e.target.value)}
                      className="mt-1 h-9 text-xs"
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <Label className="text-xs font-semibold text-foreground">
                      Last Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      placeholder="e.g. Chen"
                      value={form.last_name}
                      onChange={(e) => update("last_name", e.target.value)}
                      className="mt-1 h-9 text-xs font-medium"
                    />
                  </div>
                </div>

                {/* Status & Gender Selectors */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs font-semibold text-muted-foreground">Gender</Label>
                    <div className="grid grid-cols-2 gap-2 mt-1">
                      {["Male", "Female"].map((g) => (
                        <button
                          key={g}
                          type="button"
                          onClick={() => update("gender", g)}
                          className={cn(
                            "h-9 rounded-md border text-xs font-semibold transition-all flex items-center justify-center gap-1.5",
                            form.gender === g
                              ? "bg-primary text-primary-foreground border-primary shadow-2xs font-bold"
                              : "bg-background text-muted-foreground border-input hover:bg-muted/50"
                          )}
                        >
                          <Icon
                            icon={g === "Male" ? "solar:men-bold" : "solar:women-bold"}
                            size={14}
                          />
                          {g}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs font-semibold text-muted-foreground">Clinical Roster Status</Label>
                    <div className="grid grid-cols-2 gap-2 mt-1">
                      {["Active", "Disabled"].map((st) => (
                        <button
                          key={st}
                          type="button"
                          onClick={() => update("status", st)}
                          className={cn(
                            "h-9 rounded-md border text-xs font-semibold transition-all flex items-center justify-center gap-1.5",
                            form.status === st
                              ? st === "Active"
                                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40 font-bold shadow-2xs"
                                : "bg-muted text-muted-foreground border-border font-bold"
                              : "bg-background text-muted-foreground border-input hover:bg-muted/50"
                          )}
                        >
                          <span
                            className={cn(
                              "w-1.5 h-1.5 rounded-full",
                              st === "Active" ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground/60"
                            )}
                          />
                          {st === "Active" ? "Active Roster" : "Inactive / On Hold"}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Direct Communications: Phone & Email */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs font-semibold text-foreground">
                      Direct Mobile Phone <span className="text-destructive">*</span>
                    </Label>
                    <div className="relative mt-1">
                      <Icon
                        icon="solar:phone-bold"
                        size={15}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                      />
                      <Input
                        placeholder="+1 (555) 000-0000"
                        value={form.mobile_phone}
                        onChange={(e) => update("mobile_phone", e.target.value)}
                        className="pl-9 h-9 text-xs font-mono font-medium"
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs font-semibold text-foreground">
                      Hospital Work Email <span className="text-destructive">*</span>
                    </Label>
                    <div className="relative mt-1">
                      <Icon
                        icon="solar:letter-bold"
                        size={15}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                      />
                      <Input
                        type="email"
                        placeholder="doctor@hospital.org"
                        value={form.email}
                        onChange={(e) => update("email", e.target.value)}
                        className="pl-9 h-9 text-xs font-mono font-medium"
                      />
                    </div>
                  </div>
                </div>

                {/* Professional Bio / Clinical Summary */}
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground">
                    Professional Statement & Clinical Background
                  </Label>
                  <Textarea
                    placeholder="Short summary of medical credentials, fellowship training, and clinical focus..."
                    value={form.bio}
                    onChange={(e) => update("bio", e.target.value)}
                    className="mt-1 text-xs min-h-[60px]"
                    rows={2}
                  />
                </div>

                {/* Secondary Contact Collapsible Toggle */}
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => setShowSecondaryContact(!showSecondaryContact)}
                    className="text-xs text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1 transition-colors"
                  >
                    <Icon
                      icon={showSecondaryContact ? "solar:alt-arrow-up-bold" : "solar:alt-arrow-down-bold"}
                      size={14}
                    />
                    {showSecondaryContact ? "Hide Secondary Phone Lines" : "+ Add Residence & Clinic Extension"}
                  </button>

                  {showSecondaryContact && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3 p-3 rounded-xl bg-muted/20 border border-border/50 animate-in fade-in duration-200">
                      <div>
                        <Label className="text-xs font-semibold text-muted-foreground">Residence Phone</Label>
                        <Input
                          placeholder="Home telephone..."
                          value={form.residence_phone}
                          onChange={(e) => update("residence_phone", e.target.value)}
                          className="mt-1 h-8 text-xs font-mono"
                        />
                      </div>
                      <div>
                        <Label className="text-xs font-semibold text-muted-foreground">Clinic Extension</Label>
                        <Input
                          placeholder="e.g. Ext 4022"
                          value={form.office_phone}
                          onChange={(e) => update("office_phone", e.target.value)}
                          className="mt-1 h-8 text-xs font-mono"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* ════════ SECTION 2: Department & Credentials ════════ */}
          {(viewMode === "all" || activeTab === "clinical") && (
            <Card className="shadow-xs border-border overflow-hidden">
              <CardHeader className="pb-3 border-b bg-gradient-to-r from-emerald-500/5 via-teal-500/5 to-transparent">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="h-7 w-7 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold text-xs border border-emerald-500/20">
                      2
                    </div>
                    <div>
                      <CardTitle className="text-sm font-bold flex items-center gap-2">
                        <Icon icon="solar:medical-kit-bold" size={16} className="text-emerald-600" />
                        Departmental Privileges & Specialty Roles
                      </CardTitle>
                      <CardDescription className="text-xs text-muted-foreground mt-0.5">
                        Clinical department assignment, role designation, subspecialty focus, and hospital links
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[10px] font-mono">
                    Step 2
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="pt-5 space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Department with EntitySelect */}
                  <div>
                    <Label className="text-xs font-semibold text-foreground">
                      Medical Department <span className="text-destructive">*</span>
                    </Label>
                    <div className="mt-1">
                      <EntitySelect
                        doctype="Medical Department"
                        rawItems={departments}
                        options={departments.map((d) => ({
                          value: d.id,
                          label: d.department,
                        }))}
                        value={form.department}
                        onChange={(v) => update("department", v)}
                        onOptionAdded={(_opt, raw) => {
                          if (raw) setDepartments((prev) => [...prev, raw]);
                        }}
                        placeholder="Select or Search Department"
                        emptyText="No departments found"
                        tone="emerald"
                      />
                    </div>
                  </div>

                  {/* Affiliation Type */}
                  <div>
                    <Label className="text-xs font-semibold text-muted-foreground">Affiliation Type</Label>
                    <div className="grid grid-cols-2 gap-2 mt-1">
                      {["Internal", "External"].map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => update("practitioner_type", t)}
                          className={cn(
                            "h-9 rounded-md border text-xs font-semibold transition-all flex items-center justify-center gap-1.5",
                            form.practitioner_type === t
                              ? t === "Internal"
                                ? "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/40 font-bold shadow-2xs"
                                : "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/40 font-bold shadow-2xs"
                              : "bg-background text-muted-foreground border-input hover:bg-muted/50"
                          )}
                        >
                          <Icon
                            icon={t === "Internal" ? "solar:buildings-bold" : "solar:user-hand-up-bold"}
                            size={14}
                          />
                          {t === "Internal" ? "Internal Staff" : "Visiting Specialist"}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Designation Input + Popular Chips */}
                <div>
                  <Label className="text-xs font-semibold text-foreground">
                    Clinical Designation / Role Title <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    placeholder="e.g. Senior Consultant Cardiologist"
                    value={form.designation}
                    onChange={(e) => update("designation", e.target.value)}
                    className="mt-1 h-9 text-xs font-medium"
                  />

                  {/* 1-Click Fast Suggestions */}
                  <div className="flex items-center gap-1.5 flex-wrap pt-2">
                    <span className="text-[10px] font-semibold text-muted-foreground">Quick pick:</span>
                    {POPULAR_DESIGNATIONS.map((desig) => (
                      <button
                        key={desig}
                        type="button"
                        onClick={() => update("designation", desig)}
                        className={cn(
                          "text-[10px] px-2 py-0.5 rounded-full border transition-all",
                          form.designation === desig
                            ? "bg-primary text-primary-foreground border-primary font-bold shadow-2xs scale-105"
                            : "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground border-border"
                        )}
                      >
                        {desig}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Sub-Specialties & Clinical Focus Tags */}
                <div className="p-3.5 rounded-xl border bg-muted/20 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <Icon icon="solar:tag-bold" size={13} className="text-primary" />
                      Clinical Focus & Sub-Specialties
                    </Label>
                    <span className="text-[10px] text-muted-foreground">
                      Appears on Patient Directory Badge
                    </span>
                  </div>

                  {/* Active Tags */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {form.subspecialties.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 text-[11px] font-medium bg-background px-2.5 py-1 rounded-md border border-border shadow-2xs text-foreground"
                      >
                        {tag}
                        <button
                          type="button"
                          onClick={() => removeSubspecialtyTag(tag)}
                          className="hover:text-destructive text-muted-foreground transition-colors ml-0.5"
                        >
                          <Icon icon="solar:close-circle-bold" size={12} />
                        </button>
                      </span>
                    ))}

                    {/* Quick Input to Add New Tag */}
                    <div className="flex items-center gap-1.5">
                      <Input
                        placeholder="Add subspecialty..."
                        value={newSubspecialty}
                        onChange={(e) => setNewSubspecialty(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addSubspecialtyTag();
                          }
                        }}
                        className="h-7 w-40 text-[11px] bg-background"
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={addSubspecialtyTag}
                        className="h-7 px-2 text-[11px]"
                      >
                        Add
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Facility, Clinic Room & Administrative Links */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs font-semibold text-muted-foreground">Hospital / Facility</Label>
                    <Input
                      placeholder="e.g. Main Hospital"
                      value={form.hospital}
                      onChange={(e) => update("hospital", e.target.value)}
                      className="mt-1 h-8 text-xs"
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-semibold text-muted-foreground">Office / Room Suite</Label>
                    <Input
                      placeholder="e.g. Suite 402, West Wing"
                      value={form.office_room}
                      onChange={(e) => update("office_room", e.target.value)}
                      className="mt-1 h-8 text-xs font-medium"
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-semibold text-muted-foreground">Employee ID (HR)</Label>
                    <Input
                      placeholder="e.g. EMP-0012"
                      value={form.employee}
                      onChange={(e) => update("employee", e.target.value)}
                      className="mt-1 h-8 text-xs font-mono"
                    />
                  </div>
                </div>

                {/* Linked System User Account */}
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground">
                    Linked System / Staff User (Optional)
                  </Label>
                  <select
                    className="mt-1 w-full h-8 border border-input rounded-md px-2.5 text-xs bg-background"
                    value={form.user || ""}
                    onChange={(e) => update("user", e.target.value ? Number(e.target.value) : null)}
                  >
                    <option value="">No system user linked</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.username} ({u.email || u.first_name || "User"})
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Allows the practitioner to sign in to Slash Admin and access their appointment calendar.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ════════ SECTION 3: Fees & Billing Tariffs ════════ */}
          {(viewMode === "all" || activeTab === "fees") && (
            <Card className="shadow-xs border-border overflow-hidden">
              <CardHeader className="pb-3 border-b bg-gradient-to-r from-amber-500/5 via-orange-500/5 to-transparent">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="h-7 w-7 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold text-xs border border-amber-500/20">
                      3
                    </div>
                    <div>
                      <CardTitle className="text-sm font-bold flex items-center gap-2">
                        <Icon icon="solar:dollar-minimalistic-bold-duotone" size={17} className="text-amber-600" />
                        Consultation Tariffs & Follow-Up Policies
                      </CardTitle>
                      <CardDescription className="text-xs text-muted-foreground mt-0.5">
                        Set outpatient consultation fee, inpatient ward rounds rate, and free visit validity
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[10px] font-mono">
                    Step 3
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="pt-5 space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Outpatient Consulting Rate */}
                  <div className="p-4 rounded-xl border bg-muted/20 space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-bold text-foreground">
                        Outpatient (OP) Consultation Fee
                      </Label>
                      <Badge variant="outline" className="text-[10px] font-mono bg-background">
                        Per Visit
                      </Badge>
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">
                        $
                      </span>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={form.op_consulting_charge}
                        onChange={(e) => update("op_consulting_charge", parseFloat(e.target.value) || 0)}
                        className="pl-8 h-10 text-sm font-mono font-bold bg-background"
                      />
                    </div>
                    <div>
                      <Label className="text-[11px] text-muted-foreground">Link Item Tariff Code</Label>
                      <div className="mt-1">
                        <EntitySelect
                          doctype="Item"
                          rawItems={items}
                          options={items.map((it) => ({
                            value: it.id,
                            label: it.item_name || it.item_code,
                          }))}
                          value={form.op_consulting_charge_item}
                          onChange={(v) => update("op_consulting_charge_item", v)}
                          placeholder="Select billing item"
                          emptyText="No items found"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Inpatient Visit Charge */}
                  <div className="p-4 rounded-xl border bg-muted/20 space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-bold text-foreground">
                        Inpatient (IP) Ward Round Fee
                      </Label>
                      <Badge variant="outline" className="text-[10px] font-mono bg-background">
                        Per Round
                      </Badge>
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">
                        $
                      </span>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={form.inpatient_visit_charge}
                        onChange={(e) => update("inpatient_visit_charge", parseFloat(e.target.value) || 0)}
                        className="pl-8 h-10 text-sm font-mono font-bold bg-background"
                      />
                    </div>
                    <div>
                      <Label className="text-[11px] text-muted-foreground">Link Item Tariff Code</Label>
                      <div className="mt-1">
                        <EntitySelect
                          doctype="Item"
                          rawItems={items}
                          options={items.map((it) => ({
                            value: it.id,
                            label: it.item_name || it.item_code,
                          }))}
                          value={form.inpatient_visit_charge_item}
                          onChange={(v) => update("inpatient_visit_charge_item", v)}
                          placeholder="Select billing item"
                          emptyText="No items found"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Free Follow-up Rules */}
                <div className="p-4 rounded-xl border border-border/80 bg-background space-y-3.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        id="free_followup"
                        checked={form.enable_free_follow_ups}
                        onChange={(e) => update("enable_free_follow_ups", e.target.checked)}
                        className="h-4 w-4 rounded border-input text-primary focus:ring-primary cursor-pointer"
                      />
                      <label htmlFor="free_followup" className="text-xs font-bold text-foreground cursor-pointer">
                        Enable Complimentary Clinical Follow-Up Visits
                      </label>
                    </div>
                    {form.enable_free_follow_ups && (
                      <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-[10px] font-bold">
                        Policy Active
                      </Badge>
                    )}
                  </div>

                  {form.enable_free_follow_ups && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-border/60 animate-in fade-in duration-200">
                      <div>
                        <Label className="text-xs font-semibold text-muted-foreground">
                          Validity Window (Days)
                        </Label>
                        <Input
                          type="number"
                          min="1"
                          value={form.valid_days}
                          onChange={(e) => update("valid_days", parseInt(e.target.value) || 0)}
                          className="mt-1 h-9 text-xs font-mono font-bold"
                        />
                        <span className="text-[10px] text-muted-foreground mt-0.5 block">
                          Patient is exempt from consultation fee within this timeframe
                        </span>
                      </div>

                      <div>
                        <Label className="text-xs font-semibold text-muted-foreground">
                          Max Permitted Free Visits
                        </Label>
                        <Input
                          type="number"
                          min="1"
                          value={form.max_visits}
                          onChange={(e) => update("max_visits", parseInt(e.target.value) || 0)}
                          className="mt-1 h-9 text-xs font-mono font-bold"
                        />
                        <span className="text-[10px] text-muted-foreground mt-0.5 block">
                          Maximum complimentary follow-up encounters allowed
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* ════════ SECTION 4: Practice Availability & Roster ════════ */}
          {(viewMode === "all" || activeTab === "schedule") && (
            <Card className="shadow-xs border-border overflow-hidden">
              <CardHeader className="pb-3 border-b bg-gradient-to-r from-purple-500/5 via-violet-500/5 to-transparent">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="h-7 w-7 rounded-lg bg-purple-500/10 text-purple-600 flex items-center justify-center font-bold text-xs border border-purple-500/20">
                      4
                    </div>
                    <div>
                      <CardTitle className="text-sm font-bold flex items-center gap-2">
                        <Icon icon="solar:calendar-date-bold" size={17} className="text-purple-600" />
                        Weekly Practice Availability & Initial Roster
                      </CardTitle>
                      <CardDescription className="text-xs text-muted-foreground mt-0.5">
                        Configure clinical working days, appointment slot duration, and daily patient quota
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[10px] font-mono">
                    Step 4
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="pt-5 space-y-5">
                <div className="flex items-center justify-between p-3 rounded-xl bg-purple-500/10 border border-purple-500/20">
                  <div className="flex items-center gap-2.5">
                    <input
                      type="checkbox"
                      id="create_schedules"
                      checked={form.create_initial_schedules}
                      onChange={(e) => update("create_initial_schedules", e.target.checked)}
                      className="h-4 w-4 rounded border-input text-primary focus:ring-primary cursor-pointer"
                    />
                    <label htmlFor="create_schedules" className="text-xs font-bold text-foreground cursor-pointer">
                      Auto-generate weekly schedule entries upon saving
                    </label>
                  </div>
                  <Badge variant="outline" className="text-[10px] font-mono">
                    {form.schedule_days.length} Days Active
                  </Badge>
                </div>

                {/* Day Selector */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-xs font-semibold text-foreground">Clinic Consultation Days</Label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          update("schedule_days", ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"])
                        }
                        className="text-[10px] text-primary hover:underline font-semibold"
                      >
                        Weekdays
                      </button>
                      <span className="text-muted-foreground text-[10px]">•</span>
                      <button
                        type="button"
                        onClick={() => update("schedule_days", [...WEEK_DAYS])}
                        className="text-[10px] text-primary hover:underline font-semibold"
                      >
                        All 7 Days
                      </button>
                      <span className="text-muted-foreground text-[10px]">•</span>
                      <button
                        type="button"
                        onClick={() => update("schedule_days", [])}
                        className="text-[10px] text-destructive hover:underline font-semibold"
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-7 gap-2">
                    {WEEK_DAYS.map((d) => {
                      const isSelected = form.schedule_days.includes(d);
                      return (
                        <button
                          key={d}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              update(
                                "schedule_days",
                                form.schedule_days.filter((item) => item !== d)
                              );
                            } else {
                              update("schedule_days", [...form.schedule_days, d]);
                            }
                          }}
                          className={cn(
                            "h-10 rounded-lg border text-xs font-semibold transition-all flex flex-col items-center justify-center gap-0.5",
                            isSelected
                              ? "bg-primary text-primary-foreground border-primary shadow-2xs font-bold"
                              : "bg-background text-muted-foreground border-input hover:bg-muted/50"
                          )}
                        >
                          <span>{d.slice(0, 3)}</span>
                          <span className="text-[9px] opacity-80">{isSelected ? "ON" : "OFF"}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Hours & Slot Duration */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <Label className="text-xs font-semibold text-muted-foreground">Clinic Start Time</Label>
                    <Input
                      type="time"
                      value={form.start_time}
                      onChange={(e) => update("start_time", e.target.value)}
                      className="mt-1 h-9 text-xs font-mono font-bold"
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-semibold text-muted-foreground">Clinic End Time</Label>
                    <Input
                      type="time"
                      value={form.end_time}
                      onChange={(e) => update("end_time", e.target.value)}
                      className="mt-1 h-9 text-xs font-mono font-bold"
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-semibold text-muted-foreground">Consultation Slot Duration</Label>
                    <select
                      className="mt-1 w-full h-9 border border-input rounded-md px-2.5 text-xs bg-background font-semibold"
                      value={form.slot_duration}
                      onChange={(e) => update("slot_duration", parseInt(e.target.value) || 20)}
                    >
                      <option value={15}>15 Minutes (Fast Track)</option>
                      <option value={20}>20 Minutes (Standard)</option>
                      <option value={30}>30 Minutes (Specialist)</option>
                      <option value={45}>45 Minutes (Extended)</option>
                      <option value={60}>60 Minutes (Comprehensive)</option>
                    </select>
                  </div>
                </div>

                {/* Max Patients Quota */}
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground">
                    Max Daily Patient Booking Quota
                  </Label>
                  <div className="flex items-center gap-3 mt-1">
                    <Input
                      type="number"
                      min="1"
                      max="100"
                      value={form.max_appointments}
                      onChange={(e) => update("max_appointments", parseInt(e.target.value) || 20)}
                      className="h-9 w-32 text-xs font-mono font-bold"
                    />
                    <span className="text-xs text-muted-foreground">
                      Cap per shift before appointment slot overflow queue activates
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Stepper Navigation Buttons */}
          {viewMode === "tabs" && (
            <div className="flex items-center justify-between pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={activeTab === "profile"}
                onClick={() => {
                  if (activeTab === "clinical") setActiveTab("profile");
                  if (activeTab === "fees") setActiveTab("clinical");
                  if (activeTab === "schedule") setActiveTab("fees");
                }}
                className="text-xs gap-1"
              >
                <Icon icon="solar:arrow-left-bold" size={14} />
                Previous Step
              </Button>

              {activeTab !== "schedule" ? (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    if (activeTab === "profile") setActiveTab("clinical");
                    if (activeTab === "clinical") setActiveTab("fees");
                    if (activeTab === "fees") setActiveTab("schedule");
                  }}
                  className="text-xs gap-1 bg-primary text-primary-foreground font-semibold"
                >
                  Next Step
                  <Icon icon="solar:arrow-right-bold" size={14} />
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  onClick={handleSave}
                  disabled={saving || !canCreate || !form.first_name.trim()}
                  className="text-xs gap-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold px-6 shadow-md"
                >
                  <Icon icon="solar:check-circle-bold" size={15} />
                  Complete Registration
                </Button>
              )}
            </div>
          )}
        </div>

        {/* ════════ Right Column: Live Doctor Card Preview & Checklist (4 Cols) ════════ */}
        <div className="lg:col-span-4 space-y-5 sticky top-6">
          {/* Dual-Mode Live Preview Card */}
          <div className="rounded-2xl border bg-card p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Icon icon="solar:eye-bold" size={14} className="text-primary" />
                Live Preview
              </span>

              {/* Toggle Mode: Directory Card vs Hospital ID Badge */}
              <div className="inline-flex rounded-lg border bg-muted/40 p-0.5 text-[10px]">
                <button
                  type="button"
                  onClick={() => setPreviewMode("card")}
                  className={cn(
                    "px-2 py-0.5 rounded font-semibold transition-all",
                    previewMode === "card"
                      ? "bg-background text-foreground font-bold shadow-2xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Directory Card
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewMode("id_badge")}
                  className={cn(
                    "px-2 py-0.5 rounded font-semibold transition-all",
                    previewMode === "id_badge"
                      ? "bg-background text-foreground font-bold shadow-2xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Staff Badge
                </button>
              </div>
            </div>

            {/* ─── Mode A: Directory Card View ─── */}
            {previewMode === "card" && (
              <div className="rounded-xl border bg-background/95 shadow-2xs overflow-hidden transition-all">
                {/* Header Gradient Ribbon */}
                <div
                  className={cn(
                    "h-14 bg-gradient-to-r p-3 flex items-center justify-between relative",
                    departmentStyle.gradient
                  )}
                >
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border truncate max-w-[170px] shadow-2xs",
                      departmentStyle.bg
                    )}
                  >
                    <Icon icon={departmentStyle.icon} size={11} className="shrink-0" />
                    <span className="truncate">
                      {selectedDepartment?.department || "Department Pending"}
                    </span>
                  </span>

                  <span
                    className={cn(
                      "text-[10px] font-bold px-2 py-0.5 rounded-full border shadow-2xs",
                      form.status === "Active"
                        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                        : "bg-muted text-muted-foreground border-border"
                    )}
                  >
                    {form.status}
                  </span>
                </div>

                <div className="p-4 space-y-3.5 -mt-6">
                  {/* Identity Row with Avatar & Name */}
                  <div className="flex items-end gap-3">
                    <div className="relative shrink-0">
                      <Avatar
                        name={fullDoctorName}
                        initials={initials}
                        src={form.image || undefined}
                        size="doc"
                        tone="blue"
                        className="border-2 border-background shadow-md shrink-0"
                      />
                      <span
                        className={cn(
                          "absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-background",
                          form.status === "Active" ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground"
                        )}
                        title={form.status}
                      />
                    </div>

                    <div className="min-w-0 flex-1 pb-1">
                      <div className="flex items-center gap-1 text-[10px] text-blue-600 dark:text-blue-400 font-bold">
                        <Icon icon="solar:verified-check-bold" size={13} />
                        <span>Verified Practitioner</span>
                      </div>
                      <h4 className="font-extrabold text-sm text-foreground truncate">
                        {fullDoctorName}
                      </h4>
                      <p className="text-xs text-muted-foreground truncate font-medium">
                        {form.designation || "Healthcare Practitioner"}
                      </p>
                    </div>
                  </div>

                  {/* Rating & Review Simulated Bar */}
                  <div className="flex items-center justify-between text-xs py-1 px-2.5 rounded-lg bg-muted/40 border border-border/40">
                    <div className="flex items-center gap-1">
                      <div className="flex text-amber-500">
                        {"★★★★★".split("").map((star, i) => (
                          <span key={i} className="text-xs leading-none">
                            {star}
                          </span>
                        ))}
                      </div>
                      <span className="font-bold text-foreground text-xs ml-1">4.9</span>
                      <span className="text-[10px] text-muted-foreground">(128 reviews)</span>
                    </div>
                    <Badge variant="outline" className="text-[9px] font-mono px-1.5 py-0">
                      {form.practitioner_type}
                    </Badge>
                  </div>

                  {/* Sub-specialties Pill Bar */}
                  {form.subspecialties.length > 0 && (
                    <div className="flex items-center gap-1 flex-wrap pt-0.5">
                      {form.subspecialties.slice(0, 3).map((sub) => (
                        <span
                          key={sub}
                          className="text-[9px] font-medium px-2 py-0.5 rounded-full bg-muted/60 text-muted-foreground border border-border/60"
                        >
                          {sub}
                        </span>
                      ))}
                      {form.subspecialties.length > 3 && (
                        <span className="text-[9px] text-muted-foreground font-semibold">
                          +{form.subspecialties.length - 3} more
                        </span>
                      )}
                    </div>
                  )}

                  {/* Fee Bar */}
                  <div className="p-2.5 rounded-lg bg-muted/30 border border-border/50 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-[10px] text-muted-foreground block font-medium">
                        Outpatient Consult
                      </span>
                      <span className="font-mono font-bold text-xs text-foreground">
                        ${Number(form.op_consulting_charge || 0).toFixed(2)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground block font-medium">
                        Inpatient Round
                      </span>
                      <span className="font-mono font-bold text-xs text-foreground">
                        ${Number(form.inpatient_visit_charge || 0).toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Location & Schedule summary */}
                  <div className="space-y-1 text-xs text-muted-foreground pt-1 border-t border-border/40">
                    <div className="flex items-center gap-1.5 text-[11px] truncate">
                      <Icon icon="solar:map-point-bold" size={12} className="text-rose-500 shrink-0" />
                      <span className="truncate">{form.office_room || form.hospital || "Room unassigned"}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] truncate">
                      <Icon icon="solar:calendar-date-bold" size={12} className="text-purple-500 shrink-0" />
                      <span className="truncate">
                        {form.schedule_days.length > 0
                          ? `${form.schedule_days.length} Days/Wk • ${form.start_time} - ${form.end_time}`
                          : "Schedule pending"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] truncate">
                      <Icon icon="solar:phone-bold" size={12} className="text-emerald-500 shrink-0" />
                      <span className="font-mono truncate">{form.mobile_phone || "Phone unassigned"}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] truncate">
                      <Icon icon="solar:letter-bold" size={12} className="text-blue-500 shrink-0" />
                      <span className="truncate">{form.email || "Email unassigned"}</span>
                    </div>
                  </div>

                  {/* Simulated Action Buttons */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs font-semibold gap-1 pointer-events-none opacity-80"
                    >
                      <Icon icon="solar:calendar-bold" size={13} />
                      Book Visit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs font-semibold gap-1 pointer-events-none opacity-80"
                    >
                      <Icon icon="solar:letter-bold" size={13} />
                      Message
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* ─── Mode B: Hospital Staff ID Badge View ─── */}
            {previewMode === "id_badge" && (
              <div className="rounded-2xl border-2 border-border/80 bg-gradient-to-b from-card via-background to-card shadow-lg p-4 space-y-3.5 relative overflow-hidden">
                {/* Holographic Header Band */}
                <div className="flex items-center justify-between border-b pb-2.5">
                  <div className="flex items-center gap-2">
                    <div className="p-1 rounded bg-blue-600 text-white">
                      <Icon icon="solar:hospital-bold" size={14} />
                    </div>
                    <div>
                      <div className="text-[10px] font-extrabold tracking-wider uppercase text-foreground leading-none">
                        METROPOLITAN HEALTH
                      </div>
                      <div className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5">
                        Clinical Staff Credential
                      </div>
                    </div>
                  </div>
                  <div className="w-5 h-5 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center">
                    <span className="text-[8px] font-bold text-amber-600">RFID</span>
                  </div>
                </div>

                {/* Badge Center: Portrait + Name */}
                <div className="flex flex-col items-center text-center space-y-2 pt-1">
                  <div className="p-1 rounded-2xl border-2 border-primary/40 bg-background shadow-md">
                    <Avatar
                      name={fullDoctorName}
                      initials={initials}
                      src={form.image || undefined}
                      size="2xl"
                      tone="blue"
                      className="rounded-xl w-24 h-24"
                    />
                  </div>

                  <div>
                    <h3 className="font-extrabold text-sm text-foreground">{fullDoctorName}</h3>
                    <p className="text-xs font-semibold text-primary">
                      {form.designation || "Healthcare Practitioner"}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {selectedDepartment?.department || "General Medicine"}
                    </p>
                  </div>
                </div>

                {/* Access Clearance & Provider Code */}
                <div className="p-2 rounded-lg bg-muted/40 border border-border/60 text-center space-y-0.5">
                  <div className="text-[9px] font-extrabold tracking-wider uppercase text-muted-foreground">
                    ACCESS CLEARANCE
                  </div>
                  <div className="text-xs font-black text-foreground">
                    LEVEL 4 • ALL WARDS & SURGERY
                  </div>
                </div>

                {/* Simulated Barcode */}
                <div className="pt-1 text-center space-y-1">
                  <div className="h-7 w-full bg-foreground/10 rounded flex items-center justify-center font-mono text-[9px] tracking-widest text-muted-foreground select-none">
                    ||| | |||| | ||| || ||||| | ||||
                  </div>
                  <div className="flex items-center justify-between text-[9px] font-mono text-muted-foreground">
                    <span>ID: HLC-PRA-NEW</span>
                    <span>EXP: 2028-12-31</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Registration Intake Checklist Card */}
          <div className="rounded-2xl border bg-card p-5 shadow-xs space-y-3.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Icon icon="solar:clipboard-check-bold" size={14} className="text-emerald-600" />
                Intake Readiness
              </span>
              <span className="text-xs font-extrabold text-foreground">
                {completeness.percentage}%
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-500 transition-all duration-300"
                style={{ width: `${completeness.percentage}%` }}
              />
            </div>

            <div className="space-y-2 pt-1">
              {completeness.items.map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setViewMode("tabs");
                    setActiveTab(item.step);
                  }}
                  className="w-full flex items-center justify-between text-xs hover:bg-muted/40 p-1 rounded-md transition-colors text-left"
                >
                  <span
                    className={cn(
                      "flex items-center gap-2",
                      item.done ? "text-foreground font-medium" : "text-muted-foreground"
                    )}
                  >
                    <Icon
                      icon={item.done ? "solar:check-circle-bold" : "solar:clock-circle-linear"}
                      size={14}
                      className={item.done ? "text-emerald-600 shrink-0" : "text-muted-foreground/60 shrink-0"}
                    />
                    <span className="truncate">{item.label}</span>
                  </span>
                  <span
                    className={cn(
                      "text-[10px] font-mono shrink-0",
                      item.done ? "text-emerald-600 font-bold" : "text-muted-foreground"
                    )}
                  >
                    {item.done ? "Ready" : "Pending"}
                  </span>
                </button>
              ))}
            </div>

            <Separator className="my-2" />

            <Button
              onClick={handleSave}
              disabled={saving || !canCreate || !form.first_name.trim()}
              className="w-full h-9 text-xs font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md shadow-blue-500/20"
            >
              {saving ? "Saving..." : "Save & Register Practitioner"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
