import React from 'react';

export default function Logo(props: React.SVGProps<SVGSVGElement>) {
  return <svg xmlns="http://www.w3.org/2000/svg" {...props} viewBox="0 0 40 40">
    <g fill="currentColor" fill-rule="evenodd">
      <path
        d="M42.005 0 31.504 9.231 21.002 0 10.501 9.231 0 0v10.769L10.501 20l10.501-9.231L31.504 20l10.501-9.231zM31.504 29.231 21.002 20l-10.501 9.231L0 20v10.769L10.501 40l10.501-9.231L31.504 40l10.501-9.231V20z" />
    </g>
  </svg>;
}