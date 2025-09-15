const Room = require('./models/Room');

module.exports = (io) => {
    const usersInRooms = {};

    io.on('connection', (socket) => {
        socket.on('joinRoom', async ({ roomId, user }) => {
            if (!user) return;
            socket.join(roomId);

            if (!usersInRooms[roomId]) {
                usersInRooms[roomId] = [];
            }
            
            socket.emit('all users', usersInRooms[roomId]);

            usersInRooms[roomId].push({ socketId: socket.id, user });
        });

        socket.on('sending signal', payload => {
            io.to(payload.userToSignal).emit('user joined', {
                signal: payload.signal,
                callerId: payload.callerId,
                user: payload.user
            });
        });

        socket.on('returning signal', payload => {
            io.to(payload.callerId).emit('receiving returned signal', {
                signal: payload.signal,
                id: socket.id
            });
        });

        socket.on('disconnect', () => {
            let roomID;
            for (const id in usersInRooms) {
                const userIndex = usersInRooms[id].findIndex(u => u.socketId === socket.id);
                if (userIndex !== -1) {
                    roomID = id;
                    usersInRooms[id].splice(userIndex, 1);
                    break;
                }
            }
            if (roomID) {
                io.to(roomID).emit('user left', socket.id);
            }
        });

        // --- Остальные обработчики без изменений ---
        socket.on('chatMessage', ({ roomId, user, message }) => { io.to(roomId).emit('newMessage', { user: { _id: user._id, name: user.name }, message }); });
        socket.on('addTrackToQueue', async ({ roomId, trackData, user }) => { const room = await Room.findById(roomId); if (room) { const newTrack = { ...trackData, addedBy: { _id: user._id, name: user.name } }; room.queue.push(newTrack); await room.save(); io.to(roomId).emit('queueUpdated', room.queue); } });
        socket.on('togglePlay', async ({ roomId, isPlaying }) => { try { await Room.findByIdAndUpdate(roomId, { isPlaying }); io.to(roomId).emit('playerStateChanged', { isPlaying }); } catch (error) { console.error('Ошибка togglePlay:', error); } });
        socket.on('playNextTrack', async ({ roomId }) => { try { const room = await Room.findById(roomId); if (room) { room.currentTrack = room.queue.length > 0 ? room.queue.shift() : null; room.isPlaying = !!room.currentTrack; await room.save(); io.to(roomId).emit('newTrackPlaying', { currentTrack: room.currentTrack, isPlaying: room.isPlaying, queue: room.queue }); } } catch (error) { console.error('Ошибка переключения трека:', error); } });
    });
};