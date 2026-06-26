"use client";

import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus,
  RefreshCw,
  Calendar,
  DollarSign,
  Star,
  Pause,
  Play,
  X,
  Mail,
  Globe,
  Image,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";

const billingCycleOptions = [
  { value: "MONTHLY", label: "Monthly" },
  { value: "YEARLY", label: "Yearly" },
  { value: "QUARTERLY", label: "Quarterly" },
  { value: "WEEKLY", label: "Weekly" },
  { value: "LIFETIME", label: "Lifetime (One-time)" },
];

// Auto-fetch logo from domain
function getLogoUrl(website: string): string {
  try {
    const url = new URL(website.startsWith("http") ? website : `https://${website}`);
    return `https://www.google.com/s2/favicons?domain=${url.hostname}&sz=64`;
  } catch {
    return "";
  }
}

export default function SubscriptionsPage() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [filter, setFilter] = useState("ACTIVE");
  const [newSub, setNewSub] = useState({
    name: "",
    amount: 0,
    billingCycle: "MONTHLY",
    description: "",
    category: "",
    website: "",
    email: "",
    logo: "",
    startDate: new Date().toISOString().split("T")[0],
  });

  // Auto-fetch logo when website changes
  useEffect(() => {
    if (newSub.website && !newSub.logo) {
      const logoUrl = getLogoUrl(newSub.website);
      if (logoUrl) {
        setNewSub((prev) => ({ ...prev, logo: logoUrl }));
      }
    }
  }, [newSub.website]);

  const utils = trpc.useUtils();
  const { data: subscriptions, isLoading } = trpc.subscription.list.useQuery(
    { status: filter as any }
  ) ?? { data: null, isLoading: false };

  const { data: summary } = trpc.subscription.summary.useQuery() ?? {
    data: null,
  };

  const createSub = trpc.subscription.create.useMutation({
    onSuccess: () => {
      utils.subscription.list.invalidate();
      utils.subscription.summary.invalidate();
      setIsAddDialogOpen(false);
      setNewSub({
        name: "",
        amount: 0,
        billingCycle: "MONTHLY",
        description: "",
        category: "",
        website: "",
        email: "",
        logo: "",
        startDate: new Date().toISOString().split("T")[0],
      });
    },
  });

  const cancelSub = trpc.subscription.cancel.useMutation({
    onSuccess: () => {
      utils.subscription.list.invalidate();
      utils.subscription.summary.invalidate();
    },
  });

  const subsList = subscriptions || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Subscriptions</h1>
          <p className="text-muted-foreground">
            Track your recurring payments and lifetime deals
          </p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Subscription
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add Subscription</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  placeholder="e.g., Netflix"
                  value={newSub.name}
                  onChange={(e) =>
                    setNewSub({ ...newSub, name: e.target.value })
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Amount</Label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={newSub.amount || ""}
                    onChange={(e) =>
                      setNewSub({
                        ...newSub,
                        amount: parseFloat(e.target.value) || 0,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Billing Cycle</Label>
                  <Select
                    value={newSub.billingCycle}
                    onValueChange={(value) =>
                      setNewSub({ ...newSub, billingCycle: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {billingCycleOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Website (optional)</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="https://netflix.com"
                    value={newSub.website}
                    onChange={(e) =>
                      setNewSub({ ...newSub, website: e.target.value, logo: "" })
                    }
                    className="flex-1"
                  />
                  {newSub.logo && (
                    <img
                      src={newSub.logo}
                      alt="Logo"
                      className="w-9 h-9 rounded border"
                      onError={() => setNewSub({ ...newSub, logo: "" })}
                    />
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Logo auto-fetched from website
                </p>
              </div>
              <div className="space-y-2">
                <Label>Email (optional)</Label>
                <Input
                  type="email"
                  placeholder="account@email.com"
                  value={newSub.email}
                  onChange={(e) =>
                    setNewSub({ ...newSub, email: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Category (optional)</Label>
                <Input
                  placeholder="e.g., Entertainment"
                  value={newSub.category}
                  onChange={(e) =>
                    setNewSub({ ...newSub, category: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={newSub.startDate}
                  onChange={(e) =>
                    setNewSub({ ...newSub, startDate: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Description (optional)</Label>
                <Textarea
                  placeholder="Additional notes..."
                  value={newSub.description}
                  onChange={(e) =>
                    setNewSub({ ...newSub, description: e.target.value })
                  }
                />
              </div>
              <Button
                onClick={() =>
                  createSub?.mutate({
                    ...newSub,
                    startDate: new Date(newSub.startDate),
                    status: newSub.billingCycle === "LIFETIME" ? "LIFETIME" : "ACTIVE",
                  } as any)
                }
                className="w-full"
                disabled={createSub?.isPending}
              >
                {createSub?.isPending ? "Adding..." : "Add Subscription"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-primary" />
              <p className="text-sm text-muted-foreground">Active</p>
            </div>
            <p className="text-2xl font-bold">{summary?.totalActive || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Star className="w-4 h-4 text-yellow-500" />
              <p className="text-sm text-muted-foreground">Lifetime Deals</p>
            </div>
            <p className="text-2xl font-bold">{summary?.totalLifetime || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-rose-500" />
              <p className="text-sm text-muted-foreground">Monthly Cost</p>
            </div>
            <p className="text-2xl font-bold text-rose-500">
              {formatCurrency(summary?.monthlyEquivalent || 0)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Yearly Cost</p>
            </div>
            <p className="text-2xl font-bold">
              {formatCurrency(summary?.yearlyCost || 0)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filter Tabs */}
      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList>
          <TabsTrigger value="ACTIVE">Active</TabsTrigger>
          <TabsTrigger value="LIFETIME">Lifetime</TabsTrigger>
          <TabsTrigger value="PAUSED">Paused</TabsTrigger>
          <TabsTrigger value="CANCELLED">Cancelled</TabsTrigger>
          <TabsTrigger value="ALL">All</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Subscriptions List */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="pt-6">
                <div className="h-24 bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : subsList.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {subsList.map((sub) => (
            <Card key={sub.id} className="hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    {sub.logo ? (
                      <img
                        src={sub.logo}
                        alt={sub.name}
                        className="w-10 h-10 rounded-lg border"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                        <span className="text-lg font-bold">
                          {sub.name.charAt(0)}
                        </span>
                      </div>
                    )}
                    <div>
                      <p className="font-medium text-lg">{sub.name}</p>
                      {sub.category && (
                        <p className="text-sm text-muted-foreground">
                          {sub.category}
                        </p>
                      )}
                    </div>
                  </div>
                  <Badge
                    variant={
                      sub.status === "ACTIVE"
                        ? "default"
                        : sub.status === "LIFETIME"
                        ? "secondary"
                        : "outline"
                    }
                  >
                    {sub.status === "LIFETIME" ? (
                      <span className="flex items-center gap-1">
                        <Star className="w-3 h-3" /> Lifetime
                      </span>
                    ) : (
                      sub.status
                    )}
                  </Badge>
                </div>

                <div className="space-y-3">
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold">
                      {formatCurrency(Number(sub.amount))}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      /{sub.billingCycle.toLowerCase()}
                    </span>
                  </div>

                  {sub.nextBillingDate && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="w-4 h-4" />
                      <span>
                        Next billing: {formatDate(sub.nextBillingDate)}
                      </span>
                    </div>
                  )}

                  {sub.email && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Mail className="w-4 h-4" />
                      <span>{sub.email}</span>
                    </div>
                  )}

                  {sub.website && (
                    <a
                      href={sub.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-primary hover:underline"
                    >
                      <Globe className="w-4 h-4" />
                      {sub.website.replace(/^https?:\/\//, "")}
                    </a>
                  )}

                  {sub.description && (
                    <p className="text-sm text-muted-foreground">
                      {sub.description}
                    </p>
                  )}

                  {sub.status === "ACTIVE" && (
                    <div className="flex gap-2 pt-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          cancelSub?.mutate({ id: sub.id })
                        }
                        disabled={cancelSub?.isPending}
                      >
                        <X className="w-4 h-4 mr-1" />
                        Cancel
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <RefreshCw className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No subscriptions found</p>
              <p className="text-sm text-muted-foreground">
                Add your first subscription to start tracking
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
