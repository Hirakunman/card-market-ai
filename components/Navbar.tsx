"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { TrendingUp, TrendingDown, Search, BarChart2 } from "lucide-react";
import { cn } from "@/lib/utils";

const links = [
  { href: "/", label: "ホーム", icon: BarChart2 },
  { href: "/search", label: "カード検索", icon: Search },
  { href: "/ranking/rise", label: "高騰ランキング", icon: TrendingUp },
  { href: "/ranking/fall", label: "暴落ランキング", icon: TrendingDown },
];

export function Navbar() {
  const pathname = usePathname();

  return (
    <nav className="border-b border-[#2a2a2e] bg-[#0d0d0f] sticky top-0 z-50">
      <div className="mx-auto max-w-7xl px-4">
        <div className="flex h-14 items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg tracking-tight">
            <BarChart2 className="w-5 h-5 text-blue-500" />
            <span>CardMarket AI</span>
          </Link>

          <div className="flex items-center gap-1">
            {links.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors",
                  pathname === href
                    ? "bg-[#1e1e22] text-white"
                    : "text-[#9ca3af] hover:text-white hover:bg-[#1a1a1e]"
                )}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{label}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </nav>
  );
}
