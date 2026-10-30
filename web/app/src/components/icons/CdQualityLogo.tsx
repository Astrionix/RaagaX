import React from 'react';

interface CdQualityLogoProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  className?: string;
}

export function CdQualityLogo({
  size = 14,
  className = '',
  style,
  ...props
}: CdQualityLogoProps) {
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      className={`inline-block shrink-0 ${className}`}
      style={{ verticalAlign: 'middle', ...style }}
      aria-hidden="true"
      {...props}
    >
      <circle cx="50" cy="50" r="43" strokeWidth="5" />
      <circle cx="50" cy="50" r="29" strokeWidth="4" />
      <circle cx="50" cy="50" r="8" fill="currentColor" stroke="none" />
    </svg>
  );
}

export default CdQualityLogo;
