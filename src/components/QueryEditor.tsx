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

  const onPropertyPathChange = (index: number, value: string) => {
    const newPaths = [...(query.propertyPaths || [])];
    newPaths[index] = value;
    onChange({ ...query, propertyPaths: newPaths });
  };

  const addPropertyPath = () => {
    onChange({ ...query, propertyPaths: [...(query.propertyPaths || []), ''] });
  };

  const removePropertyPath = (index: number) => {
    const newPaths = [...(query.propertyPaths || [])];
    newPaths.splice(index, 1);
    onChange({ ...query, propertyPaths: newPaths });
  };

  const { objectPath, propertyPaths } = query;

  return (
    <Stack gap={2} direction="column">
      <InlineField label="Object Path" tooltip="The object path to subscribe to" grow>
        <Input
          id="query-editor-object-path"
          onChange={onObjectPathChange}
          value={objectPath || ''}
          required
          placeholder="e.g. device.123"
          className="liveupdate-fullwidth-input"
        />
      </InlineField>
      <InlineField label="Property Paths" tooltip="Add each property path separately" grow>
        <Stack direction="column" gap={1}>
          {(propertyPaths || []).map((path, idx) => (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', marginBottom: 4, width: '100%' }}>
              <Input
                id={`query-editor-property-path-${idx}`}
                value={path}
                onChange={e => onPropertyPathChange(idx, (e.target as HTMLInputElement).value)}
                placeholder="e.g. temperature"
                className="liveupdate-fullwidth-input"
              />
              <button
                type="button"
                style={{ marginLeft: 8 }}
                onClick={() => removePropertyPath(idx)}
                aria-label="Remove property"
              >
                −
              </button>
            </div>
          ))}
          <button type="button" onClick={addPropertyPath} style={{ marginTop: 4 }}>
            + Add Property
          </button>
        </Stack>
      </InlineField>
    </Stack>
  );
}
