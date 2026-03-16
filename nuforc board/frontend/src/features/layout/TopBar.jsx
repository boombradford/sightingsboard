export default function TopBar({ children, actions, breadcrumb }) {
  return (
    <div className="sticky top-0 z-30 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur-sm">
      <div className="flex items-center justify-between gap-2 px-3 py-2 sm:gap-3 sm:px-5 sm:py-2.5">
        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto sm:gap-3">
          {/* Breadcrumb — collapsed on mobile */}
          {breadcrumb && breadcrumb.length > 0 && (
            <>
              <nav className="hidden shrink-0 items-center gap-1.5 sm:flex">
                {breadcrumb.map((crumb, i) => (
                  <span key={i} className="flex items-center gap-1.5">
                    {i > 0 && (
                      <svg width="10" height="10" viewBox="0 0 16 16" fill="none" className="text-zinc-600">
                        <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                    <span className={`text-caption whitespace-nowrap ${
                      i === 0
                        ? "font-display font-semibold text-zinc-200"
                        : i === breadcrumb.length - 1
                          ? "font-medium text-zinc-200"
                          : "text-zinc-400"
                    }`}>
                      {crumb}
                    </span>
                  </span>
                ))}
              </nav>
              {/* Mobile: just show current mode */}
              <span className="font-display text-caption font-semibold text-zinc-200 sm:hidden">
                {breadcrumb[1] || breadcrumb[0]}
              </span>

              <div className="hidden h-4 w-px shrink-0 bg-zinc-800 sm:block" />
            </>
          )}

          {children}
        </div>
        {actions && (
          <div className="flex shrink-0 items-center gap-2">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
