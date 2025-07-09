import PyInstaller.__main__
import os

if __name__ == '__main__':
    PyInstaller.__main__.run([
        'run_plugin_advertiser.py',
        '--onefile',
        '--name', 'plugin_advertiser',
        '--distpath', './advertiser',
        '--add-data', 'd3plugin.json;.'
    ]) 