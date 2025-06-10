import React, { ChangeEvent } from 'react';
import { InlineField, Input, Stack } from '@grafana/ui';
import { QueryEditorProps } from '@grafana/data';
import { DataSource } from '../datasource';
import { LiveUpdateDataSourceOptions, LiveUpdateQuery } from '../types';

type Props = QueryEditorProps<DataSource, LiveUpdateQuery, LiveUpdateDataSourceOptions>;

export function QueryEditor({ query, onChange, onRunQuery }: Props) {
  const onObjectPathChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...query, objectPath: event.target.value });
  };

  const onPropertyPathsChange = (event: ChangeEvent<HTMLInputElement>) => {
    // Comma-separated list to array
    onChange({ ...query, propertyPaths: event.target.value.split(',').map(s => s.trim()) });
  };

  const { objectPath, propertyPaths } = query;

  return (
    <Stack gap={0}>
      <InlineField label="Object Path" tooltip="The object path to subscribe to">
        <Input
          id="query-editor-object-path"
          onChange={onObjectPathChange}
          value={objectPath || ''}
          required
          placeholder="e.g. device.123"
        />
      </InlineField>
      <InlineField label="Property Paths" tooltip="Comma-separated list of property paths">
        <Input
          id="query-editor-property-paths"
          onChange={onPropertyPathsChange}
          value={propertyPaths ? propertyPaths.join(', ') : ''}
          required
          placeholder="e.g. temperature, humidity"
        />
      </InlineField>
    </Stack>
  );
}
