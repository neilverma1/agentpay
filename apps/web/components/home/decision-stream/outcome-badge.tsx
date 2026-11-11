import { Badge } from '@workspace/ui/components/badge';
import type { ReactElement } from 'react';

import type { Outcome } from '@/components/home/home-content';

const LABELS: Record<Outcome, string> = {
  captured: 'Captured',
  pending: 'Needs approval',
  blocked: 'Blocked',
};

/** Outcome badge: color is always paired with an icon and a text label. */
export function OutcomeBadge({ outcome }: { outcome: Outcome }): ReactElement {
  return (
    <Badge variant={outcome} icon>
      {LABELS[outcome]}
    </Badge>
  );
}
