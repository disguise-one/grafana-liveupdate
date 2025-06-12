import React, { ChangeEvent } from 'react';
import { InlineField, Input, Stack } from '@grafana/ui';
import { QueryEditorProps } from '@grafana/data';
import { DataSource } from '../datasource';
import { LiveUpdateDataSourceOptions, LiveUpdateQuery } from '../types';
import './QueryEditor.css';

type Props = QueryEditorProps<DataSource, LiveUpdateQuery, LiveUpdateDataSourceOptions>;

export function QueryEditor({ query, onChange, onRunQuery }: Props) {
  const onObjectPathChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...query, objectPath: event.target.value });
  };

  const onPropertyChange = (index: number, field: 'path' | 'name', value: string) => {
    const newProperties = [...(query.properties || [])];
    newProperties[index] = { ...newProperties[index], [field]: value };
    onChange({ ...query, properties: newProperties });
  };

  const addProperty = () => {
    onChange({ ...query, properties: [...(query.properties || []), { path: '', name: '' }] });
  };

  const removeProperty = (index: number) => {
    const newProperties = [...(query.properties || [])];
    newProperties.splice(index, 1);
    onChange({ ...query, properties: newProperties });
  };

  const { objectPath, properties } = query;

  return (
    <Stack gap={2} direction="column">
      <InlineField label="Object Path" tooltip="The object path to subscribe to" grow>
        <Input
          id="query-editor-object-path"
          onChange={onObjectPathChange}
          value={objectPath || ''}
          required
          placeholder='e.g. screen2:"surface 1"'
          className="liveupdate-fullwidth-input"
        />
      </InlineField>
      <InlineField label="Property Paths" tooltip="Add each property name and path separately" grow>
        <Stack direction="column" gap={1}>
          {(properties || []).map((prop, idx) => (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', marginBottom: 4, width: '100%' }}>
              <Input
                id={`query-editor-property-name-${idx}`}
                value={prop.name}
                onChange={e => onPropertyChange(idx, 'name', (e.target as HTMLInputElement).value)}
                placeholder="Series name (optional)"
                className="liveupdate-property-name-input"
              />
              <Input
                id={`query-editor-property-path-${idx}`}
                value={prop.path}
                onChange={e => onPropertyChange(idx, 'path', (e.target as HTMLInputElement).value)}
                placeholder="e.g. object.offset"
                className="liveupdate-fullwidth-input"
                style={{ flex: 1, marginRight: 8 }}
              />
              <button
                type="button"
                style={{ marginLeft: 8 }}
                onClick={() => removeProperty(idx)}
                aria-label="Remove property"
              >
                −
              </button>
            </div>
          ))}
          <button type="button" onClick={addProperty} style={{ marginTop: 4 }}>
            + Add Property
          </button>
        </Stack>
      </InlineField>
    </Stack>
  );
}
