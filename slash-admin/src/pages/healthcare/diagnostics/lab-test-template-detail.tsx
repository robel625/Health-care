/**
 * An existing Lab Test Template, opened for editing.
 *
 * Marley opens the saved document in the same form it was created in, so this
 * page hands the id to the shared form rather than reimplementing it.
 */
import { useParams } from "react-router";
import LabTestTemplateForm from "./lab-test-template-form";

export default function LabTestTemplateDetailPage() {
  const { id } = useParams<{ id: string }>();
  const templateId = id ? Number(id) : undefined;
  return <LabTestTemplateForm templateId={templateId} />;
}
