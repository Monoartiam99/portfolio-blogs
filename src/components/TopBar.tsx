import { useState } from 'react';
import type { User } from 'firebase/auth';
import { ChevronDown, LogOut, PenSquare } from 'lucide-react';

interface TopBarProps {
  brandName: string;
  user: User | null;
  isAdmin: boolean;
  activeView: 'home' | 'article' | 'studio';
  onNavigateHome: (sectionId?: string) => void;
  onOpenStudio: () => void;
  onSignIn: () => void;
  onSignOut: () => void;
}

export function TopBar({
  brandName,
  user,
  isAdmin,
  activeView,
  onNavigateHome,
  onOpenStudio,
  onSignIn,
  onSignOut,
}: TopBarProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 bg-[#FAFAFA]/95 backdrop-blur-sm border-b border-zinc-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Single-element brand wordmark */}
        <a
          href="#/"
          onClick={(e) => {
            e.preventDefault();
            onNavigateHome();
          }}
          className="font-serif text-lg sm:text-xl font-semibold tracking-tight text-zinc-950 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1E3A8A]"
        >
          {brandName}
        </a>

        {/* Zone 2: 4 concise single-line nav links */}
        <nav
          aria-label="Primary navigation"
          className="hidden md:flex items-center gap-7 text-sm font-medium text-zinc-600"
        >
          <button
            type="button"
            onClick={() => onNavigateHome('journal')}
            className="hover:text-zinc-950 hover:underline underline-offset-4 decoration-zinc-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer py-2"
          >
            Journal
          </button>
          <button
            type="button"
            onClick={() => onNavigateHome('archive')}
            className="hover:text-zinc-950 hover:underline underline-offset-4 decoration-zinc-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer py-2"
          >
            Archive
          </button>
          <button
            type="button"
            onClick={() => onNavigateHome('portfolio')}
            className="hover:text-zinc-950 hover:underline underline-offset-4 decoration-zinc-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer py-2"
          >
            Portfolio
          </button>
          <button
            type="button"
            onClick={() => onNavigateHome('about')}
            className="hover:text-zinc-950 hover:underline underline-offset-4 decoration-zinc-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer py-2"
          >
            About
          </button>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="relative flex items-center shrink-0">
          {!user ? (
            <button
              type="button"
              onClick={onSignIn}
              className="px-4 py-2 text-xs sm:text-sm font-medium bg-[#1E3A8A] text-white hover:bg-[#1D4ED8] transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1E3A8A]"
            >
              Sign in
            </button>
          ) : isAdmin ? (
            activeView === 'studio' ? (
              <button
                type="button"
                onClick={() => onNavigateHome()}
                className="px-4 py-2 text-xs sm:text-sm font-medium border border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                View Journal
              </button>
            ) : (
              <button
                type="button"
                onClick={onOpenStudio}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-medium bg-[#1E3A8A] text-white hover:bg-[#1D4ED8] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <PenSquare className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Author Studio</span>
              </button>
            )
          ) : (
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((prev) => !prev)}
                className="inline-flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm font-medium border border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <span className="max-w-[120px] truncate">
                  {user.displayName?.split(' ')[0] || 'Account'}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-zinc-500" aria-hidden="true" />
              </button>
              {menuOpen && (
                <div className="absolute right-0 mt-2 w-52 bg-white border border-zinc-200 shadow-sm p-2 z-50">
                  <div className="px-2.5 py-1.5 border-b border-zinc-100 mb-1">
                    <p className="text-xs font-medium text-zinc-900 truncate">
                      {user.displayName || 'Reader'}
                    </p>
                    <p className="text-[11px] text-zinc-500 truncate">{user.email}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onSignOut();
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-2 text-xs text-zinc-700 hover:bg-zinc-50 hover:text-zinc-950 transition-colors cursor-pointer text-left"
                  >
                    <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Sign out</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
