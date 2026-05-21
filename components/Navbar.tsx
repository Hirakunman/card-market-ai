"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  TrendingUp,
  TrendingDown,
  Search,
  BarChart2,
  Calendar,
  Flame,
} from "lucide-react";
import { cn } from "@/lib/utils";

const links = [
  { href: "/", label: "ホーム", short: "ホーム", icon: BarChart2 },
  { href: "/search", label: "検索", short: "検索", icon: Search },
  { href: "/ranking/rise", label: "高騰予測", short: "高騰", icon: TrendingUp },
  { href: "/ranking/fall", label: "暴落予測", short: "暴落", icon: TrendingDown },
  { href: "/ranking/mercari-surge", label: "メルカリ急騰", short: "急騰", icon: Flame },
  { href: "/calendar/reprints", label: "再販", short: "再販", icon: Calendar },
];

export function Navbar() {
  const pathname = usePathname();

  return (
    <nav className="border-b border-[#2a2a2e] bg-[#0d0d0f] sticky top-0 z-50">
      <div className="mx-auto max-w-7xl px-4">
        <div className="flex h-14 items-center justify-between gap-2">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg tracking-tight shrink-0">
            <BarChart2 className="w-5 h-5 text-blue-500" />
            <span className="hidden xs:inline">CardMarket AI</span>
            <span className="xs:hidden text-sm">CMAI</span>
          </Link>

          <div className="flex items-center gap-0.5 overflow-x-auto">
            {links.map(({ href, label, short, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-md text-xs sm:text-sm transition-colors whitespace-nowrap shrink-0",
                  pathname === href
                    ? "bg-[#1e1e22] text-white"
                    : "text-[#9ca3af] hover:text-white hover:bg-[#1a1a1e]"
                )}
              >
                <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">{label}</span>
                <span className="sm:hidden">{short}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </nav>
  );
}
