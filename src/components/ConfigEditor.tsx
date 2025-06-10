import React, { ChangeEvent } from 'react';
import { InlineField, Input } from '@grafana/ui';
import { DataSourcePluginOptionsEditorProps } from '@grafana/data';
import { LiveUpdateDataSourceOptions } from '../types';

interface Props extends DataSourcePluginOptionsEditorProps<LiveUpdateDataSourceOptions> {}

export function ConfigEditor(props: Props) {
  const { onOptionsChange, options } = props;
  const { jsonData } = options;

  const onHostChange = (event: ChangeEvent<HTMLInputElement>) => {
    onOptionsChange({
      ...options,
      jsonData: {
        ...jsonData,
        host: event.target.value,
      },
    });
  };

  const onPortChange = (event: ChangeEvent<HTMLInputElement>) => {
    onOptionsChange({
      ...options,
      jsonData: {
        ...jsonData,
        port: Number(event.target.value),
      },
    });
  };

  return (
    <>
      <InlineField label="Host" labelWidth={14} interactive tooltip={'Live update server host or IP'}>
        <Input
          id="config-editor-host"
          onChange={onHostChange}
          value={jsonData.host || ''}
          placeholder="Enter host, e.g. localhost"
          width={40}
        />
      </InlineField>
      <InlineField label="Port" labelWidth={14} interactive tooltip={'Live update server port'}>
        <Input
          id="config-editor-port"
          onChange={onPortChange}
          value={jsonData.port || ''}
          placeholder="Enter port, e.g. 8080"
          width={20}
          type="number"
        />
      </InlineField>
    </>
  );
}
