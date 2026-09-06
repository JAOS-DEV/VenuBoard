export const dynamic = "force-dynamic";

interface PublicLayoutProps {
  children: React.ReactNode;
}

export default function PublicLayout({
  children,
}: PublicLayoutProps): React.ReactNode {
  return children;
}
