import { getBackendSrv } from '@grafana/runtime';
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
import { lastValueFrom, Observable } from 'rxjs';

export class DataSource extends DataSourceApi<LiveUpdateQuery, LiveUpdateDataSourceOptions> {
  private liveUpdate: LiveUpdate;
  private querySubscribers: Map<string, Array<{ query: LiveUpdateQuery; frame: CircularDataFrame; subscriber: any }>> = new Map();
  baseUrl: string;

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
  }

  private handleLiveUpdate(changes: Record<string, any>) {
    // For each active query, update its frame and notify its subscriber
    for (const subs of this.querySubscribers.values()) {
      for (const { query, frame, subscriber } of subs) {
        const row: Record<string, any> = { time: Date.now() };
        let hasChange = false;
        for (const property of query.propertyPaths) {
          const k = `${query.objectPath}/${property}`;
          if (k in changes) {
            hasChange = true;
          }
          row[property] = this.liveUpdate.getValue(k);
        }
        if (hasChange) {
          frame.add(row);
          subscriber.next({ data: [frame], key: query.refId, state: LoadingState.Streaming });
        }
      }
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
        // Subscribe to the requested object and properties
        this.liveUpdate.subscribe(query.objectPath, query.propertyPaths);
        const frame = new CircularDataFrame({ append: 'tail', capacity: 1000 });
        frame.refId = query.refId;
        frame.addField({ name: 'time', type: FieldType.time });
        query.propertyPaths.forEach((property) => {
          frame.addField({ name: property, type: FieldType.number });
        });
        // Register this query's subscriber
        const key = `${query.objectPath}|${query.propertyPaths.join(',')}`;
        if (!this.querySubscribers.has(key)) {
          this.querySubscribers.set(key, []);
        }
        this.querySubscribers.get(key)!.push({ query, frame, subscriber });
        // Cleanup on unsubscribe
        return () => {
          const keys = query.propertyPaths.map((p) => `${query.objectPath}/${p}`);
          this.liveUpdate.unsubscribe(keys);
          // Remove this subscriber
          const arr = this.querySubscribers.get(key);
          if (arr) {
            this.querySubscribers.set(key, arr.filter((item) => item.subscriber !== subscriber));
            if (this.querySubscribers.get(key)!.length === 0) {
              this.querySubscribers.delete(key);
            }
          }
        };
      });
    });
    return observables.length === 1 ? observables[0] : (Observable as any).merge(...observables);
  }

  async request(url: string, params?: string) {
    const response = getBackendSrv().fetch({
      url: `${this.baseUrl}${url}${params?.length ? `?${params}` : ''}`,
    });
    return lastValueFrom(response);
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
}
