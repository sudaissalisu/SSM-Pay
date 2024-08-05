import type { SVGProps } from 'react';

export function Logo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M7 3v10a4 4 0 0 0 4 4h6" />
      <path d="M20 17V7a4 4 0 0 0-4-4H7" />
    </svg>
  );
}

export function SSMLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M8.3 10a.7.7 0 0 1-.7.7H4" />
      <path d="M6 10.7v10.6" />
      <path d="M8.3 14.4a.7.7 0 0 1-.7.7H4" />
      <path d="M8.3 18.8a.7.7 0 0 1-.7.7H4" />
      <path d="M15.7 10a.7.7 0 0 0 .7.7h3.6" />
      <path d="M18 10.7v10.6" />
      <path d="M15.7 14.4a.7.7 0 0 0 .7.7h3.6" />
      <path d="M15.7 18.8a.7.7 0 0 0 .7.7h3.6" />
      <path d="M12 2.7v18.6" />
    </svg>
  );
}
