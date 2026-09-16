 "use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Item = { id: string; title: string; message: string; href?: string | null; read: boolean; createdAt: string };

export default function NotificationBell() {
  const [items, setItems] = useState<Item[]>([]);
  const [open, setOpen] = useState(false);

  const load = async () => {
    try {
      await fetch("/api/notifications/alerts", { method: "POST" });
      const res = await fetch("/api/notifications?limit=8");
      if (res.ok) {
        const data = await res.json();
        setItems(data.notifications || data || []);
      }
    } catch {}
  };

  useEffect(() => {
    load();
    const timer = setInterval(load, 60000);
    return () => clearInterval(timer);
  }, []);

  const unread = items.filter((n) => !n.read).length;

  return (
    <div className="relative">
      <button onClick={() => { setOpen(!open); if (!open) load(); }} className="relative rounded-lg border px-3 py-2 hover:bg-muted" aria-label="Notifications">
        🔔
        {unread > 0 && <span className="absolute -right-2 -top-2 rounded-full bg-red-500 px-1.5 text-xs text-white">{unread > 99 ? "99+" : unread}</span>}
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-96 max-w-[90vw] rounded-xl border bg-background p-3 shadow-xl">
          <div className="mb-2 flex items-center justify-between"><strong>Notifications</strong><Link href="/notifications" className="text-sm underline">View all</Link></div>
          <div className="max-h-96 space-y-2 overflow-auto">
            {items.length === 0 ? <p className="p-3 text-sm text-muted-foreground">You are all caught up.</p> : items.map((n) => (
              <Link key={n.id} href={n.href || "/notifications"} className={`block rounded-lg border p-3 hover:bg-muted ${!n.read ? "border-primary/40" : ""}`}>
                <div className="font-medium">{n.title}</div><div className="text-sm text-muted-foreground">{n.message}</div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
