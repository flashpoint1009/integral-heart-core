import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Languages } from "lucide-react";

export function LanguageToggle() {
  const { i18n } = useTranslation();
  const toggle = () => {
    const next = i18n.language === "ar" ? "en" : "ar";
    i18n.changeLanguage(next);
  };
  return (
    <Button variant="ghost" size="sm" onClick={toggle} className="gap-2">
      <Languages className="h-4 w-4" />
      {i18n.language === "ar" ? "EN" : "عربي"}
    </Button>
  );
}