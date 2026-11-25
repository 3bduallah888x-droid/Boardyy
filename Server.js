const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

// كل روم: { strokes: [], notes: [] }
const rooms = {};

function getRoom(name) {
  if (!rooms[name]) rooms[name] = { strokes: [], notes: [] };
  return rooms[name];
}

io.on('connection', (socket) => {
  let currentRoom = null;

  socket.on('join', (roomName) => {
    roomName = String(roomName || '').trim().toLowerCase().slice(0, 40);
    if (!roomName) return;
    currentRoom = roomName;
    socket.join(roomName);
    const room = getRoom(roomName);
    socket.emit('init', room);
    const count = io.sockets.adapter.rooms.get(roomName)?.size || 1;
    io.to(roomName).emit('users', count);
  });

  socket.on('stroke', (stroke) => {
    if (!currentRoom) return;
    getRoom(currentRoom).strokes.push(stroke);
    socket.to(currentRoom).emit('stroke', stroke);
  });

  socket.on('erase', (id) => {
    if (!currentRoom) return;
    const room = getRoom(currentRoom);
    room.strokes = room.strokes.filter((s) => s.id !== id);
    socket.to(currentRoom).emit('erase', id);
  });

  socket.on('note', (note) => {
    if (!currentRoom) return;
    const room = getRoom(currentRoom);
    const i = room.notes.findIndex((n) => n.id === note.id);
    if (i >= 0) room.notes[i] = note; else room.notes.push(note);
    socket.to(currentRoom).emit('note', note);
  });

  socket.on('clear', () => {
    if (!currentRoom) return;
    rooms[currentRoom] = { strokes: [], notes: [] };
    io.to(currentRoom).emit('clear');
  });

  socket.on('disconnect', () => {
    if (currentRoom) {
      const count = io.sockets.adapter.rooms.get(currentRoom)?.size || 0;
      io.to(currentRoom).emit('users', count);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log('Running on port ' + PORT));
