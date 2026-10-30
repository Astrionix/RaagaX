import React from 'react';

interface MqaLogoProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  className?: string;
}

export function MqaLogo({
  size = 14,
  className = '',
  style,
  ...props
}: MqaLogoProps) {
  const height = typeof size === 'number' ? size : 14;
  const width = typeof size === 'number' ? Math.round((Number(height) * 120) / 100) : 'auto';

  return (
    <svg
      viewBox="0 0 120 100"
      width={width}
      height={height}
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      className={`inline-block shrink-0 fill-current ${className}`}
      style={{ verticalAlign: 'middle', ...style }}
      aria-hidden="true"
      {...props}
    >
      <circle cx="50" cy="50" r="43" fill="currentColor" />
      <path
        d="M14 53h72 M23 53c8-38 14-38 22 0s14 38 22 0 14-38 22 0"
        fill="none"
        stroke="#000"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default MqaLogo;

