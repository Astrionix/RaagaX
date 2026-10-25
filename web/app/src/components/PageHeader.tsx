
import type { ReactNode } from 'react';

/** The page title row (report §1, `.header-nav`). */
export function PageHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="mx-(--body-gutter) flex items-center justify-between gap-3 pt-8">
      <h1 className="type-header-emphasized">{title}</h1>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
