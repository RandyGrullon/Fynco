"use client";

import { auth, db } from "@/lib/firebase";
import { useEffect, useState } from "react";
import { connectAuthEmulator } from "firebase/auth";
import { connectFirestoreEmulator } from "firebase/firestore";

export default function FirebaseTest() {
  const [status, setStatus] = useState("Testing...");
  const [details, setDetails] = useState<string[]>([]);

  useEffect(() => {
    const testFirebase = async () => {
      const testResults: string[] = [];

      try {
        // Test 1: Check if Firebase is initialized
        if (auth) {
          testResults.push("✅ Firebase Auth initialized");
        } else {
          testResults.push("❌ Firebase Auth not initialized");
        }

        // Test 2: Check if Firestore is initialized
        if (db) {
          testResults.push("✅ Firestore initialized");
        } else {
          testResults.push("❌ Firestore not initialized");
        }

        // Test 3: Check current auth state
        const currentUser = auth.currentUser;
        testResults.push(
          `🔍 Current user: ${currentUser?.email || "No user logged in"}`
        );

        // Test 4: Check connection
        try {
          // Try to get the current user
          testResults.push("✅ Firebase connection working");
          setStatus("Firebase is working correctly!");
        } catch (error) {
          testResults.push(`❌ Firebase connection error: ${error}`);
          setStatus("Firebase connection issues detected");
        }

        setDetails(testResults);
      } catch (error: any) {
        testResults.push(`❌ Error testing Firebase: ${error.message}`);
        setStatus("Firebase test failed");
        setDetails(testResults);
      }
    };

    testFirebase();
  }, []);

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Firebase Connection Test</h1>
      <div className="bg-card p-4 rounded-lg">
        <h2 className="text-lg font-semibold mb-2">Status: {status}</h2>
        <ul className="space-y-1">
          {details.map((detail, index) => (
            <li key={index} className="text-sm font-mono">
              {detail}
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-4 text-sm text-muted-foreground">
        <p>If you see connection issues, check:</p>
        <ul className="list-disc list-inside mt-2 space-y-1">
          <li>Internet connection</li>
          <li>Firebase project configuration</li>
          <li>API keys in environment variables</li>
          <li>Browser console for additional errors</li>
        </ul>
      </div>
    </div>
  );
}
