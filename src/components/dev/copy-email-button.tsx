"use client";

import { useEffect, useState, type ReactElement } from "react";

import { Button } from "@/components/ui/button";

interface CopyEmailButtonProps {
  email: string;
  label: string;
  copiedLabel: string;
}

export function CopyEmailButton({
  email,
  label,
  copiedLabel,
}: CopyEmailButtonProps): ReactElement {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setCopied(false);
    }, 2000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [copied]);

  async function copyEmail(): Promise<void> {
    try {
      await navigator.clipboard.writeText(email);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Button type="button" variant="outline" onClick={() => void copyEmail()}>
      {copied ? copiedLabel : label}
    </Button>
  );
}
