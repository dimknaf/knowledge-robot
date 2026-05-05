import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ColumnTags from '@/components/ColumnTags';

afterEach(() => {
  cleanup();
});

describe('ColumnTags', () => {
  it('renders one button per column', () => {
    render(
      <ColumnTags columns={['company', 'country', 'revenue']} onTagClick={vi.fn()} />
    );

    expect(screen.getByRole('button', { name: /company/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /country/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /revenue/ })).toBeInTheDocument();
  });

  it('shows the singular "column" label when count is 1', () => {
    render(<ColumnTags columns={['only']} onTagClick={vi.fn()} />);
    expect(screen.getByText(/^1 column$/)).toBeInTheDocument();
  });

  it('shows the plural "columns" label when count > 1', () => {
    render(<ColumnTags columns={['a', 'b', 'c']} onTagClick={vi.fn()} />);
    expect(screen.getByText(/^3 columns$/)).toBeInTheDocument();
  });

  it('calls onTagClick with the column name when a chip is clicked', async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();

    render(
      <ColumnTags columns={['company', 'country']} onTagClick={handleClick} />
    );

    await user.click(screen.getByRole('button', { name: /company/ }));
    expect(handleClick).toHaveBeenCalledTimes(1);
    expect(handleClick).toHaveBeenCalledWith('company');

    await user.click(screen.getByRole('button', { name: /country/ }));
    expect(handleClick).toHaveBeenCalledTimes(2);
    expect(handleClick).toHaveBeenLastCalledWith('country');
  });

  it('renders the step badge "1" indicating the Data step', () => {
    const { container } = render(
      <ColumnTags columns={['x']} onTagClick={vi.fn()} />
    );
    const badge = container.querySelector('.step-badge');
    expect(badge).not.toBeNull();
    expect(badge?.textContent).toBe('1');
  });
});
