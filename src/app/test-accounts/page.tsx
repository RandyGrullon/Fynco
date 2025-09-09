"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import Link from "next/link";

export default function TestAccountsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleTestLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      // Use test credentials - replace with actual test user for your environment
      await signInWithEmailAndPassword(auth, "test@example.com", "password123");
      setSuccess(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-6">Test Accounts Module</h1>

      <div className="bg-card p-6 rounded-lg shadow-md mb-6">
        <h2 className="text-xl font-semibold mb-4">Authentication Status</h2>
        {user ? (
          <div className="bg-green-50 p-4 rounded border border-green-200">
            <p className="text-green-700">
              Logged in as: <span className="font-medium">{user.email}</span>
            </p>
            <p className="text-sm text-green-600 mt-1">User ID: {user.uid}</p>
          </div>
        ) : (
          <div className="bg-yellow-50 p-4 rounded border border-yellow-200">
            <p className="text-yellow-700">Not logged in</p>
            <Button
              onClick={handleTestLogin}
              className="mt-2"
              disabled={loading}
            >
              {loading ? "Logging in..." : "Test Login"}
            </Button>
            {error && <p className="text-red-500 mt-2 text-sm">{error}</p>}
          </div>
        )}
      </div>

      {user && (
        <div className="space-y-4">
          <div className="bg-card p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4">
              Account Module Navigation
            </h2>
            <div className="space-y-2">
              <Link href="/accounts">
                <Button className="w-full">Go to Accounts Page</Button>
              </Link>
              <Link href="/dashboard">
                <Button variant="outline" className="w-full">
                  Go to Dashboard
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
