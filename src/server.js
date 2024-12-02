const http = require('http');
const fs = require('fs');
const path = require('path'); // For file path management
const { fetchRainSensorData, triggerManualAction } = require('./sensor');  // Import the backend logic
const { fetchSensorDataPeriodically, closeWindowsIfRaining, getRainSensorValue } = require('./schedule');  // Import scheduled tasks

// Read configuration from config.json
const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
const SERVER_HOST = config.server.host;
const SERVER_PORT = config.server.port;
const REFRESH_INTERVAL = config.timings.refresh * 1000;
const BUTTONS = config.buttons; // Get the list of buttons to be generated

// Start the scheduled tasks
fetchSensorDataPeriodically();  // Start periodic fetching of sensor data
closeWindowsIfRaining();  // Start checking if it's raining and close windows if necessary

// Log requests with a timestamp and response status
function logRequest(req, statusCode) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.url} [${statusCode}]`);
}

// Handle requests to the server
http.createServer((req, res) => {
  const url = req.url;
  let statusCode = 200;

  // Serve the style.css file when requested
  if (url === '/style.css') {
    const cssPath = path.join(__dirname, 'style.css');
    fs.readFile(cssPath, 'utf8', (err, data) => {
      if (err) {
        res.writeHead(500);
        res.end('Error reading CSS file');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/css' });
      res.end(data);
    });
    return;
  }

  // Handle the root path
  if (url === '/') {
    // Calculate the rain status server-side
    const defaultValue = config.rainlevel.default;
    const threshold = config.rainlevel.threshold;
    const measuredValue = getRainSensorValue() !== null ? getRainSensorValue() : 'Loading...';

    // Determine if it's raining
    const isRaining = measuredValue !== 'Loading...' && measuredValue < threshold;
    const rainStatus = isRaining ? 'YES' : 'NO';

    // Check if the client supports JavaScript by inspecting the 'Accept' header
    const isJsEnabled = req.headers['accept'] && req.headers['accept'].includes('text/html');

    res.writeHead(statusCode, { 'Content-Type': 'text/html' });

    if (isJsEnabled) {
      // HTML for browsers with JavaScript enabled
      res.end(`
<html>
  <head>
    <link rel="stylesheet" type="text/css" href="/style.css">
  </head>
  <body>
  <div class="content">
    <h3>RAIN SENSOR DATA</h3>
    <p><strong>Default:</strong> ${defaultValue}</p>
    <p><strong>Threshold:</strong> ${threshold}</p>
    <p><strong>Measured:</strong> <span id="measured-value">${measuredValue}</span></p>
    <p><strong>Is it raining:</strong> <span id="rain-status">${rainStatus}</span></p>
    <br>
    <div style="display: flex; flex-direction: column; gap: 10px;">
      <div style="display: flex; gap: 10px;">
        <button onclick="fetch('/m/open-left').then(response => response.text()).then(data => alert(data))">Open Left</button>
        <button onclick="fetch('/m/open-right').then(response => response.text()).then(data => alert(data))">Open Right</button>
      </div>
      <div style="display: flex; gap: 10px;">
        <button onclick="fetch('/m/close-left').then(response => response.text()).then(data => alert(data))">Close Left</button>
        <button onclick="fetch('/m/close-right').then(response => response.text()).then(data => alert(data))">Close Right</button>
      </div>
    </div>

    <script>
      if (window.EventSource) {
        const source = new EventSource('/live-rain-sensor');
        source.onmessage = function(event) {
          const measured = event.data;
          const rainStatus = measured < ${threshold} ? 'YES' : 'NO';
          document.getElementById('measured-value').textContent = measured;
          document.getElementById('rain-status').textContent = rainStatus;
        };
      }
    </script>
  <div>
  </body>
</html>
      `);
    } else {
      // Minimal text output for browsers without JavaScript (e.g., curl)
      const clientHost = req.headers.host; // This gives the client's requested host (IP:port)
      res.end(`
Rain Sensor Data
----------------
Default: ${defaultValue}
Threshold: ${threshold}
Measured: ${measuredValue}
Is it raining: ${rainStatus}

Manual Actions:
---------------
${BUTTONS.map(key => `  curl -sSL http://${clientHost}/m/${key}  # ${key.replace('-', ' ').replace(/\b\w/g, char => char.toUpperCase())}`).join('\n')}      
`);
    }
  }

  // Handle the live rain sensor data stream for JS-enabled clients
  else if (url === '/live-rain-sensor') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });

    // Send the current rain sensor value to the client
    const sendData = () => {
      res.write(`data: ${getRainSensorValue()}\n\n`);
    };

    sendData();
    const interval = setInterval(sendData, REFRESH_INTERVAL);

    req.on('close', () => {
      clearInterval(interval);
    });
  }

  // Handle the /m/ API endpoints for opening/closing windows
  else if (url.startsWith('/m/')) {
    // Trigger the corresponding Manual action
    triggerManualAction(url, (err, irSend) => {
      if (err) {
        res.writeHead(500);
        res.end(`Error: ${err.message}`);
      } else {
        res.writeHead(200);
        res.end(`Response: ${irSend}`);
      }
    });
  }

  // Handle 404 for unknown routes
  else {
    statusCode = 404;
    res.writeHead(statusCode);
    res.end('Not Found');
  }

  // Log the request and status code
  logRequest(req, statusCode);

}).listen(SERVER_PORT, SERVER_HOST, () => {
  console.log(`Server running at http://${SERVER_HOST}:${SERVER_PORT}`);
});