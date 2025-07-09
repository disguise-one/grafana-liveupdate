from designer_plugin import DesignerPlugin
from time import sleep
import json
import socket
import sys
import os
import traceback

def get_hostname():
    """
    Finds the hostname of the machine.
    """
    try:
        return socket.gethostname()
    except Exception:
        return 'localhost'

def get_plugin_config_path():
    """
    Get the path to d3plugin.json, handling both development and PyInstaller environments.
    """
    if getattr(sys, 'frozen', False):
        # Running in PyInstaller bundle
        base_path = sys._MEIPASS
    else:
        # Running in development
        base_path = os.path.dirname(os.path.abspath(__file__))
    
    return os.path.join(base_path, 'd3plugin.json')

def get_writable_config_path():
    """
    Get a writable path for the modified d3plugin.json (current working directory).
    """
    return os.path.join(os.getcwd(), 'd3plugin.json')

# The port for the Grafana service which we are advertising
grafana_port = 3030

try:
    # Read the base config from the JSON file
    plugin_config_path = get_plugin_config_path()
    with open(plugin_config_path, 'r') as f:
        plugin_data = json.load(f)

    # Dynamically construct the absolute URLs
    host = get_hostname()
    plugin_data['url'] = f"http://{host}:{grafana_port}/?kiosk"
    if 'icon' in plugin_data and plugin_data['icon'].startswith('/'):
        plugin_data['icon'] = f"http://{host}:{grafana_port}{plugin_data['icon']}"

    # Write the modified config back to a writable location
    writable_config_path = get_writable_config_path()
    with open(writable_config_path, 'w') as f:
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
except Exception:
    print("An error occurred:")
    traceback.print_exc() 