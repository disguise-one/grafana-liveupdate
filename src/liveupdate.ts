// useLiveUpdate.ts
// Adapted from https://github.com/disguise-one/vue-liveupdate/blob/main/src/composables/useLiveUpdate.js for Grafana datasource TypeScript usage

// NOTE: This version removes Vue/reactivity and is suitable for use in a Grafana datasource plugin.
// It provides a class-based API for managing WebSocket live updates.

export type LiveUpdateSubscription = {
  objectPath: string;
  propertyPath: string;
  id: number;
};

export type LiveUpdateOptions = {
  director: string; // host:port or full ws url
  onStatusChange?: (status: string) => void;
  onValuesChanged?: (changes: Record<string, any>) => void;
  onError?: (err: Error | string) => void;
};

export class LiveUpdate {
  private ws?: WebSocket;
  private status: string = 'CLOSED';
  private subscriptions: LiveUpdateSubscription[] = [];
  private keyToValue: Record<string, any> = {};
  private keyToId: Record<string, number> = {};
  private idToKey: Record<number, string> = {};
  private options: LiveUpdateOptions;

  constructor(options: LiveUpdateOptions) {
    this.options = options;
    this.connect();
  }

  private connect() {
    const url = this.options.director.startsWith('ws')
      ? this.options.director
      : `ws://${this.options.director}/api/session/liveupdate`;
    this.ws = new WebSocket(url);
    this.ws.onopen = () => {
      this.status = 'OPEN';
      this.options.onStatusChange?.(this.status);
      this.resubscribeAll();
    };
    this.ws.onclose = (ev) => {
      this.status = 'CLOSED';
      this.options.onStatusChange?.(this.status);
      // Optionally handle reconnect logic here
    };
    this.ws.onerror = (ev) => {
      this.options.onError?.('WebSocket error');
    };
    this.ws.onmessage = (ev) => this.handleMessage(ev.data);
  }

  private send(msg: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(typeof msg === 'string' ? msg : JSON.stringify(msg));
    }
  }

  private handleMessage(data: string) {
    let parsed: any;
    try {
      parsed = JSON.parse(data);
    } catch (err) {
      this.options.onError?.('Error parsing Live Update message: ' + data);
      return;
    }
    if (parsed.error) {
      this.options.onError?.(parsed.error);
      return;
    }
    if (parsed.subscriptions) {
      this.subscriptions = parsed.subscriptions;
      this.keyToId = {};
      this.idToKey = {};
      for (const sub of this.subscriptions) {
        const key = `${sub.objectPath}/${sub.propertyPath}`;
        this.keyToId[key] = sub.id;
        this.idToKey[sub.id] = key;
      }
      // Remove unsubscribed keys
      Object.keys(this.keyToValue).forEach((key) => {
        if (!this.keyToId[key]) delete this.keyToValue[key];
      });
    }
    if (parsed.valuesChanged) {
      const changes: Record<string, any> = {};
      for (const change of parsed.valuesChanged) {
        const key = this.idToKey[change.id];
        this.keyToValue[key] = change.value;
        changes[key] = change.value;
      }
      this.options.onValuesChanged?.(changes);
    }
  }

  public subscribe(objectPath: string, propertyPaths: string[]) {
    this.send({ subscribe: { object: objectPath, properties: propertyPaths } });
  }

  public unsubscribe(keys: string[]) {
    const ids = keys.map((key) => this.keyToId[key]).filter((id) => id !== undefined);
    if (ids.length > 0) {
      this.send({ unsubscribe: { ids } });
    }
  }

  public setValues(newValues: { id: number; value: any }[]) {
    if (newValues.length > 0) {
      this.send({ set: newValues });
    }
  }

  public getValue(key: string) {
    return this.keyToValue[key];
  }

  public getStatus() {
    return this.status;
  }

  public reconnect() {
    if (this.ws) {
      this.ws.close();
    }
    this.connect();
  }

  private resubscribeAll() {
    // Group by objectPath
    const objectPathToProperties: Record<string, string[]> = {};
    for (const sub of this.subscriptions) {
      if (!objectPathToProperties[sub.objectPath]) {
        objectPathToProperties[sub.objectPath] = [];
      }
      objectPathToProperties[sub.objectPath].push(sub.propertyPath);
    }
    for (const [objectPath, propertyPaths] of Object.entries(objectPathToProperties)) {
      this.subscribe(objectPath, propertyPaths);
    }
  }
}
