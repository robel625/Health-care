"""
Doctype field definitions for the encounter form.

Frappe builds its forms from the doctype JSON: labels, required flags, Link
targets and — crucially — the `options` of every Select live in the doctype
definition, and the client reads them from the server. This module is the same
idea for our React form: a declarative, server-side description of Patient
Encounter and the five child tables it renders, so the component doesn't carry
its own hardcoded copies of `Source`, `Series` or `Interval UOM`.

Transcribed from Marley's `patient_encounter.json` and the child doctypes
`drug_prescription`, `lab_prescription`, `procedure_prescription`,
`therapy_plan_detail` and `codification_table`. `fetch_from` entries are kept
verbatim because they document which field the server denormalises into which —
the child serializers implement exactly those chains.

Served by `PatientEncounterViewSet.meta` at
`GET /api/healthcare/encounters/meta/`.
"""

# ── Patient Encounter ───────────────────────────────────────────────────────
# Only the fields the form renders. Layout breaks are omitted: the React form
# lays itself out.

ENCOUNTER_FIELDS = [
    {"fieldname": "naming_series", "fieldtype": "Select", "label": "Series",
     "options": ["HLC-ENC-.YYYY.-"]},
    {"fieldname": "company", "fieldtype": "Link", "label": "Company",
     "options": "Company"},
    {"fieldname": "appointment", "fieldtype": "Link", "label": "Appointment",
     "options": "Patient Appointment"},
    {"fieldname": "patient", "fieldtype": "Link", "label": "Patient",
     "options": "Patient", "reqd": True},
    {"fieldname": "patient_name", "fieldtype": "Data", "label": "Patient Name",
     "read_only": True, "fetch_from": "patient.patient_name"},
    {"fieldname": "patient_age", "fieldtype": "Data", "label": "Age",
     "read_only": True, "fetch_from": "patient.patient_age"},
    {"fieldname": "patient_sex", "fieldtype": "Data", "label": "Gender",
     "read_only": True, "fetch_from": "patient.sex"},
    {"fieldname": "practitioner", "fieldtype": "Link",
     "label": "Healthcare Practitioner", "options": "Healthcare Practitioner",
     "reqd": True},
    {"fieldname": "practitioner_name", "fieldtype": "Data",
     "label": "Practitioner Name", "read_only": True,
     "fetch_from": "practitioner.practitioner_name"},
    {"fieldname": "encounter_date", "fieldtype": "Date", "label": "Encounter Date",
     "reqd": True},
    {"fieldname": "encounter_time", "fieldtype": "Time", "label": "Encounter Time",
     "reqd": True},
    {"fieldname": "invoiced", "fieldtype": "Check", "label": "Invoiced",
     "read_only": True},
    {"fieldname": "appointment_type", "fieldtype": "Link",
     "label": "Appointment Type", "options": "Appointment Type", "reqd": True},
    # Marley makes the department read-only and fetched from the practitioner —
    # the encounter happens wherever the practitioner is based.
    {"fieldname": "department", "fieldtype": "Link", "label": "Department",
     "options": "Medical Department", "read_only": True,
     "fetch_from": "practitioner.department"},
    # Encounter Impression
    {"fieldname": "symptoms", "fieldtype": "Table MultiSelect", "label": "Symptoms",
     "options": "Patient Encounter Symptom"},
    {"fieldname": "symptoms_in_print", "fieldtype": "Check", "label": "In print"},
    {"fieldname": "diagnosis", "fieldtype": "Table MultiSelect", "label": "Diagnosis",
     "options": "Patient Encounter Diagnosis"},
    {"fieldname": "diagnosis_in_print", "fieldtype": "Check", "label": "In print"},
    # Source
    {"fieldname": "source", "fieldtype": "Select", "label": "Source",
     "options": ["Direct", "Referral", "External Referral"]},
    {"fieldname": "referring_practitioner", "fieldtype": "Link",
     "label": "Referring Practitioner", "options": "Healthcare Practitioner"},
    # Review Details — inside the Procedures section, after the grid.
    {"fieldname": "encounter_comment", "fieldtype": "Small Text",
     "label": "Review Details"},
    {"fieldname": "status", "fieldtype": "Select", "label": "Status",
     "read_only": True,
     "options": ["Open", "Ordered", "Completed", "Cancelled"]},
    {"fieldname": "submit_orders_on_save", "fieldtype": "Check",
     "label": "Submit Orders on Save"},
]

# ── Child tables ────────────────────────────────────────────────────────────
# Keyed by the encounter fieldname, as Marley names them.

CHILD_TABLES = {
    "codification_table": {
        "doctype": "Codification Table",
        "label": "Medical Codes",
        "fields": [
            {"fieldname": "code_system", "fieldtype": "Link", "label": "Code System",
             "options": "Code System", "reqd": True},
            {"fieldname": "system", "fieldtype": "Data", "label": "System",
             "read_only": True, "fetch_from": "code_system.uri"},
            {"fieldname": "is_fhir_defined", "fieldtype": "Check",
             "label": "Is FHIR Defined", "read_only": True},
            {"fieldname": "oid", "fieldtype": "Data", "label": "OID",
             "read_only": True, "fetch_from": "code_system.oid"},
            {"fieldname": "code_value", "fieldtype": "Link", "label": "Code Value",
             "options": "Code Value", "reqd": True},
            {"fieldname": "code", "fieldtype": "Data", "label": "Code", "reqd": True,
             "read_only": True, "fetch_from": "code_value.code_value"},
            {"fieldname": "display", "fieldtype": "Data", "label": "Display",
             "read_only": True, "fetch_from": "code_value.display"},
            {"fieldname": "definition", "fieldtype": "Small Text",
             "label": "Definition", "read_only": True,
             "fetch_from": "code_value.definition"},
        ],
    },
    "drug_prescription": {
        "doctype": "Drug Prescription",
        "label": "Drug Prescription",
        "fields": [
            {"fieldname": "medication", "fieldtype": "Link", "label": "Medication",
             "options": "Medication"},
            {"fieldname": "drug_code", "fieldtype": "Link", "label": "Drug Code",
             "options": "Item"},
            {"fieldname": "drug_name", "fieldtype": "Data",
             "label": "Drug Name / Description", "read_only": True,
             "fetch_from": "drug_code.item_name"},
            # These four are Links in Marley whose value the medication's own
            # defaults pre-fill.
            {"fieldname": "dosage", "fieldtype": "Link", "label": "Dosage",
             "options": "Prescription Dosage",
             "fetch_from": "medication.default_prescription_dosage"},
            {"fieldname": "period", "fieldtype": "Link", "label": "Period",
             "options": "Prescription Duration", "reqd": True,
             "fetch_from": "medication.default_prescription_duration"},
            {"fieldname": "dosage_form", "fieldtype": "Link", "label": "Dosage Form",
             "options": "Dosage Form", "reqd": True,
             "fetch_from": "medication.dosage_form"},
            {"fieldname": "strength", "fieldtype": "Float", "label": "Strength",
             "fetch_from": "medication.strength"},
            {"fieldname": "interval", "fieldtype": "Int", "label": "Interval",
             "fetch_from": "medication.default_interval"},
            {"fieldname": "interval_uom", "fieldtype": "Select",
             "label": "Interval UOM", "options": ["Hour", "Day"],
             "fetch_from": "medication.default_interval_uom"},
            {"fieldname": "comment", "fieldtype": "Small Text", "label": "Comment"},
            {"fieldname": "update_schedule", "fieldtype": "Check",
             "label": "Update Schedule", "default": True},
            {"fieldname": "dosage_by_interval", "fieldtype": "Check",
             "label": "Dosage by Time Interval", "default": False},
            {"fieldname": "number_of_repeats_allowed", "fieldtype": "Float",
             "label": "Number Of Repeats Allowed"},
            {"fieldname": "intent", "fieldtype": "Link", "label": "Intent",
             "options": "Code Value", "code_system": "Intent"},
            {"fieldname": "priority", "fieldtype": "Link", "label": "Priority",
             "options": "Code Value", "code_system": "Priority"},
        ],
    },
    "lab_test_prescription": {
        "doctype": "Lab Prescription",
        "label": "Lab Tests",
        "fields": [
            {"fieldname": "lab_test_code", "fieldtype": "Link", "label": "Lab Test",
             "options": "Lab Test Template"},
            {"fieldname": "lab_test_name", "fieldtype": "Data", "label": "Lab Test Name",
             "fetch_from": "lab_test_code.lab_test_name"},
            {"fieldname": "lab_test_comment", "fieldtype": "Small Text",
             "label": "Comments"},
            {"fieldname": "observation_template", "fieldtype": "Link",
             "label": "Observation", "options": "Observation Template"},
            {"fieldname": "patient_care_type", "fieldtype": "Link",
             "label": "Patient Care Type", "options": "Patient Care Type"},
            {"fieldname": "intent", "fieldtype": "Link", "label": "Intent",
             "options": "Code Value", "code_system": "Intent"},
            {"fieldname": "priority", "fieldtype": "Link", "label": "Priority",
             "options": "Code Value", "code_system": "Priority"},
        ],
    },
    "procedure_prescription": {
        "doctype": "Procedure Prescription",
        "label": "Clinical Procedures",
        "fields": [
            {"fieldname": "procedure", "fieldtype": "Link",
             "label": "Clinical Procedure", "options": "Clinical Procedure Template",
             "reqd": True},
            {"fieldname": "procedure_name", "fieldtype": "Data",
             "label": "Procedure Name", "fetch_from": "procedure.template"},
            {"fieldname": "department", "fieldtype": "Link", "label": "Department",
             "options": "Medical Department",
             "fetch_from": "procedure.medical_department"},
            {"fieldname": "practitioner", "fieldtype": "Link",
             "label": "Referring Practitioner", "options": "Healthcare Practitioner"},
            {"fieldname": "date", "fieldtype": "Date", "label": "Date"},
            {"fieldname": "comments", "fieldtype": "Data", "label": "Comments"},
            {"fieldname": "no_of_sessions", "fieldtype": "Int",
             "label": "No of Sessions", "default": 1},
            {"fieldname": "interval", "fieldtype": "Duration", "label": "Interval"},
            {"fieldname": "patient_care_type", "fieldtype": "Link",
             "label": "Patient Care Type", "options": "Patient Care Type"},
            {"fieldname": "intent", "fieldtype": "Link", "label": "Intent",
             "options": "Code Value", "code_system": "Intent"},
            {"fieldname": "priority", "fieldtype": "Link", "label": "Priority",
             "options": "Code Value", "code_system": "Priority"},
        ],
    },
    "therapies": {
        "doctype": "Therapy Plan Detail",
        "label": "Therapies",
        "fields": [
            {"fieldname": "therapy_type", "fieldtype": "Link", "label": "Therapy Type",
             "options": "Therapy Type", "reqd": True},
            {"fieldname": "no_of_sessions", "fieldtype": "Int",
             "label": "No of Sessions"},
            {"fieldname": "interval", "fieldtype": "Duration", "label": "Interval"},
            {"fieldname": "patient_care_type", "fieldtype": "Link",
             "label": "Patient Care Type", "options": "Patient Care Type"},
            {"fieldname": "intent", "fieldtype": "Link", "label": "Intent",
             "options": "Code Value", "code_system": "Intent"},
            {"fieldname": "priority", "fieldtype": "Link", "label": "Priority",
             "options": "Code Value", "code_system": "Priority"},
        ],
    },
}


def encounter_form_meta() -> dict:
    """The payload `PatientEncounterViewSet.meta` returns."""
    return {
        "doctype": "Patient Encounter",
        "fields": ENCOUNTER_FIELDS,
        "child_tables": CHILD_TABLES,
    }


# ══════════════════════════════════════════════════════════════════════════════
# LAB TEST TEMPLATE
# ══════════════════════════════════════════════════════════════════════════════
# Transcribed from Marley's `lab_test_template.json` and the child doctypes
# `normal_test_template`, `descriptive_test_template`, `lab_test_group_template`
# and `codification_table`. Served by `LabTestTemplateViewSet.meta` at
# `GET /api/healthcare/lab-test-templates/meta/`.
#
# The list is in Marley's `field_order`, layout breaks included. Those breaks
# are not decoration: a Section Break or Tab Break carrying `depends_on` is what
# shows or hides everything under it — that is how Marley gates the Lab Routine
# section on `Single`, the Compound grid on `Compound`, and the whole Sample
# Collection tab off for `Imaging`. Dropping them would leave the form unable to
# answer "is this section visible?" from the server, so they are carried here
# with their labels and their conditions. The pure-layout breaks that carry no
# condition (the `column_break_*` dividers, and the Heading fieldtype
# `heading_text`) are omitted — the React form lays those out itself.

LAB_TEST_TEMPLATE_FIELDS = [
    {"fieldname": "lab_test_name", "fieldtype": "Data", "label": "Test Name",
     "reqd": True},
    {"fieldname": "department", "fieldtype": "Link", "label": "Department",
     "options": "Medical Department", "reqd": True},
    {"fieldname": "disabled", "fieldtype": "Check", "label": "Disabled"},
    {"fieldname": "nursing_checklist_template", "fieldtype": "Link",
     "label": "Nursing Checklist Template",
     "options": "Nursing Checklist Template"},

    # ── Billing ───────────────────────────────────────────────────────────
    # `link_existing_item` is only offered while the document is new, and the
    # two item fields swap between writable and read-only depending on it.
    {"fieldname": "billing_section", "fieldtype": "Section Break",
     "label": "Billing"},
    {"fieldname": "link_existing_item", "fieldtype": "Check",
     "label": "Link existing Item", "depends_on": "eval: doc.__islocal"},
    {"fieldname": "item", "fieldtype": "Link", "label": "Item", "options": "Item",
     "depends_on": "eval: !doc.__islocal || doc.link_existing_item",
     "mandatory_depends_on": "eval:doc.link_existing_item",
     "read_only_depends_on": "eval: !doc.__islocal"},
    {"fieldname": "lab_test_code", "fieldtype": "Data", "label": "Item Code",
     "mandatory_depends_on": "eval:!doc.link_existing_item",
     "read_only_depends_on": "eval:!doc.__islocal"},
    {"fieldname": "lab_test_group", "fieldtype": "Link", "label": "Item Group",
     "options": "Item Group", "reqd": True},
    {"fieldname": "is_billable", "fieldtype": "Check", "label": "Is Billable",
     "default": 1,
     "depends_on": "eval:doc.lab_test_template_type != 'Grouped' && (!doc.link_existing_item || !doc.__islocal);",
     "description": "If unchecked, the item will not be available in Sales Invoices for billing but can be used in group test creation."},
    {"fieldname": "lab_test_rate", "fieldtype": "Currency", "label": "Rate",
     "depends_on": "eval:doc.is_billable && (!doc.link_existing_item || !doc.__islocal)",
     "mandatory_depends_on": "eval:doc.is_billable && !doc.link_existing_item",
     "description": "This value is updated in the Default Sales Price List."},

    # ── Description ───────────────────────────────────────────────────────
    {"fieldname": "section_break_description", "fieldtype": "Section Break",
     "label": "Description", "collapsible": True},
    {"fieldname": "lab_test_description", "fieldtype": "Text Editor",
     "label": "Description",
     "depends_on": "eval:doc.lab_test_template_type == 'Imaging'"},

    # ── Result Format tab ─────────────────────────────────────────────────
    {"fieldname": "result_format_tab", "fieldtype": "Tab Break",
     "label": "Result Format"},
    {"fieldname": "result_format_section", "fieldtype": "Section Break",
     "label": "Result Format"},
    {"fieldname": "lab_test_template_type", "fieldtype": "Select",
     "label": "Result Format", "default": "Single",
     "options": ["Single", "Compound", "Descriptive", "Grouped", "Imaging",
                 "No Result"],
     "description": (
         "Single: Results which require only a single input.\n"
         "Compound: Results which require multiple event inputs.\n"
         "Descriptive: Tests which have multiple result components with manual "
         "result entry.\n"
         "Grouped: Test templates which are a group of other test templates.\n"
         "Imaging: Tests which have an image as a result.\n"
         "No Result: Tests with no results, can be ordered and billed but no "
         "Lab Test will be created."
     )},
    {"fieldname": "section_break_descriptive_result", "fieldtype": "Section Break",
     "label": "Descriptive Result",
     "depends_on": "eval:doc.lab_test_template_type == 'Imaging'"},
    {"fieldname": "descriptive_result", "fieldtype": "Text Editor",
     "label": "Descriptive Result"},
    {"fieldname": "section_break_normal", "fieldtype": "Section Break",
     "label": "Lab Routine",
     "depends_on": "eval:doc.lab_test_template_type == 'Single'"},
    {"fieldname": "lab_test_uom", "fieldtype": "Link", "label": "UOM",
     "options": "Lab Test UOM"},
    {"fieldname": "secondary_uom", "fieldtype": "Link", "label": "Secondary UOM",
     "options": "Lab Test UOM"},
    # Marley writes these two without the `doc.` prefix; the reader treats a
    # bare name as a field of the document.
    {"fieldname": "conversion_factor", "fieldtype": "Float",
     "label": "Conversion Factor", "depends_on": "secondary_uom",
     "mandatory_depends_on": "secondary_uom"},
    {"fieldname": "lab_test_normal_range", "fieldtype": "Long Text",
     "label": "Normal Range"},
    {"fieldname": "section_break_compound", "fieldtype": "Section Break",
     "label": "Compound",
     "depends_on": "eval:doc.lab_test_template_type == 'Compound'"},
    {"fieldname": "normal_test_templates", "fieldtype": "Table",
     "label": "Compound", "options": "Normal Test Template"},
    {"fieldname": "section_break_special", "fieldtype": "Section Break",
     "label": "Descriptive Test",
     "depends_on": "eval:doc.lab_test_template_type == 'Descriptive'"},
    {"fieldname": "sensitivity", "fieldtype": "Check", "label": "Sensitivity",
     "default": 0},
    {"fieldname": "descriptive_test_templates", "fieldtype": "Table",
     "label": "Descriptive Test", "options": "Descriptive Test Template"},
    {"fieldname": "section_break_group", "fieldtype": "Section Break",
     "label": "Group Tests",
     "depends_on": "eval:doc.lab_test_template_type == 'Grouped'"},
    {"fieldname": "lab_test_groups", "fieldtype": "Table", "label": "Group Tests",
     "options": "Lab Test Group Template"},

    # ── Sample Collection tab ─────────────────────────────────────────────
    # Gated on the Tab Break, not on any one field inside it.
    {"fieldname": "sample_collection_tab", "fieldtype": "Tab Break",
     "label": "Sample Collection",
     "depends_on": "eval:doc.lab_test_template_type != 'Imaging'"},
    {"fieldname": "sb_sample_collection", "fieldtype": "Section Break",
     "label": "Sample Collection", "collapsible": True},
    {"fieldname": "sample", "fieldtype": "Link", "label": "Sample",
     "options": "Lab Test Sample"},
    {"fieldname": "sample_uom", "fieldtype": "Data", "label": "UOM",
     "read_only": True, "fetch_from": "sample.sample_uom"},
    {"fieldname": "sample_qty", "fieldtype": "Float", "label": "Quantity",
     "default": 0},
    {"fieldname": "sample_details", "fieldtype": "Small Text",
     "label": "Collection Details"},

    # ── Medical Coding tab ────────────────────────────────────────────────
    {"fieldname": "codification", "fieldtype": "Tab Break",
     "label": "Medical Coding"},
    {"fieldname": "codification_table", "fieldtype": "Table",
     "label": "", "options": "Codification Table"},

    # ── Worksheet & Legend tab ────────────────────────────────────────────
    {"fieldname": "worksheet_legend_tab", "fieldtype": "Tab Break",
     "label": "Worksheet & Legend"},
    {"fieldname": "worksheet_section", "fieldtype": "Section Break",
     "label": "Worksheet Print"},
    {"fieldname": "worksheet_instructions", "fieldtype": "Text Editor",
     "label": "Worksheet Instructions",
     "description": "Instructions to be printed on the worksheet"},
    {"fieldname": "result_legend_section", "fieldtype": "Section Break",
     "label": "Result Legend Print", "collapsible": True,
     "description": "Information to help easily interpret the test report, will be printed as part of the Lab Test result."},
    {"fieldname": "legend_print_position", "fieldtype": "Select",
     "label": "Print Position", "default": "Bottom",
     "options": ["Bottom", "Top", "Both"]},
    {"fieldname": "result_legend", "fieldtype": "Text Editor",
     "label": "Result Legend"},
    {"fieldname": "service_request_defaults_section", "fieldtype": "Section Break",
     "label": "Service Request Defaults", "collapsible": True},
    # Marley's `fetch_from: service_request_category.patient_care_type` points at
    # a field its own Lab Test Template does not have, so there is nothing to
    # fetch here; the Link itself is what matters.
    {"fieldname": "patient_care_type", "fieldtype": "Link",
     "label": "Patient Care Type", "options": "Patient Care Type"},
    {"fieldname": "staff_role", "fieldtype": "Link", "label": "Staff Role",
     "options": "Role"},
    {"fieldname": "change_in_item", "fieldtype": "Check",
     "label": "Change In Item", "default": 0, "hidden": True},
]

LAB_TEST_TEMPLATE_CHILD_TABLES = {
    "normal_test_templates": {
        "doctype": "Normal Test Template",
        "label": "Compound",
        "fields": [
            # `heading_text` is a Heading fieldtype in Marley — a layout label,
            # so it is not carried here.
            {"fieldname": "lab_test_event", "fieldtype": "Data", "label": "Event"},
            {"fieldname": "lab_test_uom", "fieldtype": "Link",
             "label": "UOM", "options": "Lab Test UOM"},
            {"fieldname": "normal_range", "fieldtype": "Long Text",
             "label": "Normal Range"},
            {"fieldname": "secondary_uom", "fieldtype": "Link",
             "label": "Secondary UOM", "options": "Lab Test UOM"},
            {"fieldname": "conversion_factor", "fieldtype": "Float",
             "label": "Conversion Factor", "depends_on": "secondary_uom",
             "mandatory_depends_on": "secondary_uom"},
            {"fieldname": "allow_blank", "fieldtype": "Check",
             "label": "Allow Blank", "default": 0},
        ],
    },
    "descriptive_test_templates": {
        "doctype": "Descriptive Test Template",
        "label": "Descriptive Test",
        "fields": [
            {"fieldname": "particulars", "fieldtype": "Data",
             "label": "Result Component"},
            {"fieldname": "allow_blank", "fieldtype": "Check",
             "label": "Allow Blank", "default": 0},
        ],
    },
    "lab_test_groups": {
        "doctype": "Lab Test Group Template",
        "label": "Group Tests",
        "fields": [
            {"fieldname": "template_or_new_line", "fieldtype": "Select",
             "label": "", "default": "Add Test",
             "options": ["Add Test", "Add New Line"]},
            {"fieldname": "lab_test_template", "fieldtype": "Link",
             "label": "Test", "options": "Lab Test Template",
             "depends_on": "eval:doc.template_or_new_line == 'Add Test'"},
            # Marley fetches both from the linked template and marks them
            # read-only.
            {"fieldname": "lab_test_rate", "fieldtype": "Currency",
             "label": "Rate", "read_only": True,
             "fetch_from": "lab_test_template.lab_test_rate"},
            {"fieldname": "lab_test_description", "fieldtype": "Data",
             "label": "Description", "read_only": True,
             "fetch_from": "lab_test_template.lab_test_description"},
            {"fieldname": "group_event", "fieldtype": "Data", "label": "Event",
             "depends_on": "eval:doc.template_or_new_line == 'Add New Line'"},
            {"fieldname": "group_test_uom", "fieldtype": "Link",
             "label": "UOM", "options": "Lab Test UOM",
             "depends_on": "eval:doc.template_or_new_line == 'Add New Line'"},
            {"fieldname": "group_test_normal_range", "fieldtype": "Long Text",
             "label": "Normal Range",
             "depends_on": "eval:doc.template_or_new_line == 'Add New Line'"},
            {"fieldname": "secondary_uom", "fieldtype": "Link",
             "label": "Secondary UOM", "options": "Lab Test UOM",
             "depends_on": "eval:doc.template_or_new_line == 'Add New Line'"},
            {"fieldname": "conversion_factor", "fieldtype": "Float",
             "label": "Conversion Factor", "depends_on": "secondary_uom",
             "mandatory_depends_on": "secondary_uom"},
            {"fieldname": "allow_blank", "fieldtype": "Check",
             "label": "Allow Blank", "default": 0,
             "depends_on": "eval:doc.template_or_new_line == 'Add New Line'"},
        ],
    },
    # Shared with Patient Encounter — same child doctype, same fields.
    "codification_table": {
        "doctype": "Codification Table",
        "label": "Medical Codes",
        "fields": [
            {"fieldname": "code_system", "fieldtype": "Link",
             "label": "Code System", "options": "Code System", "reqd": True},
            {"fieldname": "system", "fieldtype": "Data", "label": "System",
             "read_only": True, "fetch_from": "code_system.uri"},
            {"fieldname": "is_fhir_defined", "fieldtype": "Check",
             "label": "Is FHIR Defined", "read_only": True, "default": 0},
            {"fieldname": "oid", "fieldtype": "Data", "label": "OID",
             "read_only": True, "fetch_from": "code_system.oid"},
            {"fieldname": "code_value", "fieldtype": "Link",
             "label": "Code Value", "options": "Code Value", "reqd": True},
            {"fieldname": "code", "fieldtype": "Data", "label": "Code",
             "reqd": True, "read_only": True,
             "fetch_from": "code_value.code_value"},
            {"fieldname": "display", "fieldtype": "Data", "label": "Display",
             "read_only": True, "fetch_from": "code_value.display"},
            {"fieldname": "definition", "fieldtype": "Small Text",
             "label": "Definition", "read_only": True,
             "fetch_from": "code_value.definition"},
        ],
    },
}


def lab_test_template_form_meta() -> dict:
    """The payload `LabTestTemplateViewSet.meta` returns."""
    return {
        "doctype": "Lab Test Template",
        "fields": LAB_TEST_TEMPLATE_FIELDS,
        "child_tables": LAB_TEST_TEMPLATE_CHILD_TABLES,
    }
