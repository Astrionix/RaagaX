import React from 'react';

interface FlacLogoProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  className?: string;
}

export function FlacLogo({
  size = 14,
  className = '',
  style,
  ...props
}: FlacLogoProps) {
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      className={`inline-block shrink-0 fill-current ${className}`}
      style={{ verticalAlign: 'middle', ...style }}
      aria-hidden="true"
      {...props}
    >
      <g>
        <rect x="12" y="12" width="10" height="10" />
        <rect x="42" y="12" width="10" height="10" />
        <rect x="72" y="12" width="10" height="10" />
        <rect x="27" y="27" width="10" height="10" />
        <rect x="57" y="27" width="10" height="10" />
        <rect x="87" y="27" width="10" height="10" />
        <rect x="12" y="42" width="10" height="10" />
        <rect x="42" y="42" width="10" height="10" />
        <rect x="72" y="42" width="10" height="10" />
        <rect x="12" y="57" width="10" height="10" />
        <rect x="27" y="57" width="10" height="10" />
        <rect x="42" y="57" width="10" height="10" />
        <rect x="57" y="57" width="10" height="10" />
        <rect x="72" y="57" width="10" height="10" />
        <rect x="87" y="57" width="10" height="10" />
        <rect x="12" y="72" width="10" height="10" />
        <rect x="27" y="72" width="10" height="10" />
        <rect x="42" y="72" width="10" height="10" />
        <rect x="57" y="72" width="10" height="10" />
        <rect x="72" y="72" width="10" height="10" />
        <rect x="87" y="72" width="10" height="10" />
        <rect x="12" y="87" width="10" height="10" />
        <rect x="27" y="87" width="10" height="10" />
        <rect x="42" y="87" width="10" height="10" />
        <rect x="57" y="87" width="10" height="10" />
        <rect x="72" y="87" width="10" height="10" />
        <rect x="87" y="87" width="10" height="10" />
      </g>
    </svg>
  );
}

export default FlacLogo;

