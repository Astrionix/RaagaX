"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, Flame, Search, Library } from "lucide-react";

export default function MobileNav() {
  const pathname = usePathname();

  const links = [
    { name: "Listen Now", href: "/", icon: Compass },
    { name: "Explore", href: "/explore", icon: Flame },
    { name: "Search", href: "/search", icon: Search },
    { name: "Library", href: "/library", icon: Library },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 h-16 bg-[#0D0D0F]/95 backdrop-blur-2xl border-t border-white/10 flex items-center justify-around px-2 select-none">
      {links.map((link) => {
        const Icon = link.icon;
        const isActive = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`flex flex-col items-center justify-center w-16 py-1 transition-all ${
              isActive
                ? "text-raaga-red font-bold"
                : "text-neutral-400 hover:text-white font-normal"
            }`}
          >
            <Icon className="w-5 h-5" />
            <span className="text-[10px] mt-1">{link.name}</span>
          </Link>
        );
      })}
    </nav>
  );
}
