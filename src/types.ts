import { DataQuery, DataSourceJsonData } from '@grafana/schema';

export interface LiveUpdateDataSourceOptions extends DataSourceJsonData {
  /** Hostname or IP address of the live update server */
  host: string;
  /** Port of the live update server */
  port: number;
}

export interface LiveUpdateProperty {
  /** The property path to subscribe to */
  path: string;
  /** The name to use for this property (series name) */
  name: string;
}

export interface LiveUpdateQuery extends DataQuery {
  /** The object path to subscribe to */
  objectPath: string;
  /** List of property path/name pairs to subscribe to */
  properties: LiveUpdateProperty[];
}
