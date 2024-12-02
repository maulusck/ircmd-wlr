const { fetchRainSensorData, triggerManualAction } = require('./sensor'); // Import the sensor logic
const fs = require('fs');

// Read configuration from config.json
const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
const REFRESH_INTERVAL = config.timings.refresh * 1000;  // Fetching interval
const THRESHOLD = config.rainlevel.threshold;  // The threshold for rain detection
const CLOSE_COMMANDS = ['close-left', 'close-right'];  // The actions to trigger when it's raining

let rainSensorValue = 'Loading...';

// Fetch the rain sensor data periodically
function fetchSensorDataPeriodically() {
    setInterval(() => {
        fetchRainSensorData((err, data) => {
            if (err) {
                console.error('Error fetching rain sensor data:', err);
                return;
            }
            rainSensorValue = data;
            console.log(`Fetched rain sensor value: ${rainSensorValue}`);
        });
    }, REFRESH_INTERVAL);
}

// Automatically close windows if it's raining (sensor value below threshold)
function closeWindowsIfRaining() {
    setInterval(() => {
        if (rainSensorValue !== null && rainSensorValue < THRESHOLD) {
            console.log('It\'s raining! Closing windows...');
            CLOSE_COMMANDS.forEach(command => {
                triggerManualAction(`/m/${command}`, (err, response) => {
                    if (err) {
                        console.error(`Failed to trigger ${command}:`, err);
                    } else {
                        console.log(`${command} triggered successfully:`, response);
                    }
                });
            });
        } else {
            console.log('It\'s not raining. No action taken.');
        }
    }, REFRESH_INTERVAL);
}

// Export functions and the sensor value
module.exports = {
    fetchSensorDataPeriodically,
    closeWindowsIfRaining,
    getRainSensorValue: () => rainSensorValue  // This allows server.js to access the value
};