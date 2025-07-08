@echo off
TITLE Grafana LiveUpdate Control

ECHO Starting Grafana Plugin Advertiser in a new window...
START "Plugin Advertiser" .\\advertiser\\plugin_advertiser.exe

ECHO Starting Docker containers...
ECHO Press Ctrl+C in this window to stop Grafana and the advertiser.
docker compose up

:: This part of the script will run after `docker compose up` is stopped.
ECHO.
ECHO Grafana containers stopped. Stopping the advertiser process...
taskkill /IM plugin_advertiser.exe /F

ECHO.
ECHO All services stopped.
pause 