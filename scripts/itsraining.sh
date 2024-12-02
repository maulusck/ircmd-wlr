#!/bin/sh

# read configuration
[ -r conf ] && . ./conf

measure_voltage() {
	curl -s "http://$tasmota_rainsens_ip/cm?cmnd=Status%208" | jq .StatusSNS.ANALOG.A1
}

while true; do

rain_voltage_measured=$(measure_voltage)
itsraining=$([ $rain_voltage_measured -lt $rain_voltage_threshold ] && echo YES || echo NO)

clear
	echo "
============================================
    RAIN SENSOR METER
============================================
Connecting to device: [$tasmota_rainsens_ip]

Voltage defaults:	$rain_voltage_defaults
Voltage threshold:	$rain_voltage_threshold
Voltage measured:	$rain_voltage_measured

It's raining: $itsraining
"
sleep 1
done
