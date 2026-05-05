'use client';

import { useState } from 'react';
import { Plus, Trash2, FileOutput, Type, Hash, ToggleLeft, Calendar } from 'lucide-react';
import { OutputField, FieldType } from '@/types';

interface OutputSchemaBuilderProps {
  fields: OutputField[];
  onFieldsChange: (fields: OutputField[]) => void;
  disabled?: boolean;
}

const typeIcons: Record<FieldType, React.ReactNode> = {
  text: <Type size={12} />,
  number: <Hash size={12} />,
  boolean: <ToggleLeft size={12} />,
  date: <Calendar size={12} />,
};

// Per-type identification is conveyed by a small leading dot (color-coded)
// rather than tinting the whole chip — keeps the design palette restrained
// while still making types scannable at a glance.
const typeDotColor: Record<FieldType, string> = {
  text: 'bg-[var(--primary)]',
  number: 'bg-[var(--success)]',
  boolean: 'bg-[var(--info)]',
  date: 'bg-[var(--warning)]',
};

export default function OutputSchemaBuilder({
  fields,
  onFieldsChange,
  disabled,
}: OutputSchemaBuilderProps) {
  const [newField, setNewField] = useState<Partial<OutputField>>({
    name: '',
    type: 'text',
    description: '',
  });

  const addField = () => {
    if (!newField.name) {
      alert('Please enter a field name');
      return;
    }

    const field: OutputField = {
      id: `field-${Date.now()}`,
      name: newField.name,
      type: newField.type as FieldType,
      description: newField.description || '',
    };

    onFieldsChange([...fields, field]);
    setNewField({ name: '', type: 'text', description: '' });
  };

  const removeField = (id: string) => {
    onFieldsChange(fields.filter((f) => f.id !== id));
  };

  return (
    <div className="card-base">
      <div className="flex items-center gap-2 mb-3">
        <span className="step-badge">2</span>
        <FileOutput size={16} className="text-[var(--foreground-muted)]" strokeWidth={2} />
        <h3 className="text-base font-semibold text-[var(--foreground)] tracking-tight">Output Schema</h3>
        {fields.length > 0 && (
          <span className="ml-auto tabular-nums text-xs font-medium text-[var(--foreground-muted)]">
            {fields.length} {fields.length === 1 ? 'field' : 'fields'}
          </span>
        )}
      </div>

      {/* Existing Fields */}
      {fields.length > 0 && (
        <div className="mb-4 space-y-2">
          {fields.map((field) => (
            <div
              key={field.id}
              className="group flex items-center gap-3 p-3 bg-[var(--surface)] rounded-[var(--radius)] border border-[var(--border)] hover:border-[var(--border-strong)] hover:shadow-[var(--shadow-sm)] transition-all duration-150"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm text-[var(--foreground)] truncate">
                    {field.name}
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full bg-[var(--surface-muted)] text-[var(--foreground-muted)] border border-[var(--border)]">
                    <span className={`w-1.5 h-1.5 rounded-full ${typeDotColor[field.type]}`} aria-hidden="true" />
                    {typeIcons[field.type]}
                    {field.type}
                  </span>
                </div>
                {field.description && (
                  <p className="text-xs text-[var(--foreground-muted)] mt-1 truncate">{field.description}</p>
                )}
              </div>
              <button
                onClick={() => removeField(field.id)}
                disabled={disabled}
                className="p-1.5 text-[var(--foreground-subtle)] hover:text-[var(--danger)] hover:bg-[var(--danger-bg)] rounded-[var(--radius)] transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-50"
                title="Remove field"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add New Field */}
      <div className="space-y-3 p-4 bg-[var(--surface-muted)] rounded-[var(--radius-md)] border border-[var(--border)]">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--foreground-subtle)] mb-1.5">
              Field Name
            </label>
            <input
              type="text"
              value={newField.name}
              onChange={(e) => setNewField({ ...newField, name: e.target.value })}
              disabled={disabled}
              placeholder="e.g., sentiment"
              className="input-base text-sm py-2"
            />
          </div>
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--foreground-subtle)] mb-1.5">
              Field Type
            </label>
            <select
              value={newField.type}
              onChange={(e) =>
                setNewField({ ...newField, type: e.target.value as FieldType })
              }
              disabled={disabled}
              className="input-base text-sm py-2"
            >
              <option value="text">Text</option>
              <option value="number">Number</option>
              <option value="boolean">Boolean</option>
              <option value="date">Date</option>
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--foreground-muted)] mb-1.5">
            Description (optional)
          </label>
          <input
            type="text"
            value={newField.description}
            onChange={(e) =>
              setNewField({ ...newField, description: e.target.value })
            }
            disabled={disabled}
            placeholder="Describe what this field represents"
            className="input-base text-sm py-2"
          />
        </div>
        <button
          onClick={addField}
          disabled={disabled}
          className="btn-primary w-full flex items-center justify-center gap-2 text-sm"
        >
          <Plus size={16} />
          Add Field
        </button>
      </div>
    </div>
  );
}
