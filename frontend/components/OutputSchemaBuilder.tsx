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

const typeColors: Record<FieldType, string> = {
  text: 'from-indigo-100 to-indigo-50 text-indigo-700 border-indigo-200/50',
  number: 'from-emerald-100 to-emerald-50 text-emerald-700 border-emerald-200/50',
  boolean: 'from-purple-100 to-purple-50 text-purple-700 border-purple-200/50',
  date: 'from-amber-100 to-amber-50 text-amber-700 border-amber-200/50',
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
      <div className="flex items-center gap-2 mb-4">
        <div className="p-2 rounded-lg bg-gradient-to-br from-slate-100 to-slate-50">
          <FileOutput size={18} className="text-slate-600" />
        </div>
        <h3 className="font-semibold text-slate-800">Output Schema</h3>
        {fields.length > 0 && (
          <span className="ml-auto text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
            {fields.length} field{fields.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Existing Fields */}
      {fields.length > 0 && (
        <div className="mb-4 space-y-2">
          {fields.map((field) => (
            <div
              key={field.id}
              className="group flex items-center gap-3 p-3 bg-white rounded-lg border border-slate-200 hover:border-slate-300 hover:shadow-sm transition-all duration-150"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm text-slate-800 truncate">
                    {field.name}
                  </span>
                  <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-gradient-to-r border ${typeColors[field.type]}`}>
                    {typeIcons[field.type]}
                    {field.type}
                  </span>
                </div>
                {field.description && (
                  <p className="text-xs text-slate-500 mt-1 truncate">{field.description}</p>
                )}
              </div>
              <button
                onClick={() => removeField(field.id)}
                disabled={disabled}
                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-50"
                title="Remove field"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add New Field */}
      <div className="space-y-3 p-4 bg-slate-50 rounded-xl border border-slate-200/60">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">
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
            <label className="block text-xs font-medium text-slate-600 mb-1.5">
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
          <label className="block text-xs font-medium text-slate-600 mb-1.5">
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
