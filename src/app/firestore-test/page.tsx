"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { addTransaction, getTransactions } from "@/lib/transactions";
import { useToast } from "@/hooks/use-toast";

export default function FirestoreTest() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [transactions, setTransactions] = useState<any[]>([]);

  const testAddTransaction = async () => {
    if (!user) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "You must be logged in to test transactions",
      });
      return;
    }

    setLoading(true);
    try {
      const testTransaction = {
        amount: 10.99,
        source: "Test Transaction",
        date: new Date(),
        method: "Credit Card" as const,
        category: "Food" as const,
        type: "expense" as const,
      };

      const result = await addTransaction(testTransaction, user.uid);

      if (result.success) {
        toast({
          title: "Success!",
          description: "Test transaction added successfully",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: `Failed to add transaction: ${result.error}`,
        });
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: `Unexpected error: ${error.message}`,
      });
    } finally {
      setLoading(false);
    }
  };

  const testGetTransactions = async () => {
    if (!user) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "You must be logged in to test transactions",
      });
      return;
    }

    setLoading(true);
    try {
      const userTransactions = await getTransactions(user.uid);
      setTransactions(userTransactions);
      toast({
        title: "Success!",
        description: `Retrieved ${userTransactions.length} transactions`,
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to get transactions: ${error.message}`,
      });
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>Firestore Test</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Please log in to test Firestore operations.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Firestore Operations Test</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground mb-4">
              Logged in as: {user.email}
            </p>
          </div>

          <div className="space-x-2">
            <Button onClick={testAddTransaction} disabled={loading}>
              {loading ? "Testing..." : "Test Add Transaction"}
            </Button>
            <Button
              onClick={testGetTransactions}
              disabled={loading}
              variant="outline"
            >
              {loading ? "Loading..." : "Test Get Transactions"}
            </Button>
          </div>

          {transactions.length > 0 && (
            <div className="mt-4">
              <h3 className="font-semibold mb-2">
                Transactions ({transactions.length}):
              </h3>
              <div className="space-y-2">
                {transactions.map((transaction, index) => (
                  <div key={index} className="text-xs bg-muted p-2 rounded">
                    <p>
                      <strong>Amount:</strong> ${transaction.amount}
                    </p>
                    <p>
                      <strong>Source:</strong> {transaction.source}
                    </p>
                    <p>
                      <strong>Category:</strong> {transaction.category}
                    </p>
                    <p>
                      <strong>Method:</strong> {transaction.method}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Firestore Rules Setup</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm">
            If you're getting permission denied errors, you need to update your
            Firestore rules:
          </p>
          <ol className="list-decimal list-inside text-sm mt-2 space-y-1">
            <li>Go to Firebase Console → Firestore Database → Rules</li>
            <li>
              Copy the rules from the firestore.rules file in your project root
            </li>
            <li>Publish the new rules</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
