"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { EmptyState } from "@/components/patterns/empty-state";
import { ErrorState } from "@/components/patterns/error-state";
import { LoadingState } from "@/components/patterns/loading-state";
import { PageHeader } from "@/components/patterns/page-header";
import { SectionHeader } from "@/components/patterns/section-header";
import { StatusBadge } from "@/components/patterns/status-badge";
import { ThemeSwitcher } from "@/components/patterns/theme-switcher";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { SEMANTIC_COLOR_TOKENS, STATUS_VARIANTS } from "@/core/ui/tokens";

const BRAND_EXAMPLES = [
  { name: "Harbor", accent: "#1D4ED8", surface: "#F8FAFC" },
  { name: "Orchid", accent: "#7C3AED", surface: "#FAF5FF" },
  { name: "High-contrast", accent: "#0F172A", surface: "#FFFFFF" },
  { name: "Unsafe yellow", accent: "#FACC15", surface: "#FEFCE8" },
] as const;

export function UiGallery(): React.ReactElement {
  const t = useTranslations("gallery");
  const tShell = useTranslations("shell");
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <div className="space-y-8">
      <PageHeader title={t("title")} description={t("description")} />

      <section className="space-y-3">
        <SectionHeader title={t("typography")} />
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">Heading 1</h1>
          <h2 className="text-lg font-semibold">Heading 2</h2>
          <p className="text-base">Body copy remains readable at 320px.</p>
          <p className="text-sm text-muted-foreground">Metadata and hints.</p>
        </div>
      </section>

      <section className="space-y-3">
        <SectionHeader title={t("colors")} />
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {SEMANTIC_COLOR_TOKENS.map((token) => (
            <li key={token} className="space-y-1 text-xs">
              <div
                className="h-11 rounded-md border border-border"
                style={{ backgroundColor: `var(--${token})` }}
              />
              <p>{token}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <SectionHeader title={t("buttons")} />
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button>{t("primary")}</Button>
          <Button variant="secondary">{t("secondary")}</Button>
          <Button variant="destructive">{t("destructive")}</Button>
          <Button variant="outline" disabled>
            Disabled
          </Button>
        </div>
      </section>

      <section className="space-y-3">
        <SectionHeader title={t("forms")} />
        <div className="max-w-md space-y-3">
          <div className="space-y-1">
            <Label htmlFor="gallery-input">Email</Label>
            <Input id="gallery-input" defaultValue="host@example.com" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="gallery-error">With error</Label>
            <Input id="gallery-error" aria-invalid="true" />
            <p className="text-sm text-destructive" role="alert">
              Check this field.
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <SectionHeader title={t("cards")} />
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Section card</CardTitle>
            <CardDescription>One border. No nested cards.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm">Compact operational density.</p>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <SectionHeader title={t("badges")} />
        <div className="flex flex-wrap gap-2">
          {STATUS_VARIANTS.map((variant) => (
            <StatusBadge key={variant} label={variant} variant={variant} />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <SectionHeader title={t("alerts")} />
        <p role="status" className="text-sm">
          Saved.
        </p>
        <p role="alert" className="text-sm text-destructive">
          Something went wrong.
        </p>
      </section>

      <section className="space-y-3">
        <SectionHeader title={t("dialogs")} />
        <div className="flex flex-col gap-2 sm:flex-row">
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">{t("openDialog")}</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("dialogTitle")}</DialogTitle>
                <DialogDescription>{t("dialogBody")}</DialogDescription>
              </DialogHeader>
            </DialogContent>
          </Dialog>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline">{t("openSheet")}</Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>{t("sheetTitle")}</SheetTitle>
                <SheetDescription>{t("sheetBody")}</SheetDescription>
              </SheetHeader>
            </SheetContent>
          </Sheet>
        </div>
      </section>

      <section className="space-y-3">
        <SectionHeader title={t("states")} />
        <EmptyState title="Nothing here yet." />
        <LoadingState label="Loading" />
        <ErrorState title="Could not load this view." />
      </section>

      <section className="space-y-3">
        <SectionHeader title={t("navigation")} />
        <p className="text-sm text-muted-foreground">
          Compact header, bottom navigation on admin, drawer for overflow.
        </p>
      </section>

      <section className="space-y-3">
        <SectionHeader title={t("staff")} />
        <article className="max-w-xs rounded-lg bg-card p-3 ring-1 ring-border">
          <div className="flex gap-3">
            <div className="flex size-[72px] items-center justify-center rounded-full bg-secondary font-semibold">
              MC
            </div>
            <div>
              <h3 className="text-sm font-semibold">Mina Cole</h3>
              <p className="text-xs text-muted-foreground">Host</p>
              <Badge variant="present">In now</Badge>
            </div>
          </div>
        </article>
      </section>

      <section className="space-y-3">
        <SectionHeader title={t("events")} />
        <article className="max-w-md rounded-lg bg-card p-3 ring-1 ring-border">
          <p className="font-medium">Harbor Upcoming</p>
          <p className="text-sm text-muted-foreground">4 Sep · 02:19–04:19</p>
        </article>
      </section>

      <section className="space-y-3">
        <SectionHeader title={t("feed")} />
        <article className="max-w-md rounded-lg border border-border bg-card p-3">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>Update</span>
            <span aria-hidden="true">·</span>
            <span>4 Sep 2026</span>
            <span className="font-medium text-foreground">Pinned</span>
          </div>
          <h3 className="mt-1 text-base font-semibold tracking-tight">
            Harbour kitchen hours
          </h3>
          <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-sm text-muted-foreground">
            The kitchen stays open until midnight this weekend.
          </p>
        </article>
      </section>

      <section className="space-y-3">
        <SectionHeader title={t("atmosphere")} />
        <Card className="max-w-md">
          <CardHeader className="p-3">
            <CardTitle className="text-base">Right now</CardTitle>
            <CardDescription>
              A short promotional description of how the room feels.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-2 p-3 pt-0">
            <p className="text-lg font-semibold">Lively</p>
            <Badge variant="atmosphereLively">Lively</Badge>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <SectionHeader title={t("themes")} />
        <ThemeSwitcher
          labels={{
            theme: tShell("theme"),
            light: tShell("themeLight"),
            dark: tShell("themeDark"),
            system: tShell("themeSystem"),
          }}
        />
      </section>

      <section className="space-y-3">
        <SectionHeader title={t("brand")} />
        <ul className="grid gap-3 sm:grid-cols-2">
          {BRAND_EXAMPLES.map((brand) => (
            <li
              key={brand.name}
              className="rounded-lg p-3 ring-1 ring-border"
              style={{
                backgroundColor: brand.surface,
                ["--venue-accent" as string]: brand.accent,
              }}
            >
              <p className="font-medium">{brand.name}</p>
              <Button className="mt-2 bg-[var(--venue-accent)]">
                {t("primary")}
              </Button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
