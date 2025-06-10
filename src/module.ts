import { DataSourcePlugin } from '@grafana/data';
import { DataSource } from './datasource';
import { ConfigEditor } from './components/ConfigEditor';
import { QueryEditor } from './components/QueryEditor';
import { LiveUpdateQuery, LiveUpdateDataSourceOptions } from './types';

export const plugin = new DataSourcePlugin<DataSource, LiveUpdateQuery, LiveUpdateDataSourceOptions>(DataSource)
  .setConfigEditor(ConfigEditor)
  .setQueryEditor(QueryEditor);
