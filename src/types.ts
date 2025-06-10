import { DataQuery, DataSourceJsonData } from '@grafana/schema';

export interface LiveUpdateDataSourceOptions extends DataSourceJsonData {
  /** Hostname or IP address of the live update server */
  host: string;
  /** Port of the live update server */
  port: number;
}

export interface LiveUpdateQuery extends DataQuery {
  /** The object path to subscribe to */
  objectPath: string;
  /** List of property paths to subscribe to */
  propertyPaths: string[];
}
