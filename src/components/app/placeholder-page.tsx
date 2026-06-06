import { useTranslation } from "react-i18next";
import { PageHeader } from "./page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Construction } from "lucide-react";

export function PlaceholderPage({ title }: { title: string }) {
  const { t } = useTranslation();
  return (
    <div className="p-6">
      <PageHeader title={title} />
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <Construction className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-1">{t("common.comingSoon")}</h3>
          <p className="text-sm text-muted-foreground max-w-md">
            هتتبني الشاشة دي في المراحل القادمة. الـ Database والـ Auth جاهزين بالفعل.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}