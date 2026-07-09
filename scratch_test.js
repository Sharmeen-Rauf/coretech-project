const net = require('net');

const ports = [3000, 3001, 3002, 3099, 5000, 8000, 8080];
ports.forEach(port => {
  const server = net.createServer()
    .once('error', err => {
      if (err.code === 'EADDRINUSE') {
        console.log(`Port ${port} is active (in use)`);
      }
    })
    .once('listening', () => {
      server.close();
    })
    .listen(port, '127.0.0.1');
});
