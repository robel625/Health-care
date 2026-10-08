/**
 * An existing Lab Test, opened for editing.
 *
 * Marley opens the saved document in the same form it was created in, so this
 * page hands the id to the shared form rather than reimplementing it.
 */
import { useParams } from "react-router";
import LabTestForm from "./lab-test-form";

export default function LabTestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const testId = id ? Number(id) : undefined;
  return <LabTestForm testId={testId} />;
}
