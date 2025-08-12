const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:8080/graphql');

ws.on('open', function open() {
  console.log('Connected to WebSocket server');
  ws.close();
});

ws.on('error', function error(err) {
  console.log('WebSocket error:', err);
});

ws.on('close', function close() {
  console.log('Disconnected from WebSocket server');
});
