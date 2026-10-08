/**
 * A new Lab Test, opened in the Marley-shaped form.
 *
 * `lab-test-form.tsx` carries the whole form — this page exists so the
 * `/new` route can name its own component, the way the Lab Test Template
 * pages do.
 */
import LabTestForm from "./lab-test-form";

export default function LabTestCreatePage() {
  return <LabTestForm />;
}
