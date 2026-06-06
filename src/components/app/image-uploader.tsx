import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getUploadUrl } from "@/lib/api/storefront.functions";
import { Button } from "@/components/ui/button";
import { Upload, X, Loader2, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";

type Props = {
  value: string | null | undefined;
  onChange: (path: string | null) => void;
  folder?: "banners" | "logo" | "hero" | "sections" | "products";
  aspect?: "video" | "square" | "wide";
  label?: string;
};

export function ImageUploader({ value, onChange, folder = "sections", aspect = "video", label }: Props) {
  const getUrl = useServerFn(getUploadUrl);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const display = preview ?? (value && (value.startsWith("http") ? value : null));

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return toast.error("الحد الأقصى 5MB");
    setBusy(true);
    try {
      const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase();
      const r = await getUrl({ data: { folder, ext } });
      const up = await fetch(r.signedUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!up.ok) throw new Error("فشل الرفع");
      onChange(r.path);
      setPreview(r.previewUrl);
      toast.success("تم رفع الصورة");
    } catch (err: any) {
      toast.error(err.message || "تعذّر الرفع");
    } finally {
      setBusy(false);
    }
  }

  const aspectCls = aspect === "square" ? "aspect-square" : aspect === "wide" ? "aspect-[21/9]" : "aspect-video";

  return (
    <div className="space-y-2">
      {label && <div className="text-xs font-medium text-muted-foreground">{label}</div>}
      <div className={`relative ${aspectCls} w-full overflow-hidden rounded-xl border border-dashed bg-muted/30`}>
        {display ? (
          <img src={display} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : value ? (
          <div className="absolute inset-0 grid place-items-center text-xs text-muted-foreground">
            <ImageIcon className="h-6 w-6 opacity-50" />
            <span className="mt-1">صورة محفوظة</span>
          </div>
        ) : (
          <div className="absolute inset-0 grid place-items-center text-xs text-muted-foreground">
            <ImageIcon className="h-8 w-8 opacity-40" />
            <span className="mt-1">لا توجد صورة</span>
          </div>
        )}
        {busy && (
          <div className="absolute inset-0 grid place-items-center bg-background/70">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        )}
      </div>
      <div className="flex gap-2">
        <label className="flex-1">
          <input type="file" accept="image/*" className="hidden" onChange={onFile} disabled={busy} />
          <span className="inline-flex w-full h-9 cursor-pointer items-center justify-center gap-2 rounded-md border bg-card text-sm font-medium hover:bg-accent">
            <Upload className="h-4 w-4" /> {value ? "تغيير الصورة" : "رفع صورة"}
          </span>
        </label>
        {value && (
          <Button type="button" variant="outline" size="icon" onClick={() => { onChange(null); setPreview(null); }}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}