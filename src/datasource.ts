import { getBackendSrv, isFetchError } from '@grafana/runtime';
import {
  CoreApp,
  DataQueryRequest,
  DataQueryResponse,
  DataSourceApi,
  DataSourceInstanceSettings,
} from '@grafana/data';

import { LiveUpdateQuery, LiveUpdateDataSourceOptions } from './types';
import { lastValueFrom } from 'rxjs';

export class DataSource extends DataSourceApi<LiveUpdateQuery, LiveUpdateDataSourceOptions> {
  baseUrl: string;

  constructor(instanceSettings: DataSourceInstanceSettings<LiveUpdateDataSourceOptions>) {
    super(instanceSettings);
    this.baseUrl = instanceSettings.url!;
  }

  getDefaultQuery(_: CoreApp): Partial<LiveUpdateQuery> {
    return { refId: '', objectPath: '', propertyPaths: [] };
  }

  filterQuery(query: LiveUpdateQuery): boolean {
    return !!query.objectPath && Array.isArray(query.propertyPaths) && query.propertyPaths.length > 0;
  }

  async query(options: DataQueryRequest<LiveUpdateQuery>): Promise<DataQueryResponse> {
    // ...existing code...
    // You will want to implement live update logic here in the future
    return { data: [] };
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
    const defaultErrorMessage = 'Cannot connect to API';

    try {
      const response = await this.request('/health');
      if (response.status === 200) {
        return {
          status: 'success',
          message: 'Success',
        };
      } else {
        return {
          status: 'error',
          message: response.statusText ? response.statusText : defaultErrorMessage,
        };
      }
    } catch (err) {
      let message = '';
      if (typeof err === 'string') {
        message = err;
      } else if (isFetchError(err)) {
        message = 'Fetch error: ' + (err.statusText ? err.statusText : defaultErrorMessage);
        if (err.data && err.data.error && err.data.error.code) {
          message += ': ' + err.data.error.code + '. ' + err.data.error.message;
        }
      }
      return {
        status: 'error',
        message,
      };
    }
  }
}
