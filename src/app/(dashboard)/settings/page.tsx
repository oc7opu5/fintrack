"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { User, Shield, Download, Trash2, Save, Check } from "lucide-react";
import { trpc } from "@/lib/trpc/client";

export default function SettingsPage() {
  const { data: session, update: updateSession } = useSession();
  const [name, setName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [profileSaved, setProfileSaved] = useState(false);
  const [passwordSaved, setPasswordSaved] = useState(false);

  const { data: profile } = trpc.user.getProfile.useQuery();
  const updateProfile = trpc.user.updateProfile.useMutation({
    onSuccess: () => { setProfileSaved(true); setTimeout(() => setProfileSaved(false), 2000); updateSession(); },
  });
  const changePassword = trpc.user.changePassword.useMutation({
    onSuccess: () => { setPasswordSaved(true); setPasswordError(""); setCurrentPassword(""); setNewPassword(""); setConfirmPassword(""); setTimeout(() => setPasswordSaved(false), 2000); },
    onError: (err) => setPasswordError(err.message),
  });
  const { data: exportData } = trpc.user.exportData.useQuery();

  useEffect(() => {
    if (profile?.name) setName(profile.name);
  }, [profile]);

  const handleExport = () => {
    if (!exportData) return;
    let csv = "Date,Type,Description,Amount,Category,Account\n";
    exportData.transactions.forEach((tx: any) => {
      csv += `${new Date(tx.date).toISOString().split("T")[0]},${tx.type},"${tx.description}",${tx.amount},"${tx.category?.name || ""}","${tx.account?.name || ""}"\n`;
    });
    csv += "\nSubscriptions\nName,Amount,Cycle,Status,Next Billing\n";
    exportData.subscriptions.forEach((sub: any) => {
      csv += `"${sub.name}",${sub.amount},${sub.billingCycle},${sub.status},${sub.nextBillingDate || ""}\n`;
    });
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fintrack-export-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div><h1 className="text-2xl font-bold">Settings</h1><p className="text-muted-foreground">Manage your account settings</p></div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><User className="w-5 h-5" />Profile</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input defaultValue={session?.user?.email || ""} disabled />
          </div>
          <Button onClick={() => updateProfile.mutate({ name })} disabled={updateProfile.isPending || !name}>
            {profileSaved ? <><Check className="w-4 h-4 mr-2" />Saved</> : updateProfile.isPending ? "Saving..." : <><Save className="w-4 h-4 mr-2" />Save Changes</>}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Shield className="w-5 h-5" />Security</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {passwordError && <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">{passwordError}</div>}
          <div className="space-y-2"><Label>Current Password</Label><Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} /></div>
          <div className="space-y-2"><Label>New Password</Label><Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} /></div>
          <div className="space-y-2"><Label>Confirm New Password</Label><Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} /></div>
          <Button onClick={() => {
            setPasswordError("");
            if (!currentPassword || !newPassword) { setPasswordError("Fill all fields"); return; }
            if (newPassword !== confirmPassword) { setPasswordError("Passwords don't match"); return; }
            if (newPassword.length < 6) { setPasswordError("Password must be at least 6 characters"); return; }
            changePassword.mutate({ currentPassword, newPassword });
          }} disabled={changePassword.isPending}>
            {passwordSaved ? <><Check className="w-4 h-4 mr-2" />Updated</> : changePassword.isPending ? "Updating..." : "Update Password"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Download className="w-5 h-5" />Data Management</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div><p className="font-medium">Export Data</p><p className="text-sm text-muted-foreground">Download all transactions and subscriptions as CSV</p></div>
            <Button variant="outline" onClick={handleExport}><Download className="w-4 h-4 mr-2" />Export</Button>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div><p className="font-medium text-destructive">Delete Account</p><p className="text-sm text-muted-foreground">Permanently delete your account and all data</p></div>
            <Button variant="destructive" disabled><Trash2 className="w-4 h-4 mr-2" />Delete</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
