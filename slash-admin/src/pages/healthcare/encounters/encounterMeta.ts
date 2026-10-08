/**
 * The encounter form's readers over its server-side field definitions.
 *
 * The helpers now live in `@/utils/doctypeMeta` because the lab test template
 * form needs the same ones; this module keeps the encounter's import path
 * working.
 */

export {
  fieldMeta,
  fieldOptions,
  isRequired,
  isReadOnly,
  fieldVisible,
  fieldMandatory,
  fieldReadOnly,
} from "@/utils/doctypeMeta";
