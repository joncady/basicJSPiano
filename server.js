const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

app.use(express.static('content'));

app.get('/', function(req, res){
  res.sendFile(path.resolve( __dirname + '/index.html'));
});

io.on('connection', function(socket){
  console.log('a user connected');

  socket.on("keydown", (msg) => {
    io.emit("keydown", msg);
  });

  socket.on("keyup", (msg) => {
    io.emit("keyup", msg);
  });
});

http.listen(3000, function(){
  console.log('listening on *:3000');
});