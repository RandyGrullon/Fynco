"use client";

import { useAuth } from "@/hooks/use-auth";
import { Account } from "@/lib/accounts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { PlusCircle, RefreshCcw, DollarSign } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRouter } from "@/i18n/routing";
import AccountsPageClient from "@/components/accounts/accounts-page-client";
import { AddAccountDialog } from "@/components/add-account-dialog";
import AccountsOverview from "@/components/accounts/accounts-overview";
import { useData } from "@/contexts/data-context";
import { useTranslations } from "next-intl";
import { useCurrencyFormatter } from "@/hooks/use-currency-formatter";

export function AccountsPageWrapper() {
  const { user } = useAuth();
  const { accounts, isLoading, refreshAccounts } = useData();
  const t = useTranslations();
  const { formatCurrency } = useCurrencyFormatter();

  // Calculate total balance across all accounts
  const totalBalance = accounts.reduce(
    (sum, account) => sum + account.balance,
    0
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-2 sm:space-y-0">
          <Skeleton className="h-9 w-48" />
          <div className="flex flex-wrap gap-2 mt-2 sm:mt-0">
            <Skeleton className="h-10 w-10" />
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-32" />
          </div>
        </div>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-7">
          <Skeleton className="h-[400px] col-span-1 md:col-span-2 lg:col-span-4" />
          <Skeleton className="h-[400px] col-span-1 md:col-span-2 lg:col-span-3" />
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-2 sm:space-y-0">
        <h1 className="text-3xl font-bold tracking-tight">
          {t('accounts.title')}
        </h1>
        <div className="flex flex-wrap gap-2 mt-2 sm:mt-0">
          <Button variant="outline" size="sm" onClick={refreshAccounts}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            {t('common.refresh')}
          </Button>
          <AddAccountDialog onAccountAdded={refreshAccounts}>
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" />
              {t('accounts.addAccount')}
            </Button>
          </AddAccountDialog>
        </div>
      </div>

      <Tabs defaultValue="accounts" className="space-y-4">
        <TabsList>
          <TabsTrigger value="accounts">{t('accounts.title')}</TabsTrigger>
          <TabsTrigger value="overview">{t('accounts.overview')}</TabsTrigger>
        </TabsList>
        <TabsContent value="accounts" className="space-y-4">
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {t('accounts.totalBalance')}
                </CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(totalBalance)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {t('accounts.acrossAllAccounts')}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t('accounts.title')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{accounts.length}</div>
                <p className="text-xs text-muted-foreground">{t('accounts.activeAccounts')}</p>
              </CardContent>
            </Card>
          </div>

          <div className="mt-6">
            {accounts.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-8 sm:py-10">
                  <p className="mb-4 text-center text-sm sm:text-base text-muted-foreground">
                    {t('accounts.noAccountsYet')}
                  </p>
                  <AddAccountDialog onAccountAdded={refreshAccounts}>
                    <Button>
                      <PlusCircle className="mr-2 h-4 w-4" />
                      {t('accounts.createFirstAccount')}
                    </Button>
                  </AddAccountDialog>
                </CardContent>
              </Card>
            ) : (
              <div>
                <AccountsPageClient
                  accounts={accounts}
                  refreshAccounts={refreshAccounts}
                />
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="overview">
          <AccountsOverview accounts={accounts} />
        </TabsContent>
      </Tabs>
    </>
  );
}
