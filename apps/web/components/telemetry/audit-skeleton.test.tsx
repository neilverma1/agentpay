import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AuditPageSkeleton } from './audit-page-skeleton';
import { AuditTableSkeleton } from './audit-table-skeleton';

describe('Audit Skeletons', () => {
  describe('AuditTableSkeleton', () => {
    it('renders real table headers matching exact columns and titles', () => {
      render(<AuditTableSkeleton />);

      expect(screen.getByText('Timestamp')).toBeInTheDocument();
      expect(screen.getByText('Merchant')).toBeInTheDocument();
      expect(screen.getByText('Purchase Item')).toBeInTheDocument();
      expect(screen.getByText('Amount')).toBeInTheDocument();
      expect(screen.getByText('Status')).toBeInTheDocument();
    });

    it('renders search placeholder input in disabled state', () => {
      render(<AuditTableSkeleton />);

      const searchInput = screen.getByPlaceholderText(/Search merchants, items, prompts/i);
      expect(searchInput).toBeInTheDocument();
      expect(searchInput).toBeDisabled();
    });

    it('renders per-row skeletons with default count of 10 rows', () => {
      const { container } = render(<AuditTableSkeleton />);

      const tbody = container.querySelector('tbody');
      expect(tbody).not.toBeNull();
      expect(tbody?.querySelectorAll('tr')).toHaveLength(10);
    });

    it('renders real pagination UI inside table card', () => {
      render(<AuditTableSkeleton />);

      expect(screen.getByText('Rows per page')).toBeInTheDocument();
      expect(screen.getByText('Page 1 of 1')).toBeInTheDocument();
    });

    it('supports custom rowCount', () => {
      const { container } = render(<AuditTableSkeleton rowCount={3} />);

      const tbody = container.querySelector('tbody');
      expect(tbody?.querySelectorAll('tr')).toHaveLength(3);
    });
  });

  describe('AuditPageSkeleton', () => {
    it('renders page title and description as real text', () => {
      render(<AuditPageSkeleton />);

      expect(screen.getByRole('heading', { level: 1, name: 'Audit Logs' })).toBeInTheDocument();
      expect(
        screen.getByText(/Interactive real-time audit log of all autonomous purchase intents/i),
      ).toBeInTheDocument();
    });

    it('renders the embedded table skeleton with headers', () => {
      render(<AuditPageSkeleton />);

      expect(screen.getByText('Timestamp')).toBeInTheDocument();
      expect(screen.getByText('Purchase Item')).toBeInTheDocument();
    });
  });
});
