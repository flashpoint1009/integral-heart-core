import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { repCheckIn, repCheckOut } from "@/lib/api/rep.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MapPin, LogIn, LogOut, Loader2, Navigation } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/rep/attendance")({
  component: Attendance,
});

function getPos(): Promise<{ lat: number | null; lng: number | null }> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve({ lat: null, lng: null });
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve({ lat: null, lng: null }),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  });
}

function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat/2)**2 + Math.cos(toRad(a.lat))*Math.cos(toRad(b.lat))*Math.sin(dLng/2)**2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function Attendance() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const ci = useServerFn(repCheckIn);
  const co = useServerFn(repCheckOut);
  const [loadingGps, setLoadingGps] = useState(false);
  const [myPos, setMyPos] = useState<{ lat: number; lng: number } | null>(null);
  const [posError, setPosError] = useState<string | null>(null);
  const autoTriedRef = useRef(false);

  const { data: office } = useQuery({
    queryKey: ["company_office"],
    queryFn: async () => {
      const { data } = await supabase.from("company_settings").select("extra").limit(1).maybeSingle();
      const ex: any = data?.extra ?? {};
      if (ex.office_lat == null || ex.office_lng == null) return null;
      return { lat: Number(ex.office_lat), lng: Number(ex.office_lng), radius: Number(ex.office_radius_m ?? 150) };
    },
  });

  const { data: openCi } = useQuery({
    queryKey: ["rep_open_checkin"],
    queryFn: async () => {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const { data } = await supabase.from("rep_check_ins").select("*").gte("check_in_at", today.toISOString()).order("check_in_at", { ascending: false }).limit(1).maybeSingle();
      return data;
    },
  });

  const checkIn = useMutation({
    mutationFn: async () => { setLoadingGps(true); const p = await getPos(); setLoadingGps(false); return await ci({ data: p }); },
    onSuccess: () => { toast.success(t("rep.checkedIn")); qc.invalidateQueries({ queryKey: ["rep_open_checkin"] }); qc.invalidateQueries({ queryKey: ["rep_dashboard_today"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const checkOut = useMutation({
    mutationFn: async () => { setLoadingGps(true); const p = await getPos(); setLoadingGps(false); return await co({ data: p }); },
    onSuccess: () => { toast.success(t("rep.checkedOut")); qc.invalidateQueries({ queryKey: ["rep_open_checkin"] }); qc.invalidateQueries({ queryKey: ["rep_dashboard_today"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const active = openCi && !openCi.check_out_at;
  const ended = openCi && openCi.check_out_at;

  // Track position
  useEffect(() => {
    if (!navigator.geolocation) { setPosError("الجهاز لا يدعم GPS"); return; }
    const id = navigator.geolocation.watchPosition(
      (pos) => { setMyPos({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setPosError(null); },
      (err) => setPosError(err.message),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  const dist = myPos && office ? distanceMeters(myPos, office) : null;
  const inRange = dist !== null && office ? dist <= office.radius : false;

  // Auto check-in when entering range
  useEffect(() => {
    if (autoTriedRef.current) return;
    if (!office || !myPos) return;
    if (active || ended) return;
    if (!inRange) return;
    autoTriedRef.current = true;
    checkIn.mutate();
  }, [office, myPos, inRange, active, ended]);

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-bold">{t("rep.attendance")}</h1>

      {office && (
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className={`h-10 w-10 rounded-full grid place-items-center ${inRange ? "bg-emerald-500/15 text-emerald-600" : "bg-amber-500/15 text-amber-600"}`}>
              <Navigation className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold">
                {!myPos ? "جارٍ تحديد موقعك…" : inRange ? "أنت داخل نطاق الشركة" : "أنت خارج نطاق الشركة"}
              </div>
              <div className="text-xs text-muted-foreground">
                {dist !== null ? `المسافة: ${Math.round(dist)} م • النطاق: ${office.radius} م` : posError ?? "—"}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      {!office && (
        <Card><CardContent className="p-3 text-xs text-amber-700 dark:text-amber-400">
          لم يتم تحديد موقع الشركة بعد. اطلب من المسؤول ضبطه من الإعدادات لتفعيل الحضور التلقائي.
        </CardContent></Card>
      )}

      <Card>
        <CardContent className="p-6 space-y-4 text-center">
          <div className={`mx-auto h-20 w-20 rounded-full grid place-items-center ${active ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground"}`}>
            <MapPin className="h-10 w-10" />
          </div>
          <div>
            <div className="text-sm text-muted-foreground">{t("rep.status")}</div>
            <div className="text-lg font-bold">
              {active ? t("rep.dayActive") : ended ? t("rep.dayEnded") : t("rep.notCheckedIn")}
            </div>
            {openCi && <div className="text-xs text-muted-foreground mt-1">
              {t("rep.checkInTime")}: {new Date(openCi.check_in_at).toLocaleTimeString()}
              {openCi.check_out_at && <> · {t("rep.checkOutTime")}: {new Date(openCi.check_out_at).toLocaleTimeString()}</>}
            </div>}
          </div>

          {!active && !ended && (
            <Button size="lg" className="w-full h-14 text-base rounded-2xl" onClick={() => checkIn.mutate()} disabled={checkIn.isPending || loadingGps}>
              {(checkIn.isPending || loadingGps) ? <Loader2 className="h-5 w-5 animate-spin me-2" /> : <LogIn className="h-5 w-5 me-2" />}
              {t("rep.startDay")}
            </Button>
          )}
          {active && (
            <Button size="lg" variant="destructive" className="w-full h-14 text-base rounded-2xl" onClick={() => checkOut.mutate()} disabled={checkOut.isPending || loadingGps}>
              {(checkOut.isPending || loadingGps) ? <Loader2 className="h-5 w-5 animate-spin me-2" /> : <LogOut className="h-5 w-5 me-2" />}
              {t("rep.endDay")}
            </Button>
          )}
          {ended && <div className="text-sm text-emerald-600">{t("rep.dayCompleted")}</div>}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground text-center">{t("rep.gpsHint")}</p>
    </div>
  );
}