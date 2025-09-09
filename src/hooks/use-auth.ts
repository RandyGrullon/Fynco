// src/hooks/use-auth.ts
import { useState, useEffect } from "react";
import { onAuthStateChanged, User, signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter, useParams } from "next/navigation";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const logout = async () => {
    try {
      await signOut(auth);
      return true;
    } catch (error) {
      console.error("Logout error:", error);
      return false;
    }
  };

  return { user, loading, auth, logout };
}

export function useRequireAuth(redirectUrl = "/login") {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const locale = (params.locale as string) || "en";

  useEffect(() => {
    if (!loading && !user) {
      router.push(`/${locale}${redirectUrl}`);
    }
  }, [user, loading, router, redirectUrl, locale]);

  return { user, loading };
}
