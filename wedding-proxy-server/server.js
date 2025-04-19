const express = require('express');
const fetch = require('node-fetch');

const app = express();
const port = 3000;  // You can change this to any available port

// Define a route to handle the proxy request
app.get('/proxy', async (req, res) => {
  try {
    const baseUrl = 'https://script.google.com/macros/s/AKfycbyWxq-9p6Wr3WxspOq08FsMh8e4Y2tZDDEpSYw_mM5TKDnN0I9xpuYqRtZkDzLbXveT/exec';

    // Get query params from the original request
    const queryParams = new URLSearchParams(req.query).toString();

    const url = `${baseUrl}?${queryParams}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      throw new Error(`Google Apps Script returned status ${response.status}`);
    }


    const data = await response.json();  // Assuming the response is JSON
    
    // Send the response data back to the client
    res.json(data);
  } catch (error) {
    console.error('Error fetching data:', error.message, error.stack);
    res.status(500).send('Internal Server Error');
  }
});

console.log('Server is starting...');
app.listen(port, () => {
  console.log(`Proxy server is running on http://localhost:${port}`);
});

// Start the server
app.listen(port, () => {
  console.log(`Proxy server is running on http://localhost:${port}`);
});
