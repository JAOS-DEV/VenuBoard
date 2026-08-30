import { CircleDashed } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface NotImplementedNoticeProps {
  heading: string;
  body: string;
  note?: string;
  children?: React.ReactNode;
}

/**
 * The honest empty state. Every placeholder surface says what is missing rather
 * than showing a convincing-looking screen that does nothing.
 */
export function NotImplementedNotice({
  heading,
  body,
  note,
  children,
}: NotImplementedNoticeProps): React.ReactElement {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CircleDashed aria-hidden="true" />
          {heading}
        </CardTitle>
        <CardDescription>{body}</CardDescription>
      </CardHeader>
      {(note !== undefined || children !== undefined) && (
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          {children}
          {note !== undefined && <p>{note}</p>}
        </CardContent>
      )}
    </Card>
  );
}
