const Room = require('./models/Room');

module.exports = (io) => {
    io.on('connection', (socket) => {
        socket.on('joinRoom', async ({ roomId, user }) => {
            socket.join(roomId);
            const room = await Room.findById(roomId);
            if (room) {
                socket.emit('initialRoomState', {
                    queue: room.queue,
                    currentTrack: room.currentTrack,
                    isPlaying: room.isPlaying,
                });
            }
        });
        socket.on('chatMessage', ({ roomId, user, message }) => {
            io.to(roomId).emit('newMessage', { user: { _id: user._id, name: user.name }, message });
        });
        socket.on('addTrackToQueue', async ({ roomId, trackData, user }) => {
            const room = await Room.findById(roomId);
            if (room) {
                const newTrack = { ...trackData, addedBy: { _id: user._id, name: user.name } };
                room.queue.push(newTrack);
                await room.save();
                io.to(roomId).emit('queueUpdated', room.queue);
            }
        });
        socket.on('togglePlay', async ({ roomId, isPlaying }) => {
             try {
                await Room.findByIdAndUpdate(roomId, { isPlaying });
                io.to(roomId).emit('playerStateChanged', { isPlaying });
            } catch (error) { console.error('Ошибка togglePlay:', error); }
        });
        socket.on('playNextTrack', async ({ roomId }) => {
            try {
                const room = await Room.findById(roomId);
                if (room) {
                    room.currentTrack = room.queue.length > 0 ? room.queue.shift() : null;
                    room.isPlaying = !!room.currentTrack;
                    await room.save();
                    io.to(roomId).emit('newTrackPlaying', {
                        currentTrack: room.currentTrack,
                        isPlaying: room.isPlaying,
                        queue: room.queue
                    });
                }
            } catch (error) { console.error('Ошибка переключения трека:', error); }
        });
        socket.on('disconnect', () => {});
    });
};