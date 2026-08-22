'use client';

import type { ReactNode } from 'react';

/** Header konsisten S02 untuk layar master budidaya */
export function AquaMasterShell({
  screen,
  title,
  lead,
  children,
}: {
  screen: string;
  title: string;
  lead?: string;
  children: ReactNode;
}) {
  return (
    <section className="panel aqua-s02 aqua-master-shell" data-screen={screen}>
      <div className="p-4 mb-4 bg-red-500 text-white rounded">
        <h1 className="text-4xl font-extrabold tracking-tight">GUE DISINI</h1>
      </div>
      <div className="aqua-s02-top">
        <div className="aqua-s02-who">Master data</div>
        {lead ? <div className="aqua-s02-sub">{lead}</div> : null}
      </div>
      <h2 className="aqua-s02-title">{title}</h2>
      {children}
    </section>
  );
}
