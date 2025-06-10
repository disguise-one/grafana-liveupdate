import {
  CoreApp,
  CircularDataFrame,
  DataQueryRequest,
  DataQueryResponse,
  DataSourceApi,
  DataSourceInstanceSettings,
  FieldType,
  LoadingState,
} from '@grafana/data';

import { LiveUpdateQuery, LiveUpdateDataSourceOptions } from './types';
import { LiveUpdate } from './liveupdate';
import { Observable } from 'rxjs';

export class DataSource extends DataSourceApi<LiveUpdateQuery, LiveUpdateDataSourceOptions> {
  private liveUpdate: LiveUpdate;
  private querySubscribers: Map<string, Array<{ query: LiveUpdateQuery; frame: CircularDataFrame; subscriber: any }>> = new Map();
  baseUrl: string;
  private refreshInterval: NodeJS.Timeout;
  private reconnectInterval?: NodeJS.Timeout;

  constructor(instanceSettings: DataSourceInstanceSettings<LiveUpdateDataSourceOptions>) {
    super(instanceSettings);
    this.baseUrl = instanceSettings.url!;
    const host = instanceSettings.jsonData.host;
    const port = instanceSettings.jsonData.port;
    this.liveUpdate = new LiveUpdate({
      director: `${host}:${port}`,
      onError: (err) => console.error('LiveUpdate error:', err),
      onValuesChanged: this.handleLiveUpdate.bind(this),
    });
    this.refreshInterval = setInterval(this.handleRefreshInterval.bind(this), 200);
  }

  // Helper to handle the refresh interval logic
  private handleRefreshInterval() {
    const isOpen = this.liveUpdate.getStatus() === 'OPEN';
    const now = Date.now();
    for (const subs of this.querySubscribers.values()) {
      for (const { query, frame, subscriber } of subs) {
        if (!isOpen) {
          this.insertEmptyRow(frame, query, now, subscriber);
          continue;
        }
        if (frame.length > 0) {
          const lastTime = frame.fields.find(f => f.name === 'time')?.values[frame.length - 1] as number;
          if (now - lastTime > 200) {
            this.duplicateLastRow(frame, now, query, subscriber);
          }
        }
      }
    }
    this.handleReconnectInterval(isOpen);
  }

  // Helper to insert an empty row
  private insertEmptyRow(frame: CircularDataFrame, query: LiveUpdateQuery, now: number, subscriber: any) {
    const row: Record<string, any> = { time: now };
    for (const property of query.propertyPaths) {
      row[property] = null;
    }
    frame.add(row);
    subscriber.next({ data: [frame], key: query.refId, state: LoadingState.Streaming });
  }

  // Helper to duplicate the last row
  private duplicateLastRow(frame: CircularDataFrame, now: number, query: LiveUpdateQuery, subscriber: any) {
    const lastRow: Record<string, any> = {};
    frame.fields.forEach((field) => {
      lastRow[field.name] = field.values[frame.length - 1];
    });
    const row: Record<string, any> = { ...lastRow, time: now };
    frame.add(row);
    subscriber.next({ data: [frame], key: query.refId, state: LoadingState.Streaming });
  }

  // Helper to handle the reconnect interval logic
  private handleReconnectInterval(isOpen: boolean) {
    if (!isOpen && [...this.querySubscribers.values()].flat().length > 0) {
      if (!this.reconnectInterval) {
        this.reconnectInterval = setInterval(() => {
          if (this.liveUpdate.getStatus() !== 'OPEN') {
            this.liveUpdate.reconnect();
          } else if (this.reconnectInterval) {
            clearInterval(this.reconnectInterval);
            this.reconnectInterval = undefined;
          }
        }, 2000);
      }
    } else if (isOpen && this.reconnectInterval) {
      clearInterval(this.reconnectInterval);
      this.reconnectInterval = undefined;
    }
  }

  // Helper to add fields to the frame based on the first received value, including arrays
  private addFieldsFromValue(frame: CircularDataFrame, value: any, prefix = '') {
    if (value === null || value === undefined) {
      return;
    }
    if (Array.isArray(value)) {
      // For arrays, add a field for the array length and for each index up to the first value's length
      if (!frame.fields.some(f => f.name === `${prefix}.length`)) {
        frame.addField({ name: `${prefix}.length`, type: FieldType.number });
      }
      // Optionally, flatten the first element for structure
      if (value.length > 0) {
        this.addFieldsFromValue(frame, value[0], `${prefix}[0]`);
      }
    } else if (typeof value === 'object') {
      for (const [key, val] of Object.entries(value)) {
        this.addFieldsFromValue(frame, val, prefix ? `${prefix}.${key}` : key);
      }
    } else {
      // Add a field for this value if it doesn't exist
      const fieldName = prefix;
      if (!frame.fields.some(f => f.name === fieldName)) {
        let type: any = FieldType.string;
        if (typeof value === 'number') { type = FieldType.number; }
        else if (typeof value === 'boolean') { type = FieldType.boolean; }
        frame.addField({ name: fieldName, type });
      }
    }
  }

  private handleLiveUpdate(changes: Record<string, any>) {
    const now = Date.now();
    for (const subs of this.querySubscribers.values()) {
      for (const { query, frame, subscriber } of subs) {
        const row: Record<string, any> = { time: now };
        let hasChange = false;
        for (const property of query.propertyPaths) {
          const k = `${query.objectPath}/${property}`;
          if (k in changes) {
            hasChange = true;
            // Dynamically add fields based on the value structure
            this.addFieldsFromValue(frame, changes[k], property);
          }
          // Recursively flatten the value for the row
          this.flattenValueForRow(row, changes[k], property);
        }
        if (hasChange) {
          frame.add(row);
          subscriber.next({ data: [frame], key: query.refId, state: LoadingState.Streaming });
        }
      }
    }
  }

  // Helper to flatten a value into the row object for the frame, including arrays
  private flattenValueForRow(row: Record<string, any>, value: any, prefix: string) {
    if (value === null || value === undefined) {
      row[prefix] = value;
    } else if (Array.isArray(value)) {
      row[`${prefix}.length`] = value.length;
      if (value.length > 0) {
        this.flattenValueForRow(row, value[0], `${prefix}[0]`);
      }
    } else if (typeof value === 'object') {
      for (const [key, val] of Object.entries(value)) {
        this.flattenValueForRow(row, val, `${prefix}.${key}`);
      }
    } else {
      row[prefix] = value;
    }
  }

  getDefaultQuery(_: CoreApp): Partial<LiveUpdateQuery> {
    return { refId: '', objectPath: '', propertyPaths: [] };
  }

  filterQuery(query: LiveUpdateQuery): boolean {
    return !!query.objectPath && Array.isArray(query.propertyPaths) && query.propertyPaths.length > 0;
  }

  query(options: DataQueryRequest<LiveUpdateQuery>): Observable<DataQueryResponse> {
    const observables = options.targets.map((target) => {
      const query = target;
      return new Observable<DataQueryResponse>((subscriber) => {
        this.liveUpdate.subscribe(query.objectPath, query.propertyPaths);
        const frame = new CircularDataFrame({ append: 'tail', capacity: 1000 });
        frame.refId = query.refId;
        frame.addField({ name: 'time', type: FieldType.time });
        // Do not pre-add property fields; add them dynamically on first value
        const key = `${query.objectPath}|${query.propertyPaths.join(',')}`;
        if (!this.querySubscribers.has(key)) {
          this.querySubscribers.set(key, []);
        }
        this.querySubscribers.get(key)!.push({ query, frame, subscriber });
        return () => {
          const keys = query.propertyPaths.map((p) => `${query.objectPath}/${p}`);
          this.liveUpdate.unsubscribe(keys);
          const arr = this.querySubscribers.get(key);
          if (arr) {
            this.querySubscribers.set(key, arr.filter((item) => item.subscriber !== subscriber));
            if (arr.filter((item) => item.subscriber !== subscriber).length === 0) {
              this.querySubscribers.delete(key);
            }
          }
        };
      });
    });
    return observables.length === 1 ? observables[0] : (Observable as any).merge(...observables);
  }

  /**
   * Checks whether we can connect to the API.
   */
  async testDatasource() {
    // Wait for the LiveUpdate WebSocket to connect, up to a timeout
    const timeoutMs = 3000;
    const pollInterval = 100;
    let waited = 0;
    while (this.liveUpdate.getStatus() !== 'OPEN' && waited < timeoutMs) {
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
      waited += pollInterval;
    }
    if (this.liveUpdate.getStatus() === 'OPEN') {
      return {
        status: 'success',
        message: 'LiveUpdate WebSocket connection is open.',
      };
    } else {
      return {
        status: 'error',
        message: 'LiveUpdate WebSocket connection is not open after waiting.',
      };
    }
  }

  destroy() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
    if (this.reconnectInterval) {
      clearInterval(this.reconnectInterval);
    }
  }
}
