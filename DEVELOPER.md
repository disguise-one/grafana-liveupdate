# Disguise LiveUpdate Grafana Data Source Plugin - Developer Guide

This repository contains a Grafana data source plugin that connects to the [Disguise LiveUpdate WebSocket API](https://developer.disguise.one/api/session/liveupdate/), enabling real-time, dynamic data visualization in Grafana dashboards.

## Overview

This plugin allows Grafana to subscribe to live updates from a Disguise Designer project using the LiveUpdate WebSocket API. It supports complex, nested, and array-based data structures, and provides robust connection and reconnection logic. The plugin is frontend-only and does not require a backend proxy or REST API.

## Plugin Structure

- **src/datasource.ts**: Implements the main `DataSource` class, which manages queries, data frames, and the connection to the LiveUpdate backend. It dynamically creates fields in the data frame based on the structure of incoming data and manages query subscriptions, refresh intervals, and reconnection logic.
- **src/liveupdate.ts**: Contains the [`LiveUpdate` class](https://developer.disguise.one/api/session/liveupdate/) that encapsulates all WebSocket connection logic. It manages subscriptions, handles incoming messages, maintains the current connection status, and provides methods for subscribing/unsubscribing to object/property paths. The class implements the full LiveUpdate protocol, including subscribe, unsubscribe, set, and error handling.
- **src/components/QueryEditor.tsx**: Provides the UI for building queries in Grafana, allowing users to specify object paths and property paths to subscribe to.
- **src/components/QueryEditor.css**: Custom styles for the query editor UI.
- **src/components/ConfigEditor.tsx**: Implements the configuration UI for the plugin, allowing users to set the LiveUpdate server host and port in the Grafana data source settings.

## How It Works

- When a query is issued, the plugin subscribes to the specified object and property paths via the WebSocket connection.
- Incoming data is dynamically flattened and mapped to Grafana data frames, supporting nested objects and arrays.
- The plugin maintains a single `LiveUpdate` instance for the WebSocket connection, with robust logic for refreshing and reconnecting as needed.
- The plugin's health check (`testDatasource`) verifies the WebSocket connection status.

## Development Guide

### Prerequisites
- Node.js and npm
- Docker (for running a local Grafana instance)

### Common Tasks

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Build the plugin in development mode**
   ```bash
   npm run dev
   ```

3. **Build the plugin for production**
   ```bash
   npm run build
   ```

4. **Run unit tests**
   ```bash
   npm run test
   # or
   npm run test:ci
   ```

5. **Run a local Grafana instance with the plugin**
   ```bash
   npm run server
   # or specify a version
   GRAFANA_VERSION=11.3.0 npm run server
   ```

   Once running, Grafana will be available at `http://localhost:3030`.

   **Note:** The `server` command will resume existing containers. Use `npm run server:build` to rebuild the Docker image when needed (e.g., after Dockerfile changes).

6. **Run E2E tests (Playwright)**
   ```bash
   npm run server
   npm run e2e
   ```

7. **Lint the code**
   ```bash
   npm run lint
   # or
   npm run lint:fix
   ```

## LiveUpdate WebSocket Logic

The [`LiveUpdate` class](https://developer.disguise.one/api/session/liveupdate/) in `src/liveupdate.ts` manages the WebSocket connection to the Disguise backend. It:
- Automatically connects to the backend on instantiation.
- Handles subscription and unsubscription to object/property paths using the LiveUpdate protocol.
- Maintains a mapping of current values and subscription IDs.
- Handles reconnection and status changes.
- Notifies the datasource of value changes for real-time updates.
- Implements the full message protocol: `subscribe`, `unsubscribe`, `set`, and error handling.

### About the Disguise LiveUpdate API

The [LiveUpdate API](https://developer.disguise.one/api/session/liveupdate/) is a WebSocket-based protocol for subscribing to and updating properties of objects in a Disguise Designer project. Key features:

- **Realtime Subscriptions:** Subscribe to updates on specific resources using Designer expression syntax for objects and Python expressions for properties.
- **Dynamic Data Changes:** Issue commands to modify resource properties (where supported).
- **Partial Updates:** Supports partial modifications and merging of new fields with existing data.
- **Efficient Subscription Model:** Each (object, property) pair is assigned a unique integer ID for efficient updates.

**Example usage:**
```js
// Open a live update websocket connection
const socket = new WebSocket('ws://director:80/api/session/liveupdate');

// Subscribe to a Track resource
socket.onopen = () => {
     const subscribeMessage = { subscribe: {
         object: "track:track_1",
         properties: ["object.lengthInBeats", "object.layers"]
     } };
     socket.send(JSON.stringify(subscribeMessage));
};

// Listen for incoming updates
socket.onmessage = (event) => {
     const data = JSON.parse(event.data);
     console.log('Update received:', data);
};
```

See the [LiveUpdate API documentation](https://developer.disguise.one/api/session/liveupdate/) for full protocol details, message formats, and advanced usage. The API is a core part of Disguise Designer and is used for real-time integration with project data.

## Contributing

- Please open issues or pull requests for bug fixes, improvements, or new features.
- See the code in `src/datasource.ts` and `src/liveupdate.ts` for the main logic.
- For questions about the WebSocket protocol or backend, see the [LiveUpdate API documentation](https://developer.disguise.one/api/session/liveupdate/) or contact the maintainers.

## References
- [Disguise LiveUpdate API Documentation](https://developer.disguise.one/api/session/liveupdate/)
- [Grafana Plugin Development Documentation](https://grafana.com/developers/plugin-tools/)
- [Basic data source plugin example](https://github.com/grafana/grafana-plugin-examples/tree/master/examples/datasource-basic#readme)
- [`plugin.json` documentation](https://grafana.com/developers/plugin-tools/reference/plugin-json) 