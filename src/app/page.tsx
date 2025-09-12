import { redirect } from 'next/navigation';

// This page handles the redirect from the root to the default locale
export default function RootPage() {
  // Redirect to default locale
  redirect('/en');
}
