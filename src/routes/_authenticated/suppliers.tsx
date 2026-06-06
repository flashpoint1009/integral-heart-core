import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { PlaceholderPage } from "@/components/app/placeholder-page";
export const Route = createFileRoute("/_authenticated/suppliers")({ component: Page });
function Page() { const { t } = useTranslation(); return <PlaceholderPage title={t("nav.suppliers")} />; }