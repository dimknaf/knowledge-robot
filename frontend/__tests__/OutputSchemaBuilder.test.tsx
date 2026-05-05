import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import OutputSchemaBuilder from '@/components/OutputSchemaBuilder';
import type { OutputField } from '@/types';

beforeEach(() => {
  // OutputSchemaBuilder uses window.alert when name is empty
  vi.stubGlobal('alert', vi.fn());
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('OutputSchemaBuilder', () => {
  it('renders empty state when no fields exist', () => {
    render(<OutputSchemaBuilder fields={[]} onFieldsChange={vi.fn()} />);
    expect(screen.getByPlaceholderText(/e\.g\., sentiment/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add field/i })).toBeInTheDocument();
    // No "X fields" counter when empty
    expect(screen.queryByText(/^\d+ fields?$/)).not.toBeInTheDocument();
  });

  it('renders existing fields with their names', () => {
    const fields: OutputField[] = [
      { id: 'a', name: 'sentiment', type: 'text', description: '' },
      { id: 'b', name: 'score', type: 'number', description: 'confidence 0-100' },
    ];
    render(<OutputSchemaBuilder fields={fields} onFieldsChange={vi.fn()} />);

    expect(screen.getByText('sentiment')).toBeInTheDocument();
    expect(screen.getByText('score')).toBeInTheDocument();
    expect(screen.getByText('confidence 0-100')).toBeInTheDocument();
    expect(screen.getByText(/^2 fields$/)).toBeInTheDocument();
  });

  it('adds a new field when name is filled and Add Field is clicked', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(<OutputSchemaBuilder fields={[]} onFieldsChange={handleChange} />);

    await user.type(screen.getByPlaceholderText(/e\.g\., sentiment/i), 'industry');
    await user.click(screen.getByRole('button', { name: /add field/i }));

    expect(handleChange).toHaveBeenCalledTimes(1);
    const newFields = handleChange.mock.calls[0][0] as OutputField[];
    expect(newFields).toHaveLength(1);
    expect(newFields[0].name).toBe('industry');
    expect(newFields[0].type).toBe('text');           // default
    expect(newFields[0].description).toBe('');
    expect(newFields[0].id).toMatch(/^field-\d+$/);
  });

  it('respects the chosen field type when adding', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(<OutputSchemaBuilder fields={[]} onFieldsChange={handleChange} />);

    await user.type(screen.getByPlaceholderText(/e\.g\., sentiment/i), 'count');
    await user.selectOptions(screen.getByRole('combobox'), 'number');
    await user.click(screen.getByRole('button', { name: /add field/i }));

    const newFields = handleChange.mock.calls[0][0] as OutputField[];
    expect(newFields[0].type).toBe('number');
  });

  it('refuses to add a field with empty name (alerts, does not call onChange)', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(<OutputSchemaBuilder fields={[]} onFieldsChange={handleChange} />);

    await user.click(screen.getByRole('button', { name: /add field/i }));

    expect(handleChange).not.toHaveBeenCalled();
    expect((globalThis as unknown as { alert: ReturnType<typeof vi.fn> }).alert).toHaveBeenCalled();
  });

  it('removes a field when its trash icon is clicked', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    const fields: OutputField[] = [
      { id: 'a', name: 'first', type: 'text', description: '' },
      { id: 'b', name: 'second', type: 'text', description: '' },
    ];

    render(<OutputSchemaBuilder fields={fields} onFieldsChange={handleChange} />);

    const removeButtons = screen.getAllByTitle(/remove field/i);
    expect(removeButtons).toHaveLength(2);

    await user.click(removeButtons[0]);

    expect(handleChange).toHaveBeenCalledTimes(1);
    const remaining = handleChange.mock.calls[0][0] as OutputField[];
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe('b');
  });

  it('clears the new-field form after a successful add', async () => {
    const user = userEvent.setup();

    render(<OutputSchemaBuilder fields={[]} onFieldsChange={vi.fn()} />);

    const nameInput = screen.getByPlaceholderText(/e\.g\., sentiment/i) as HTMLInputElement;
    await user.type(nameInput, 'industry');
    expect(nameInput.value).toBe('industry');

    await user.click(screen.getByRole('button', { name: /add field/i }));
    expect(nameInput.value).toBe('');
  });
});
