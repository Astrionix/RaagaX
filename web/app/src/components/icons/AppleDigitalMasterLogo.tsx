import React from 'react';

interface AppleDigitalMasterLogoProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  className?: string;
}

export function AppleDigitalMasterLogo({
  size = 14,
  className = '',
  style,
  ...props
}: AppleDigitalMasterLogoProps) {
  const height = typeof size === 'number' ? size : 14;
  const width = typeof size === 'number' ? Math.round((Number(height) * 120) / 90) : 'auto';

  return (
    <svg
      viewBox="0 0 120 90"
      width={width}
      height={height}
      fill="none"
      stroke="currentColor"
      strokeWidth={7}
      strokeLinejoin="round"
      xmlns="http://www.w3.org/2000/svg"
      className={`inline-block shrink-0 ${className}`}
      style={{ verticalAlign: 'middle', ...style }}
      aria-hidden="true"
      {...props}
    >
      <path d="M12 61 12 28Q12 13 27 22L56 42 88 10Q106 -2 106 18V72Q106 88 90 78L58 57 29 82Q12 92 12 75Z" />
    </svg>
  );
}

export default AppleDigitalMasterLogo;
