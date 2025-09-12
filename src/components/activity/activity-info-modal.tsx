"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Info, Activity } from "lucide-react";
import { useTranslations } from "next-intl";

interface ActivityInfoModalProps {
  trigger?: React.ReactNode;
}

export function ActivityInfoModal({ trigger }: ActivityInfoModalProps) {
  const t = useTranslations("activity.infoModal");

  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-full">
            <Info className="h-4 w-4 text-muted-foreground hover:text-foreground" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            {t("title")}
          </DialogTitle>
          <DialogDescription>
            {t("description")}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4 auto-rows-fr">
          <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg h-full flex flex-col">
            <h3 className="font-semibold text-base flex items-center gap-2">
              <span className="text-xl">👤</span>
              {t("sections.accounts.title")}
            </h3>
            <ul className="text-sm text-muted-foreground space-y-1 ml-6 mt-3 flex-1">
              <li>• {t("sections.accounts.items.creation")}</li>
              <li>• {t("sections.accounts.items.modification")}</li>
              <li>• {t("sections.accounts.items.deletion")}</li>
            </ul>
          </div>

          <div className="p-4 bg-purple-50 dark:bg-purple-950/20 rounded-lg h-full flex flex-col">
            <h3 className="font-semibold text-base flex items-center gap-2">
              <span className="text-xl">💰</span>
              {t("sections.transactions.title")}
            </h3>
            <ul className="text-sm text-muted-foreground space-y-1 ml-6 mt-3 flex-1">
              <li>• {t("sections.transactions.items.creation")}</li>
              <li>• {t("sections.transactions.items.transfers")}</li>
              <li>• {t("sections.transactions.items.editing")}</li>
            </ul>
          </div>

          <div className="p-4 bg-orange-50 dark:bg-orange-950/20 rounded-lg h-full flex flex-col">
            <h3 className="font-semibold text-base flex items-center gap-2">
              <span className="text-xl">🔁</span>
              {t("sections.recurring.title")}
            </h3>
            <ul className="text-sm text-muted-foreground space-y-1 ml-6 mt-3 flex-1">
              <li>• {t("sections.recurring.items.setup")}</li>
              <li>• {t("sections.recurring.items.modification")}</li>
              <li>• {t("sections.recurring.items.execution")}</li>
            </ul>
          </div>

          <div className="p-4 bg-green-50 dark:bg-green-950/20 rounded-lg h-full flex flex-col">
            <h3 className="font-semibold text-base flex items-center gap-2">
              <span className="text-xl">🎯</span>
              {t("sections.goals.title")}
            </h3>
            <ul className="text-sm text-muted-foreground space-y-1 ml-6 mt-3 flex-1">
              <li>• {t("sections.goals.items.creation")}</li>
              <li>• {t("sections.goals.items.fundsAdded")}</li>
              <li>• {t("sections.goals.items.progress")}</li>
            </ul>
          </div>
        </div>

        <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
          <h4 className="font-semibold mb-2 flex items-center gap-2">
            <span className="text-lg">�</span>
            {t("benefits.title")}
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-muted-foreground">
            <div>
              <ul className="space-y-1">
                <li>• {t("benefits.items.auditTrail")}</li>
                <li>• {t("benefits.items.transparency")}</li>
                <li>• {t("benefits.items.analysis")}</li>
              </ul>
            </div>
            <div>
              <ul className="space-y-1">
                <li>• {t("benefits.items.compliance")}</li>
                <li>• {t("benefits.items.recovery")}</li>
                <li>• {t("benefits.items.insights")}</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/30 rounded-lg">
          <h5 className="font-semibold mb-2 flex items-center gap-2 text-blue-800 dark:text-blue-200">
            <span className="text-sm">🔒</span>
            {t("privacy.title")}
          </h5>
          <p className="text-sm text-blue-800 dark:text-blue-200">
            {t("privacy.description")}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
