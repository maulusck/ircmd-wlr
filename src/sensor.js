const http = require('http');
const fs = require('fs');

// Read configuration from config.json
const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
const RAIN_SENSOR_IP = config.devices.rain_sensor;
const IR_CONTROLLER_IP = config.devices.ir_controller;
const ENDPOINTS = config.endpoints;

let rainSensorValue = null;

// Function to fetch rain sensor data
function fetchRainSensorData(callback) {
    const url = `http://${RAIN_SENSOR_IP}${ENDPOINTS['get-rain-data']}`;

    // Log the request being made
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] Fetching data from ${url}`);

    http.get(url, (apiRes) => {
        let data = '';
        apiRes.on('data', chunk => { data += chunk; });
        apiRes.on('end', () => {
            try {
                const parsedData = JSON.parse(data);
                rainSensorValue = parsedData.StatusSNS?.ANALOG?.A1 || 'Error retrieving data';

                // Log the successful response
                console.log(`[${timestamp}] Successfully fetched rain sensor data: ${rainSensorValue}`);

                if (callback && typeof callback === 'function') {
                    callback(null, rainSensorValue); // Call the callback with the data
                }
            } catch (parseError) {
                rainSensorValue = 'Error parsing data';

                // Log the parsing error
                console.error(`[${timestamp}] Error parsing fetched data: ${parseError.message}`);

                if (callback && typeof callback === 'function') {
                    callback(parseError); // Call the callback with the error
                }
            }
        });
    }).on('error', (err) => {
        rainSensorValue = 'Error fetching data';

        // Log the fetch error
        console.error(`[${timestamp}] Error fetching data from ${url}: ${err.message}`);

        if (callback && typeof callback === 'function') {
            callback(err); // Call the callback with the error
        }
    });
}

// Function to trigger Velux IR device action and parse the response
function triggerManualAction(action, callback) {
    // Map the action path (e.g., "/m/open-left") to the corresponding endpoint
    const actionKey = action.replace('/m/', '');
    const endpoint = ENDPOINTS[actionKey];

    // If no endpoint is found for the action, return an error
    if (!endpoint) {
        const errorMessage = `Invalid action: ${action}`;
        console.error(`[${new Date().toISOString()}] ${errorMessage}`);
        return callback(new Error(errorMessage));
    }

    // Construct the URL using the IR controller IP and the endpoint from config
    const url = `http://${IR_CONTROLLER_IP}${endpoint}`;

    // Log the request being made
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] Triggering Velux action from ${url}`);

    // Make the GET request to the IR controller
    http.get(url, (apiRes) => {
        let data = '';
        apiRes.on('data', chunk => { data += chunk; });
        apiRes.on('end', () => {
            try {
                // Parse the response data
                const parsedData = JSON.parse(data);
                const irSend = parsedData.IRSend || 'No IR send action found';

                // Log the response from Velux IR device
                console.log(`[${timestamp}] Velux IR response: ${irSend}`);

                // Return the IR send data to the callback
                callback(null, irSend);
            } catch (parseError) {
                const errorMessage = 'Error parsing Velux IR data';

                // Log the parsing error
                console.error(`[${timestamp}] ${errorMessage}: ${parseError.message}`);

                callback(parseError);
            }
        });
    }).on('error', (err) => {
        const errorMessage = 'Error triggering Velux action';

        // Log the fetch error
        console.error(`[${timestamp}] ${errorMessage}: ${err.message}`);

        callback(err);
    });
}

// Export the functions so they can be imported in the server.js
module.exports = {
    fetchRainSensorData,
    triggerManualAction
};