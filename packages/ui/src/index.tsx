import * as React from 'react';

export function Card(props: React.PropsWithChildren<{ title: string }>) {
  return (
    <section className="rounded border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="mb-2 text-lg font-semibold">{props.title}</h2>
      <div>{props.children}</div>
    </section>
  );
}
