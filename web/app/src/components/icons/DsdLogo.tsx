import React from 'react';

interface DsdLogoProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  className?: string;
}

export function DsdLogo({
  size = 14,
  className = '',
  style,
  ...props
}: DsdLogoProps) {
  const height = typeof size === 'number' ? size : 14;
  const width = typeof size === 'number' ? Math.round((Number(height) * 150) / 80) : 'auto';

  return (
    <svg
      viewBox="0 0 150 80"
      width={width}
      height={height}
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      className={`inline-block shrink-0 fill-current ${className}`}
      style={{ verticalAlign: 'middle', ...style }}
      aria-hidden="true"
      {...props}
    >
      <text
        x="4"
        y="62"
        fontFamily="Georgia, serif"
        fontSize="64"
        fontWeight="bold"
        fill="currentColor"
        letterSpacing="-4"
      >
        DSD
      </text>
    </svg>
  );
}

export default DsdLogo;
