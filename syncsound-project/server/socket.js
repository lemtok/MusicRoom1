const Room = require('./models/Room');

module.exports = (io) => {
    const usersInRooms = {}; // Хранилище пользователей { roomId: [{ socketId, user }] }

    io.on('connection', (socket) => {
        console.log(`Новое WebSocket соединение: ${socket.id}`);

        // --- ОБРАБОТЧИК ВХОДА В КОМНАТУ ---
        socket.on('joinRoom', async ({ roomId, user }) => {
            try {
                // 1. Присоединяем сокет к комнате
                socket.join(roomId);
                console.log(`Пользователь ${user.name} (${socket.id}) присоединился к комнате ${roomId}`);

                // 2. Инициализируем хранилище для комнаты, если его нет
                if (!usersInRooms[roomId]) {
                    usersInRooms[roomId] = [];
                }

                // 3. Отправляем НОВОМУ пользователю список всех, кто УЖЕ в комнате
                const existingUsers = usersInRooms[roomId];
                socket.emit('all users', existingUsers);

                // 4. УВЕДОМЛЯЕМ ВСЕХ СТАРЫХ участников о том, что пришел новичок
                // Это ключевой исправленный шаг!
                socket.to(roomId).emit('user joined', {
                    callerId: socket.id,
                    user: user
                });

                // 5. Добавляем нового пользователя в список для этой комнаты
                usersInRooms[roomId].push({ socketId: socket.id, user });

            } catch (error) {
                console.error(`Ошибка при входе в комнату ${roomId}:`, error);
            }
        });

        // --- ЛОГИКА СИГНАЛИНГА (ПЕРЕДАЧА WEBRTC ДАННЫХ) ---
        // Сервер здесь просто почтальон - он ничего не меняет, только пересылает.

        // Событие от инициатора (новичка) к существующему участнику
        socket.on('sending signal', payload => {
            io.to(payload.userToSignal).emit('receiving signal', {
                signal: payload.signal,
                callerId: payload.callerId,
                user: payload.user
            });
        });

        // Ответное событие от существующего участника к инициатору (новичку)
        socket.on('returning signal', payload => {
            io.to(payload.callerId).emit('receiving returned signal', {
                signal: payload.signal,
                id: socket.id
            });
        });

        // --- ОБРАБОТЧИК ОТКЛЮЧЕНИЯ ---
        socket.on('disconnect', () => {
            console.log(`Соединение разорвано: ${socket.id}`);
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

        // --- СТАРАЯ ЛОГИКА ДЛЯ ПЛЕЕРА (остается без изменений) ---
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
    });
};