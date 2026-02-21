interface LogoProps {
  size?: number;
  showText?: boolean;
  textSuffix?: string;
  className?: string;
}

/**
 * Doc Partner Logo — two navy rounded shapes with orange dot
 * Based on brand: Primary #1E293B (deep navy), Accent #F97316 (warm orange)
 */
export default function Logo({ size = 40, showText = true, textSuffix, className = "" }: LogoProps) {
  const iconSize = size;

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <svg
        width={iconSize}
        height={iconSize}
        viewBox="0 0 100 80"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Doc Partner Logo"
      >
        {/* Left rounded shape */}
        <ellipse cx="28" cy="35" rx="22" ry="25" fill="#1E293B" />
        {/* Right rounded shape */}
        <ellipse cx="72" cy="35" rx="22" ry="25" fill="#1E293B" />
        {/* Center orange dot */}
        <circle cx="50" cy="35" r="6" fill="#F97316" />
      </svg>
      {showText && (
        <div className="flex flex-col leading-tight">
          <span className="font-bold text-sm" style={{ color: '#1E293B' }}>Doc</span>
          <span className="font-bold text-sm" style={{ color: '#1E293B' }}>
            Partner{textSuffix ? ` ${textSuffix}` : ''}
          </span>
        </div>
      )}
    </div>
  );
}
