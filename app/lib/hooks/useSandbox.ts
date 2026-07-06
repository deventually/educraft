import { useState } from "react";
import type { InputField } from "~/lib/registry/types";
import type { ContextProfile } from "~/lib/context/types";
import { defaultValuesFor, profilePrefillValues, type FormValues } from "~/lib/forms/values";

export interface UseSandboxOptions {
  /** The tool's input fields — the sandbox seeds one value per field. */
  inputs: InputField[];
  /** Selectable teaching-context profiles (empty/omitted → no profile prefill). */
  profiles?: ContextProfile[];
  /** Which profile is selected initially. */
  defaultProfileId?: string;
  /**
   * Provisioned-student mode (Phase 6.9): cohort-supplied values prefill AND lock
   * the sandbox — there is no editable profile selector, and callers hide the
   * editing UI when `locked` is true.
   */
  lockedValues?: Record<string, string>;
}

export interface UseSandbox {
  /** Current form values, keyed by input name. */
  values: FormValues;
  /** Update a single field. */
  setValue: (name: string, value: FormValues[string]) => void;
  /** Escape hatch for callers that need the raw setter (functional updates). */
  setValues: React.Dispatch<React.SetStateAction<FormValues>>;
  /** The selected context profile id ("" = no profile). */
  contextProfileId: string;
  /** Select a profile and re-derive its profile-backed fields. */
  selectProfile: (id: string) => void;
  /** True in provisioned-student mode (values are locked, no editable controls). */
  locked: boolean;
}

/**
 * The shared sandbox: the per-tool input values plus the selected context
 * profile, with two behaviours the three tool surfaces used to each re-implement:
 *
 *  - **profile prefill** — a field marked `prefillFromProfile` is seeded from the
 *    selected profile and re-derived when the profile changes (GeneratorView,
 *    StageStepper). Switching to a profile that derives nothing resets the field
 *    to its default, so a stale prefill never lingers.
 *  - **locked mode** — a provisioned student's cohort supplies the values and
 *    there is no editable sandbox/profile selector (ChatView, Phase 6.9).
 *
 * A tool with no `prefillFromProfile` fields (e.g. Cognitive Architect) behaves
 * exactly as before: `selectProfile` only touches profile-backed fields.
 */
export function useSandbox({
  inputs,
  profiles,
  defaultProfileId = "",
  lockedValues,
}: UseSandboxOptions): UseSandbox {
  const profileList = profiles ?? [];
  const locked = lockedValues != null;
  const [contextProfileId, setContextProfileId] = useState(defaultProfileId);
  const [values, setValues] = useState<FormValues>(() => ({
    ...defaultValuesFor(inputs),
    ...profilePrefillValues(
      inputs,
      profileList.find((p) => p.id === defaultProfileId),
    ),
    ...(lockedValues ?? {}),
  }));

  function selectProfile(id: string) {
    setContextProfileId(id);
    const prefill = profilePrefillValues(
      inputs,
      profileList.find((p) => p.id === id),
    );
    setValues((prev) => {
      const next = { ...prev };
      for (const f of inputs) {
        if (!f.prefillFromProfile) continue;
        next[f.name] = f.name in prefill ? prefill[f.name] : defaultValuesFor([f])[f.name];
      }
      return next;
    });
  }

  const setValue = (name: string, value: FormValues[string]) =>
    setValues((prev) => ({ ...prev, [name]: value }));

  return { values, setValue, setValues, contextProfileId, selectProfile, locked };
}
