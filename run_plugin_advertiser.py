from designer_plugin import DesignerPlugin
from time import sleep
import json
import socket

def get_hostname():
    """
    Finds the hostname of the machine.
    """
    try:
        return socket.gethostname()
    except Exception:
        return 'localhost'

# The port for the Grafana service which we are advertising
grafana_port = 3030

# Read the base config from the JSON file
with open('d3plugin.json', 'r') as f:
    plugin_data = json.load(f)

# Dynamically construct the absolute URLs
host = get_hostname()
plugin_data['url'] = f"http://{host}:{grafana_port}/?kiosk"
if 'icon' in plugin_data and plugin_data['icon'].startswith('/'):
    plugin_data['icon'] = f"http://{host}:{grafana_port}{plugin_data['icon']}"

# Write the modified config back to the file for the library to read
with open('d3plugin.json', 'w') as f:
    json.dump(plugin_data, f)


# Use the library's default initialization, which reads all settings from the modified d3plugin.json.
# We no longer need to override the hostname here as the library will use the one from the full URL.
with DesignerPlugin.default_init(port=grafana_port) as plugin:
    print(f"Plugin '{plugin.name}' is published with URL '{plugin_data['url']}' and icon '{plugin_data['icon']}'. Press Ctrl+C to stop.")
    try:
        while True:
            sleep(3600)
    except KeyboardInterrupt:
        pass 