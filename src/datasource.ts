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
  private connectionPromise: Promise<void> | null = null;

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

  private ensureConnected(): Promise<void> {
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = new Promise(async (resolve) => {
      const timeoutMs = 5000;
      const pollInterval = 100;
      let waited = 0;
      while (this.liveUpdate.getStatus() !== 'OPEN' && waited < timeoutMs) {
        await new Promise(r => setTimeout(r, pollInterval));
        waited += pollInterval;
      }
      resolve();
    });

    return this.connectionPromise;
  }

  // Helper to handle the refresh interval logic
  private handleRefreshInterval() {
    const isOpen = this.liveUpdate.getStatus() === 'OPEN';
    const now = Date.now();
    for (const subs of this.querySubscribers.values()) {
      for (const { query, frame, subscriber } of subs) {
        if (frame.length > 0) {
          const lastTime = frame.fields.find(f => f.name === 'time')?.values[frame.length - 1] as number;
          if (now - lastTime > 200) {
            this.addRowOrUpdateTimestamp(frame, now, query, subscriber, isOpen);
          }
        }
      }
    }
    this.handleReconnectInterval(isOpen);
  }

  // Helper to add a row: duplicate last row or insert nulls, or just update timestamp if last two rows are identical (excluding 'time')
  private addRowOrUpdateTimestamp(frame: CircularDataFrame, now: number, query: LiveUpdateQuery, subscriber: any, isOpen: boolean) {
    if (frame.length > 1) {
      let allMatch = true;
      for (const field of frame.fields) {
        if (field.name === 'time') { continue; }
        const lastVal = field.values[frame.length - 1];
        const prevVal = field.values[frame.length - 2];
        if (lastVal !== prevVal || (!isOpen && lastVal !== null)) {
          allMatch = false;
          break;
        }
      }
      if (allMatch) {
        // Only update the timestamp of the most recent value
        const timeField = frame.fields.find(f => f.name === 'time');
        if (timeField) {
          timeField.values[frame.length - 1] = now;
          subscriber.next({ data: [frame], key: query.refId, state: LoadingState.Streaming });
        }
        return;
      }
    }

    if (frame.length > 0) {
      // Duplicate the last row
      const lastRow: Record<string, any> = {};
      frame.fields.forEach((field) => {
        lastRow[field.name] = isOpen ? field.values[frame.length - 1] : null;
      });
      const row: Record<string, any> = { ...lastRow, time: now };
      frame.add(row);
    }
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
      // For arrays, flatten all elements
      for (let i = 0; i < value.length; i++) {
        this.addFieldsFromValue(frame, value[i], `${prefix}[${i}]`);
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
        for (const property of query.properties) {
          const k = `${query.objectPath}/${property.path}`;
          if (k in changes) {
            hasChange = true;
            this.addFieldsFromValue(frame, changes[k], property.name || property.path);
          }
          this.flattenValueForRow(row, changes[k], property.name || property.path);
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
      // Flatten all elements of the array
      for (let i = 0; i < value.length; i++) {
        this.flattenValueForRow(row, value[i], `${prefix}[${i}]`);
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
    return { refId: '', objectPath: '', properties: [] };
  }

  filterQuery(query: LiveUpdateQuery): boolean {
    return !!query.objectPath && Array.isArray(query.properties) && query.properties.length > 0;
  }

  query(options: DataQueryRequest<LiveUpdateQuery>): Observable<DataQueryResponse> {
    const observables = options.targets.map((target) => {
      const query = target;
      return new Observable<DataQueryResponse>((subscriber) => {
        const key = `${query.objectPath}|${query.properties.map(p => p.path).join(',')}`;
        (async () => {
          await this.ensureConnected();
          this.liveUpdate.subscribe(query.objectPath, query.properties.map(p => p.path));
          const frame = new CircularDataFrame({ append: 'tail', capacity: 99999 });
          frame.refId = query.refId;
          frame.addField({ name: 'time', type: FieldType.time });
          // Do not pre-add property fields; add them dynamically on first value
          if (!this.querySubscribers.has(key)) {
            this.querySubscribers.set(key, []);
          }
          this.querySubscribers.get(key)!.push({ query, frame, subscriber });
        })();

        return () => {
          const keys = query.properties.map((p) => `${query.objectPath}/${p.path}`);
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
