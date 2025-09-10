"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import Image from "next/image";
import { auth, db } from "@/lib/firebase";
import {
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  AuthErrorCodes,
} from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";

const GoogleIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    role="img"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <title>Google</title>
    <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l-2.32 2.32c-.76-.76-1.76-1.28-3.587-1.28-3.067 0-5.547 2.587-5.547 5.76s2.48 5.76 5.547 5.76c3.307 0 4.787-2.187 5.067-3.28H12.48z" />
  </svg>
);

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // Test Firebase connection on component mount
  useEffect(() => {
    const testConnection = async () => {
      try {
        // Just checking if auth is properly initialized
        if (!auth) {
          toast({
            variant: "destructive",
            title: "Connection Error",
            description:
              "Unable to connect to authentication service. Please refresh the page.",
          });
        }
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Connection Error",
          description:
            "Unable to connect to authentication service. Please refresh the page.",
        });
      }
    };
    testConnection();
  }, [toast]);

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please fill in all fields",
      });
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast({
        variant: "destructive",
        title: "Invalid Email",
        description: "Please enter a valid email address",
      });
      return;
    }

    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );
      const user = userCredential.user;

      // Ensure user document exists in Firestore
      await setDoc(
        doc(db, "users", user.uid),
        {
          uid: user.uid,
          displayName: user.displayName || user.email?.split("@")[0],
          email: user.email,
          photoURL: user.photoURL,
          createdAt: new Date(),
          lastLogin: new Date(),
        },
        { merge: true }
      );

      toast({
        title: "Success!",
        description: "You have been signed in successfully",
      });

      router.push("/dashboard");
    } catch (error: any) {
      let errorMessage = "An error occurred during sign in";

      switch (error.code) {
        case "auth/user-not-found":
          errorMessage =
            "No account found with this email address. Please check your email or create a new account.";
          break;
        case "auth/wrong-password":
          errorMessage = "Incorrect password. Please try again.";
          break;
        case "auth/invalid-email":
          errorMessage = "Invalid email address format";
          break;
        case "auth/user-disabled":
          errorMessage = "This account has been disabled";
          break;
        case "auth/too-many-requests":
          errorMessage = "Too many failed attempts. Please try again later";
          break;
        case "auth/invalid-credential":
          errorMessage =
            "Invalid email or password. Please check your credentials and try again. If you don't have an account, please sign up first.";
          break;
        case "auth/network-request-failed":
          errorMessage =
            "Network error. Please check your connection and try again";
          break;
        case "auth/weak-password":
          errorMessage = "Password is too weak";
          break;
        default:
          errorMessage = `Sign in failed: ${error.message}`;
      }

      toast({
        variant: "destructive",
        title: "Sign In Failed",
        description: errorMessage,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    const provider = new GoogleAuthProvider();

    // Add additional scopes if needed
    provider.addScope("email");
    provider.addScope("profile");

    try {
      const userCredential = await signInWithPopup(auth, provider);
      const user = userCredential.user;

      // Ensure user document exists in Firestore
      await setDoc(
        doc(db, "users", user.uid),
        {
          uid: user.uid,
          displayName: user.displayName,
          email: user.email,
          photoURL: user.photoURL,
          createdAt: new Date(),
          lastLogin: new Date(),
          provider: "google",
        },
        { merge: true }
      );

      toast({
        title: "Success!",
        description: "You have been signed in with Google successfully",
      });

      router.push("/dashboard");
    } catch (error: any) {
      let errorMessage = "An error occurred during Google sign in";

      switch (error.code) {
        case "auth/popup-closed-by-user":
          errorMessage = "Sign in was cancelled";
          break;
        case "auth/popup-blocked":
          errorMessage = "Popup was blocked. Please allow popups and try again";
          break;
        case "auth/cancelled-popup-request":
          errorMessage = "Sign in was cancelled";
          break;
        case "auth/account-exists-with-different-credential":
          errorMessage =
            "An account already exists with this email using a different sign-in method";
          break;
        default:
          errorMessage = error.message;
      }

      toast({
        variant: "destructive",
        title: "Google Sign In Failed",
        description: errorMessage,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md">
      <div className="flex flex-col items-center text-center mb-8">
        <img src="/logo.png" alt="Fynco" className="h-16 w-auto mb-2" />
        <h1 className="text-3xl font-headline font-bold">
          Welcome back to Fynco
        </h1>
        <p className="text-muted-foreground">Sign in to manage your finances</p>
      </div>
      <Card>
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl">Sign In</CardTitle>
          <CardDescription>
            Choose your preferred sign in method
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid grid-cols-1 gap-2">
            <Button
              variant="outline"
              onClick={handleGoogleSignIn}
              disabled={loading}
            >
              <GoogleIcon className="mr-2 h-4 w-4" />
              Sign in with Google
            </Button>
          </div>
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">
                Or continue with
              </span>
            </div>
          </div>
          <form onSubmit={handleEmailSignIn}>
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="m@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2 mt-4">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full mt-6" disabled={loading}>
              {loading ? "Signing In..." : "Sign In"}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-2">
              Don&apos;t have an account?
            </p>
            <Link href="/signup">
              <Button variant="outline" className="w-full">
                Create New Account
              </Button>
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
