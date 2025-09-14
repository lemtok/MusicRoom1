const Room = require('./models/Room');

module.exports = (io) => {
    // Хранилище в памяти для отслеживания пользователей в комнатах для WebRTC
    const usersInRooms = {};

    io.on('connection', (socket) => {
        console.log(`Новое WebSocket соединение: ${socket.id}`);

        // --- ОБРАБОТЧИК ВХОДА В КОМНАТУ (ОБЪЕДИНЕННЫЙ) ---
        socket.on('joinRoom', async ({ roomId, user }) => {
            try {
                socket.join(roomId);
                console.log(`Пользователь ${user.name} (${socket.id}) присоединился к комнате ${roomId}`);
                
                // --- Логика для WebRTC ---
                if (!usersInRooms[roomId]) {
                    usersInRooms[roomId] = [];
                }

                // Отправляем новому пользователю список всех, кто уже в комнате
                const existingUsers = usersInRooms[roomId];
                socket.emit('all users', existingUsers);

                // Добавляем нового пользователя в список
                usersInRooms[roomId].push({ socketId: socket.id, user });
                // --- Конец логики WebRTC ---

                // --- Старая логика для синхронизации плеера и очереди ---
                const room = await Room.findById(roomId);
                if (room) {
                    socket.emit('initialRoomState', {
                        queue: room.queue,
                        currentTrack: room.currentTrack,
                        isPlaying: room.isPlaying,
                    });
                }
            } catch (error) {
                console.error(`Ошибка при входе в комнату ${roomId}:`, error);
            }
        });

        // --- СУЩЕСТВУЮЩИЕ ОБРАБОТЧИКИ ---
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

        // --- НОВЫЕ ОБРАБОТЧИКИ ДЛЯ "СИГНАЛИНГА" WEBRTC ---
        
        // 1. Когда новый участник (инициатор) отправляет сигнал существующему
        socket.on('sending signal', payload => {
            io.to(payload.userToSignal).emit('user joined', { 
                signal: payload.signal, 
                callerId: payload.callerId, 
                user: payload.user 
            });
        });

        // 2. Когда существующий участник отправляет ответный сигнал новому
        socket.on('returning signal', payload => {
            io.to(payload.callerId).emit('receiving returned signal', { 
                signal: payload.signal, 
                id: socket.id 
            });
        });

        // --- ОБНОВЛЕННЫЙ ОБРАБОТЧИК ОТКЛЮЧЕНИЯ ---
        socket.on('disconnect', () => {
            console.log(`Соединение разорвано: ${socket.id}`);
            
            // Находим комнату, в которой был пользователь, и удаляем его из списка
            let roomID;
            let userThatLeft;
            for (const id in usersInRooms) {
                const userIndex = usersInRooms[id].findIndex(u => u.socketId === socket.id);
                if (userIndex !== -1) {
                    roomID = id;
                    userThatLeft = usersInRooms[id][userIndex];
                    usersInRooms[id].splice(userIndex, 1);
                    break;
                }
            }
            
            // Если пользователь был найден, оповещаем всех остальных в комнате
            if (roomID) {
                console.log(`Пользователь ${userThatLeft.user.name} покинул комнату ${roomID}`);
                io.to(roomID).emit('user left', socket.id);
            }
        });
    });
};