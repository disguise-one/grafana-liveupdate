# Disguise LiveUpdate Data Source for Grafana

## Overview

The Disguise LiveUpdate Data Source plugin enables Grafana to visualize real-time data from Disguise Designer projects using the [Disguise LiveUpdate WebSocket API](https://developer.disguise.one/api/session/liveupdate/). This plugin is ideal for monitoring and interacting with live project data, including complex, nested, and array-based structures, directly from your Grafana dashboards.

## Features
- **Live Data:** Subscribe to and visualize real-time updates from Disguise Designer.
- **Flexible Queries:** Use Designer object expressions and Python property paths to select exactly the data you need.
- **Dynamic Data Handling:** Supports nested objects, arrays, and partial updates.
- **No Backend Required:** All communication is handled in the browser via WebSocket.

## Requirements
- Grafana 9.0+
- Access to a running Disguise Designer instance

## Getting Started

### 1. Install the Plugin
- Install via the Grafana Marketplace or manually from the releases page.

### 2. Configure the Data Source
- In Grafana, go to **Connections > Data sources > Add data source**.
- Search for "Disguise LiveUpdate" and select the plugin.
- Enter the **Host** and **Port** for your Disguise Designer Director (e.g., `director:80`).
- Click **Save & Test** to verify the connection.

### 3. Build Queries
- In your dashboard panel, select the Disguise LiveUpdate data source.
- **Object Path:** Enter a Designer object expression (e.g., `track:track_1`, `screen2:screen_1`).
- **Property Paths:** Add one or more Python property expressions (e.g., `object.lengthInBeats`, `object.layers`, `object.description`). Each property path will be a separate field in your data frame.
- Click **Run Query** to see live data.

#### Object Paths

Object paths are written as Designer expressions. [Accessing resources](https://help.disguise.one/designer/configuration/expressions/accessing-resources) is a useful reference for how to access Resources within Designer to find relevant objects to query.

#### Property Paths

Property paths are written as Python expressions, and use a variable `object` to represent the object found from the object path. Properties can be referenced from the object using Python syntax. The [Python reference](https://developer.disguise.one/plugins/docs/) documentation will help find useful properties to monitor.

#### Example Query
- **Object Path:** `track:track_1`
- **Property Paths:**
  - `object.lengthInBeats`
  - `object.layers[0].brightness`

This will subscribe to the length in beats and the brightness of the first layer in the track.

## How It Works
- The plugin opens a WebSocket connection to your Disguise Designer Director using the [LiveUpdate API](https://developer.disguise.one/api/session/liveupdate/).
- When you run a query, the plugin subscribes to the specified object and property paths.
- Updates are pushed in real time and displayed in your Grafana panel.
- You can add or remove property paths at any time; the plugin will manage subscriptions automatically.

## Documentation & Support
- [Disguise LiveUpdate API Documentation](https://developer.disguise.one/api/session/liveupdate/)
- [Grafana Plugin Documentation](https://grafana.com/developers/plugin-tools/)
- For help with Disguise Designer, see [help.disguise.one](https://help.disguise.one/) or contact [support@disguise.one](mailto:support@disguise.one).

## Screenshots
![Query Editor Example](https://raw.githubusercontent.com/YOUR-ORG/YOUR-REPO/main/img/query-editor-example.png)
