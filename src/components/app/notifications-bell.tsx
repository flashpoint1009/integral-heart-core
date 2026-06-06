import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { listMyNotifications, markNotificationRead } from "@/lib/api/notifications.functions";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Bell, Check, CheckCheck } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { arSA } from "date-fns/locale";

export function NotificationsBell() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const listFn = useServerFn(listMyNotifications);
  const markFn = useServerFn(markNotificationRead);

  const { data } = useQuery({
    queryKey: ["my_notifications"],
    queryFn: () => listFn(),
    refetchInterval: 30000,
  });

  // Realtime subscription
  useEffect(() => {
    const ch = supabase
      .channel("notifications-rt")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications" }, () => {
        qc.invalidateQueries({ queryKey: ["my_notifications"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const markMut = useMutation({
    mutationFn: (vars: { id?: string; all?: boolean }) => markFn({ data: vars }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my_notifications"] }),
  });

  const items = data?.items ?? [];
  const unread = items.filter((n: any) => !n.is_read).length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full h-9 w-9 relative">
          <Bell className="h-[18px] w-[18px]" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -end-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-background">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[360px] p-0 max-h-[500px] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="font-semibold text-sm">الإشعارات</div>
          {unread > 0 && (
            <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => markMut.mutate({ all: true })}>
              <CheckCheck className="h-3.5 w-3.5" /> تعليم الكل كمقروء
            </Button>
          )}
        </div>
        <div className="overflow-y-auto flex-1">
          {items.length === 0 && (
            <div className="py-10 text-center text-sm text-muted-foreground">لا توجد إشعارات</div>
          )}
          {items.map((n: any) => (
            <button
              key={n.id}
              onClick={() => {
                if (!n.is_read) markMut.mutate({ id: n.id });
                if (n.link) navigate({ to: n.link });
              }}
              className={`w-full text-right px-4 py-3 border-b hover:bg-muted/50 transition-colors ${!n.is_read ? "bg-primary/5" : ""}`}
            >
              <div className="flex items-start gap-2">
                {!n.is_read && <span className="mt-1.5 h-2 w-2 rounded-full bg-primary shrink-0" />}
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate">{n.title}</div>
                  {n.body && <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{n.body}</div>}
                  <div className="text-[10px] text-muted-foreground mt-1">
                    {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: arSA })}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}