'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Zap } from 'lucide-react';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    // Login page does not require authentication
    if (pathname === '/login') {
      setIsAuthenticated(true);
      return;
    }

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('sers_token') : null;
      if (!token) {
        setIsAuthenticated(false);
        router.replace('/login');
      } else {
        setIsAuthenticated(true);
      }
    } catch {
      setIsAuthenticated(false);
      router.replace('/login');
    }
  }, [pathname, router]);

  // When on login page, render children directly
  if (pathname === '/login') {
    return <>{children}</>;
  }

  // If not authenticated or during initial verification, show clean loading state (prevent dashboard flash)
  if (isAuthenticated !== true) {
    return (
      <div className="min-h-screen bg-[#f0f7ff] text-slate-900 flex flex-col items-center justify-center p-6 font-sans">
        <div className="flex flex-col items-center max-w-sm text-center">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-rose-600 to-rose-700 flex items-center justify-center text-white shadow-xl shadow-rose-600/30 animate-pulse mb-5">
            <Zap size={28} />
          </div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2.5 h-2.5 rounded-full bg-rose-600 animate-ping" />
            <span className="font-black text-base tracking-tight text-slate-900">SERS COMMAND DESK</span>
          </div>
          <p className="text-xs font-bold text-slate-500">Verifying secure hospital node session...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
