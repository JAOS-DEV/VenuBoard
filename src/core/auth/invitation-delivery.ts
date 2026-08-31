import "server-only";

import {
  isLocalClass,
  type VenuBoardEnvironment,
} from "@/core/env/environment";

/**
 * Local/test substitute for invitation email. No production provider is
 * configured (OQ-18 / ADR-038). This must never claim that email was sent.
 */

export interface InvitationDeliveryInput {
  to: string;
  url: string;
  environment: VenuBoardEnvironment;
}

export interface InvitationDeliveryResult {
  delivered: false;
  reason: "no_email_provider";
  logged: boolean;
}

function redactEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 0) {
    return "[redacted]";
  }
  return `${email.slice(0, 1)}…${email.slice(at)}`;
}

export function deliverInvitationLink(
  input: InvitationDeliveryInput,
): InvitationDeliveryResult {
  const { to, environment } = input;
  const localClass = isLocalClass(environment);

  if (localClass) {
    console.info(
      "[venuboard:invitation-delivery] Email was not sent. No transactional provider is configured (OQ-18).",
      { to: redactEmail(to) },
    );
  } else {
    console.info(
      "[venuboard:invitation-delivery] Email was not sent. No transactional provider is configured (OQ-18).",
    );
  }

  return {
    delivered: false,
    reason: "no_email_provider",
    logged: true,
  };
}
