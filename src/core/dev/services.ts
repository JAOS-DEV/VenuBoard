import { CANONICAL_LOCAL_APP_ORIGIN } from "@/core/auth/app-origin";

/** Fixed local-development URLs. These are not production configuration. */
export const LOCAL_APP_URL = CANONICAL_LOCAL_APP_ORIGIN;
export const LOCAL_STUDIO_URL = "http://127.0.0.1:54323";
export const LOCAL_MAILBOX_URL = "http://127.0.0.1:54324";
export const LOCAL_AUTH_HEALTH_URL = "http://127.0.0.1:54321/auth/v1/health";
export const LOCAL_DEVELOPER_HUB_URL = `${CANONICAL_LOCAL_APP_ORIGIN}/en/dev`;

export const LOCAL_SERVICE_LINKS = [
  {
    id: "application",
    href: LOCAL_APP_URL,
    opensLocalTool: true,
  },
  {
    id: "studio",
    href: LOCAL_STUDIO_URL,
    opensLocalTool: true,
  },
  {
    id: "mailbox",
    href: LOCAL_MAILBOX_URL,
    opensLocalTool: true,
  },
  {
    id: "authHealth",
    href: LOCAL_AUTH_HEALTH_URL,
    opensLocalTool: true,
  },
] as const;

export type LocalServiceLinkId = (typeof LOCAL_SERVICE_LINKS)[number]["id"];
