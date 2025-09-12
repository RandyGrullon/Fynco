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
import { PlusCircle, RefreshCcw } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import dynamic from "next/dynamic";
import { useRouter } from "@/i18n/routing";
import AccountsPageClient from "@/components/accounts/accounts-page-client";
import { AddAccountDialog } from "@/components/add-account-dialog";
import AccountsOverview from "@/components/accounts/accounts-overview";
import { useData } from "@/contexts/data-context";
import { useTranslations } from "next-intl";
import { useCurrencyFormatter } from "@/hooks/use-currency-formatter";

export default function AccountsPage() {
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
        </div>
        <div className="mt-6">
          <Skeleton className="h-[500px]" />
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-2 sm:space-y-0 mb-4">
        <h2 className="text-3xl font-bold tracking-tight font-headline">
          {t('accounts.title')}
        </h2>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto mt-2 sm:mt-0">
          <Button
            variant="outline"
            size="icon"
            onClick={refreshAccounts}
            className="shrink-0"
          >
            <RefreshCcw className="h-4 w-4" />
          </Button>
          <AddAccountDialog onAccountAdded={refreshAccounts} />
        </div>
      </div>

      <Tabs defaultValue="list" className="w-full">
        <TabsList className="mb-4 w-full sm:w-auto">
          <TabsTrigger value="list" className="flex-1 sm:flex-none">
            {t('accounts.accountsList')}
          </TabsTrigger>
          <TabsTrigger value="overview" className="flex-1 sm:flex-none">
            {t('accounts.overview')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="space-y-4">
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {t('financial.totalBalance')}
                </CardTitle>
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
