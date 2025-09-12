// The root layout must be minimal and just pass through to locale layouts
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
