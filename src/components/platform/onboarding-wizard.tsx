"use client";

import { useLocale, useTranslations } from "next-intl";
import {
  useId,
  useState,
  useTransition,
  type FormEvent,
  type ReactElement,
} from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  submitPlatformOnboarding,
  type OnboardingActionResult,
} from "@/core/onboarding/actions";
import type { OnboardingCatalogue } from "@/core/onboarding/catalogue-map";
import { contrastWarning } from "@/core/onboarding/colors";
import {
  IDEMPOTENCY_STORAGE_KEY,
  TIMEZONE_SUGGESTIONS,
} from "@/core/onboarding/constants";
import { invitationDisplayPath } from "@/core/onboarding/invitation-display";
import {
  onboardingBrandingSchema,
  onboardingBusinessSchema,
  onboardingOwnerSchema,
  onboardingTrialSchema,
  onboardingVenueSchema,
  onboardingWizardSchema,
} from "@/core/onboarding/schema";
import { slugRejectReason } from "@/core/onboarding/slug";
import {
  createOnboardingDraft,
  ONBOARDING_STEPS,
  type OnboardingDraft,
  type OnboardingStep,
} from "@/core/onboarding/wizard-state";
import { Link } from "@/core/i18n/navigation";

interface OnboardingWizardProps {
  catalogue: OnboardingCatalogue;
}

function readStoredKey(fallback: string): string {
  if (typeof window === "undefined") {
    return fallback;
  }
  const existing = window.sessionStorage.getItem(IDEMPOTENCY_STORAGE_KEY);
  if (existing !== null && existing.length > 0) {
    return existing;
  }
  window.sessionStorage.setItem(IDEMPOTENCY_STORAGE_KEY, fallback);
  return fallback;
}

function errorMessage(
  t: ReturnType<typeof useTranslations<"onboarding">>,
  code: string | undefined,
): string {
  switch (code) {
    case "forbidden":
      return t("errors.forbidden");
    case "unavailable":
      return t("errors.unavailable");
    case "invalid_payload":
      return t("errors.invalidPayload");
    case "reserved_slug":
      return t("errors.reservedSlug");
    case "duplicate_slug":
      return t("errors.duplicateSlug");
    case "invalid_slug":
      return t("errors.invalidSlug");
    case "core_profile_required":
      return t("errors.coreProfile");
    case "idempotency_conflict":
      return t("errors.idempotencyConflict");
    case "invalid_color":
      return t("errors.invalidColor");
    case "invalid_classification":
      return t("errors.invalidClassification");
    case "invalid_quota":
      return t("errors.invalidQuota");
    case "invalid_trial":
      return t("errors.invalidTrial");
    case "unknown_module":
      return t("errors.unknownModule");
    case "invalid_theme":
      return t("errors.invalidTheme");
    case "invalid_font":
      return t("errors.invalidFont");
    case "invalid_timezone":
      return t("errors.invalidTimezone");
    case "invalid_locale":
      return t("errors.invalidLocale");
    default:
      return t("errors.generic");
  }
}

function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: ReactElement;
}): ReactElement {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint !== undefined && (
        <p id={`${id}-hint`} className="text-sm text-muted-foreground">
          {hint}
        </p>
      )}
      {error !== undefined && (
        <p id={`${id}-error`} className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function OnboardingWizard({
  catalogue,
}: OnboardingWizardProps): ReactElement {
  const t = useTranslations("onboarding");
  const locale = useLocale();
  const formId = useId();
  const [stepIndex, setStepIndex] = useState(0);
  const [draft, setDraft] = useState<OnboardingDraft>(() =>
    createOnboardingDraft(crypto.randomUUID()),
  );
  const [stepError, setStepError] = useState<string | null>(null);
  const [result, setResult] = useState<OnboardingActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);

  const step = ONBOARDING_STEPS[stepIndex] ?? "business";
  const contrastIssue = contrastWarning(
    draft.branding.textColor,
    draft.branding.backgroundColor,
  );

  const invitePath =
    result?.invitationToken === undefined
      ? null
      : invitationDisplayPath(locale, result.invitationToken);

  function update<K extends keyof OnboardingDraft>(
    key: K,
    value: OnboardingDraft[K],
  ): void {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function validateStep(current: OnboardingStep): boolean {
    if (current === "business") {
      return onboardingBusinessSchema.safeParse(draft.business).success;
    }
    if (current === "venue") {
      const parsed = onboardingVenueSchema
        .pick({
          nameEn: true,
          nameTh: true,
          descriptionEn: true,
          descriptionTh: true,
          taglineEn: true,
          taglineTh: true,
          slug: true,
          timezone: true,
        })
        .safeParse(draft.venue);
      if (!parsed.success) {
        return false;
      }
      return (
        slugRejectReason(draft.venue.slug, catalogue.reservedSlugs) === null
      );
    }
    if (current === "classification") {
      return (
        draft.venue.contentClassification !== "" &&
        onboardingVenueSchema
          .pick({
            defaultLocale: true,
            supportedLocales: true,
            contentClassification: true,
            classificationLocked: true,
          })
          .safeParse(draft.venue).success
      );
    }
    if (current === "branding") {
      return onboardingBrandingSchema.safeParse(draft.branding).success;
    }
    if (current === "modules") {
      return onboardingTrialSchema.safeParse(draft.trial).success;
    }
    if (current === "owner") {
      return onboardingOwnerSchema.safeParse(draft.owner).success;
    }
    return onboardingWizardSchema.safeParse(draft).success;
  }

  function goNext(): void {
    if (!validateStep(step)) {
      setStepError(t("errors.incomplete"));
      return;
    }
    setStepError(null);
    readStoredKey(draft.idempotencyKey);
    setStepIndex((index) => Math.min(index + 1, ONBOARDING_STEPS.length - 1));
  }

  function goBack(): void {
    setStepError(null);
    setStepIndex((index) => Math.max(index - 1, 0));
  }

  function submitDraft(): void {
    if (pending) {
      return;
    }
    const parsed = onboardingWizardSchema.safeParse({
      ...draft,
      idempotencyKey: readStoredKey(draft.idempotencyKey),
    });
    if (!parsed.success) {
      setStepError(t("errors.incomplete"));
      return;
    }
    startTransition(async () => {
      const next = await submitPlatformOnboarding(parsed.data);
      if (!next.ok) {
        setStepError(errorMessage(t, next.code));
        return;
      }
      setStepError(null);
      setResult(next);
    });
  }

  function onSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (step !== "review") {
      goNext();
      return;
    }
    submitDraft();
  }

  if (result?.ok === true) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("result.title")}</CardTitle>
          <CardDescription>{t("result.unpublished")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>{t("result.createdNotEmailed")}</p>
          {invitePath !== null && (
            <div className="space-y-2">
              <Label htmlFor={`${formId}-invite`}>
                {t("result.inviteLink")}
              </Label>
              <Input id={`${formId}-invite`} readOnly value={invitePath} />
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  void navigator.clipboard.writeText(
                    `${window.location.origin}${invitePath}`,
                  );
                  setCopied(true);
                }}
              >
                {copied ? t("result.copied") : t("result.copy")}
              </Button>
              <p className="text-sm text-muted-foreground">
                {t("result.oneTime")}
              </p>
            </div>
          )}
          <p className="text-sm text-muted-foreground">
            {t("result.regenerateDeferred")}
          </p>
        </CardContent>
        <CardFooter>
          {result.venueId !== undefined && (
            <Button asChild>
              <Link href={`/platform/venues/${result.venueId}`}>
                {t("result.openOverview")}
              </Link>
            </Button>
          )}
        </CardFooter>
      </Card>
    );
  }

  return (
    <form className="space-y-6" onSubmit={onSubmit} noValidate>
      <ol className="flex flex-wrap gap-2 text-sm" aria-label={t("stepsLabel")}>
        {ONBOARDING_STEPS.map((item, index) => (
          <li key={item}>
            <span
              className={
                index === stepIndex
                  ? "font-semibold text-foreground"
                  : "text-muted-foreground"
              }
              aria-current={index === stepIndex ? "step" : undefined}
            >
              {index + 1}. {t(`steps.${item}`)}
            </span>
          </li>
        ))}
      </ol>

      {stepError !== null && (
        <p className="text-sm text-destructive" role="alert">
          {stepError}
        </p>
      )}

      {step === "business" && (
        <div className="grid gap-4">
          <Field id={`${formId}-biz-name`} label={t("fields.businessName")}>
            <Input
              id={`${formId}-biz-name`}
              value={draft.business.name}
              onChange={(event) =>
                update("business", {
                  ...draft.business,
                  name: event.target.value,
                })
              }
            />
          </Field>
          <Field id={`${formId}-legal`} label={t("fields.legalName")}>
            <Input
              id={`${formId}-legal`}
              value={draft.business.legalName}
              onChange={(event) =>
                update("business", {
                  ...draft.business,
                  legalName: event.target.value,
                })
              }
            />
          </Field>
          <Field id={`${formId}-country`} label={t("fields.country")}>
            <Input
              id={`${formId}-country`}
              value={draft.business.country}
              maxLength={2}
              onChange={(event) =>
                update("business", {
                  ...draft.business,
                  country: event.target.value,
                })
              }
            />
          </Field>
        </div>
      )}

      {step === "venue" && (
        <div className="grid gap-4">
          <Field id={`${formId}-name-en`} label={t("fields.nameEn")}>
            <Input
              id={`${formId}-name-en`}
              value={draft.venue.nameEn}
              onChange={(event) =>
                update("venue", { ...draft.venue, nameEn: event.target.value })
              }
            />
          </Field>
          <Field id={`${formId}-name-th`} label={t("fields.nameTh")}>
            <Input
              id={`${formId}-name-th`}
              value={draft.venue.nameTh ?? ""}
              onChange={(event) =>
                update("venue", {
                  ...draft.venue,
                  nameTh: event.target.value,
                })
              }
            />
          </Field>
          <Field id={`${formId}-desc-en`} label={t("fields.descriptionEn")}>
            <textarea
              id={`${formId}-desc-en`}
              className="flex min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={draft.venue.descriptionEn ?? ""}
              onChange={(event) =>
                update("venue", {
                  ...draft.venue,
                  descriptionEn: event.target.value,
                })
              }
            />
          </Field>
          <Field id={`${formId}-desc-th`} label={t("fields.descriptionTh")}>
            <textarea
              id={`${formId}-desc-th`}
              className="flex min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={draft.venue.descriptionTh ?? ""}
              onChange={(event) =>
                update("venue", {
                  ...draft.venue,
                  descriptionTh: event.target.value,
                })
              }
            />
          </Field>
          <Field
            id={`${formId}-slug`}
            label={t("fields.slug")}
            hint={t("hints.slug")}
          >
            <Input
              id={`${formId}-slug`}
              value={draft.venue.slug}
              onChange={(event) =>
                update("venue", { ...draft.venue, slug: event.target.value })
              }
            />
          </Field>
          <Field
            id={`${formId}-tz`}
            label={t("fields.timezone")}
            hint={t("hints.timezone")}
          >
            <Input
              id={`${formId}-tz`}
              list={`${formId}-tz-list`}
              value={draft.venue.timezone}
              onChange={(event) =>
                update("venue", {
                  ...draft.venue,
                  timezone: event.target.value,
                })
              }
            />
          </Field>
          <datalist id={`${formId}-tz-list`}>
            {TIMEZONE_SUGGESTIONS.map((zone) => (
              <option key={zone} value={zone} />
            ))}
          </datalist>
        </div>
      )}

      {step === "classification" && (
        <fieldset className="grid gap-4">
          <legend className="text-sm font-medium">
            {t("fields.classification")}
          </legend>
          <p className="text-sm text-muted-foreground">
            {t("hints.classification")}
          </p>
          {(["general", "adult_nightlife"] as const).map((value) => (
            <label key={value} className="flex min-h-11 items-center gap-3">
              <input
                type="radio"
                name="classification"
                value={value}
                checked={draft.venue.contentClassification === value}
                onChange={() =>
                  update("venue", {
                    ...draft.venue,
                    contentClassification: value,
                  })
                }
              />
              <span>{t(`classification.${value}`)}</span>
            </label>
          ))}
          <p className="text-sm text-muted-foreground">
            {t("hints.notLegalAdvice")}
          </p>
          <label className="flex min-h-11 items-center gap-3">
            <input
              type="checkbox"
              checked={draft.venue.classificationLocked}
              onChange={(event) =>
                update("venue", {
                  ...draft.venue,
                  classificationLocked: event.target.checked,
                })
              }
            />
            <span>{t("fields.classificationLocked")}</span>
          </label>
          <label className="flex min-h-11 items-center gap-3">
            <input
              type="checkbox"
              checked={draft.venue.supportedLocales.includes("th")}
              onChange={(event) =>
                update("venue", {
                  ...draft.venue,
                  supportedLocales: event.target.checked
                    ? ["en", "th"]
                    : ["en"],
                })
              }
            />
            <span>{t("fields.includeThai")}</span>
          </label>
        </fieldset>
      )}

      {step === "branding" && (
        <div className="grid gap-4">
          {(
            [
              ["primaryColor", "fields.primaryColor"],
              ["secondaryColor", "fields.secondaryColor"],
              ["accentColor", "fields.accentColor"],
              ["backgroundColor", "fields.backgroundColor"],
              ["textColor", "fields.textColor"],
            ] as const
          ).map(([key, labelKey]) => (
            <Field key={key} id={`${formId}-${key}`} label={t(labelKey)}>
              <Input
                id={`${formId}-${key}`}
                value={draft.branding[key]}
                onChange={(event) =>
                  update("branding", {
                    ...draft.branding,
                    [key]: event.target.value,
                  })
                }
              />
            </Field>
          ))}
          {contrastIssue && (
            <p className="text-sm text-muted-foreground" role="status">
              {t("hints.contrast")}
            </p>
          )}
          <Field id={`${formId}-theme`} label={t("fields.theme")}>
            <select
              id={`${formId}-theme`}
              className="flex h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={draft.branding.themeKey}
              onChange={(event) =>
                update("branding", {
                  ...draft.branding,
                  themeKey: event.target.value,
                })
              }
            >
              {(catalogue.themes.length > 0
                ? catalogue.themes
                : [{ key: "system", name: "System" }]
              ).map((theme) => (
                <option key={theme.key} value={theme.key}>
                  {theme.name}
                </option>
              ))}
            </select>
          </Field>
          <p className="text-sm text-muted-foreground">{t("hints.font")}</p>
          <p className="text-sm text-muted-foreground">
            {t("hints.mediaDeferred")}
          </p>
        </div>
      )}

      {step === "modules" && (
        <fieldset className="grid gap-4">
          <legend className="text-sm font-medium">{t("fields.modules")}</legend>
          <p className="text-sm text-muted-foreground">{t("hints.trial")}</p>
          {catalogue.modules.map((module) => {
            const excluded = draft.trial.excludedModuleKeys.includes(
              module.key,
            );
            const individual = draft.trial.individualModuleTrials.find(
              (row) => row.moduleKey === module.key,
            );
            return (
              <div
                key={module.key}
                className="space-y-2 rounded-md border border-border p-3"
              >
                <label className="flex min-h-11 items-center gap-3">
                  <input
                    type="checkbox"
                    checked={module.isCore ? true : !excluded}
                    disabled={module.isCore}
                    onChange={(event) => {
                      const nextExcluded = event.target.checked
                        ? draft.trial.excludedModuleKeys.filter(
                            (key) => key !== module.key,
                          )
                        : [...draft.trial.excludedModuleKeys, module.key];
                      update("trial", {
                        ...draft.trial,
                        excludedModuleKeys: nextExcluded,
                      });
                    }}
                  />
                  <span>
                    {module.name}
                    {module.isCore ? ` (${t("fields.coreRequired")})` : ""}
                  </span>
                </label>
                {excluded && !module.isCore && (
                  <Field
                    id={`${formId}-ind-${module.key}`}
                    label={t("fields.individualTrialDays")}
                  >
                    <Input
                      id={`${formId}-ind-${module.key}`}
                      type="number"
                      min={0}
                      max={365}
                      value={individual?.days ?? 0}
                      onChange={(event) => {
                        const days = Number.parseInt(event.target.value, 10);
                        const rest = draft.trial.individualModuleTrials.filter(
                          (row) => row.moduleKey !== module.key,
                        );
                        update("trial", {
                          ...draft.trial,
                          individualModuleTrials:
                            Number.isFinite(days) && days > 0
                              ? [...rest, { moduleKey: module.key, days }]
                              : rest,
                        });
                      }}
                    />
                  </Field>
                )}
              </div>
            );
          })}
          <Field id={`${formId}-ext`} label={t("fields.extensionDays")}>
            <Input
              id={`${formId}-ext`}
              type="number"
              min={0}
              max={365}
              value={draft.trial.extensionDays}
              onChange={(event) =>
                update("trial", {
                  ...draft.trial,
                  extensionDays: Number.parseInt(event.target.value, 10) || 0,
                })
              }
            />
          </Field>
          <p className="text-sm text-muted-foreground">{t("hints.noPrices")}</p>
        </fieldset>
      )}

      {step === "owner" && (
        <Field id={`${formId}-owner`} label={t("fields.ownerEmail")}>
          <Input
            id={`${formId}-owner`}
            type="email"
            autoComplete="off"
            value={draft.owner.email}
            onChange={(event) => update("owner", { email: event.target.value })}
          />
        </Field>
      )}

      {step === "review" && (
        <div className="space-y-3 text-sm">
          <p className="font-medium">{t("review.unpublished")}</p>
          <p>
            {t("review.business")}: {draft.business.name}
          </p>
          <p>
            {t("review.venue")}: {draft.venue.nameEn}
          </p>
          <p>
            {t("review.slug")}: {draft.venue.slug}
          </p>
          <p>
            {t("review.classification")}:{" "}
            {draft.venue.contentClassification === ""
              ? ""
              : t(
                  `classification.${draft.venue.contentClassification === "nightlife_18_plus" ? "adult_nightlife" : draft.venue.contentClassification}`,
                )}
          </p>
          <p>
            {t("review.owner")}: {draft.owner.email}
          </p>
          <p>
            {t("review.excluded")}:{" "}
            {draft.trial.excludedModuleKeys.join(", ") || t("review.none")}
          </p>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        {stepIndex > 0 && (
          <Button type="button" variant="secondary" onClick={goBack}>
            {t("back")}
          </Button>
        )}
        {step !== "review" ? (
          <Button key="next-step" type="button" onClick={goNext}>
            {t("next")}
          </Button>
        ) : (
          <Button
            key="create-unpublished"
            type="button"
            disabled={pending}
            onClick={submitDraft}
          >
            {pending ? t("working") : t("create")}
          </Button>
        )}
      </div>
    </form>
  );
}
