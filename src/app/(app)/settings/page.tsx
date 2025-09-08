'use client';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/use-auth';
import { updateProfile } from 'firebase/auth';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const GmailIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2 h-5 w-5"><path d="M22 6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6z"></path><path d="M22 6l-10 7L2 6"></path></svg>
)

const OutlookIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="mr-2 h-5 w-5"><path d="M15.5 2.25a.755.755 0 0 1 .75.75v18a.755.755 0 0 1-.75.75H2.75a.755.755 0 0 1-.75-.75V3a.755.755 0 0 1 .75-.75h12.75zM14 8.625H4.25V6.375H14v2.25zm0 4.125H4.25v-2.25H14v2.25zM14 17.25H4.25V15H14v2.25z"></path><path d="M16.25 21.75V3a.75.75 0 0 1 .64-.741l4.22-.01a.75.75 0 0 1 .74.64l.01 18.22a.75.75 0 0 1-.64.74l-4.22.01a.75.75 0 0 1-.73-.659z"></path></svg>
)


export default function SettingsPage() {
    const { user } = useAuth();
    const { toast } = useToast();
    const [name, setName] = useState(user?.displayName || '');
    const [loading, setLoading] = useState(false);

    const handleProfileUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        setLoading(true);

        try {
            await updateProfile(user, { displayName: name });
            const userDocRef = doc(db, 'users', user.uid);
            await setDoc(userDocRef, { displayName: name }, { merge: true });
            
            toast({
                title: 'Profile Updated',
                description: 'Your name has been updated successfully.',
                className: 'bg-accent text-accent-foreground',
            });
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: `Failed to update profile: ${error.message}`,
            });
        } finally {
            setLoading(false);
        }
    };


  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight font-headline">Settings</h2>
        <p className="text-muted-foreground">
          Manage your account settings and integrations.
        </p>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>
            Update your personal information. This will be displayed across the app.
          </CardDescription>
        </CardHeader>
        <CardContent>
            <form onSubmit={handleProfileUpdate} className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="name">Name</Label>
                    <Input id="name" value={name} onChange={(e) => setName(e.target.value)} disabled={loading} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" value={user?.email || ''} disabled />
                </div>
                <Button type="submit" disabled={loading}>
                    {loading ? 'Saving...' : 'Update Profile'}
                </Button>
            </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Email Sync</CardTitle>
          <CardDescription>
            Connect your email accounts to automatically import expenses from receipts (Feature coming soon).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
            <div className="flex items-center">
              <GmailIcon />
              <span className="font-medium">Gmail</span>
            </div>
            <Button disabled>Connect</Button>
          </div>
          <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
            <div className="flex items-center">
              <OutlookIcon />
              <span className="font-medium">Outlook</span>
            </div>
            <Button disabled>Connect</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
