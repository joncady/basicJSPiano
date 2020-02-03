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

  socket.on("join", (msg) => {
    socket.join(msg.room);
  });

  socket.on("leave", (msg) => {
    socket.leave(msg.room);
  });

  socket.on("keydown", (msg) => {
    if (msg.room) {
      io.to(msg.room).emit("keydown", msg);
    } else {
      io.emit("keydown", msg);
    }
  });

  socket.on("keyup", (msg) => {
    if (msg.room) {
      io.to(msg.room).emit("keyup", msg);
    } else {
      io.emit("keyup", msg);
    }
  });
});

http.listen(process.env.PORT || 3000, function(){
  console.log('listening on *:3000');
});