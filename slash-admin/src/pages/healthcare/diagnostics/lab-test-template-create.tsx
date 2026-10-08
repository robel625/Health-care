/**
 * New Lab Test Template.
 *
 * The form itself is shared with the existing-template page — see
 * `lab-test-template-form.tsx`. This page exists so the `/new` route can name
 * its own screen, as the encounter pages do.
 */
import LabTestTemplateForm from "./lab-test-template-form";

export default function LabTestTemplateCreatePage() {
  return <LabTestTemplateForm />;
}
