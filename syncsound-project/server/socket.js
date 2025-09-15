const Room = require('./models/Room');

module.exports = (io) => {
    // Хранилище в памяти для отслеживания пользователей в комнатах
    // Формат: { roomId: [ { socketId, user }, ... ] }
    const usersInRooms = {};

    io.on('connection', (socket) => {
        console.log(`Новое WebSocket соединение: ${socket.id}`);

        // --- ОБРАБОТЧИК ВХОДА В КОМНАТУ ---
        socket.on('joinRoom', async ({ roomId, user }) => {
            if (!user) return; // Защита от входа без данных пользователя

            console.log(`Пользователь ${user.name} (${socket.id}) входит в комнату ${roomId}`);
            
            socket.join(roomId);

            if (!usersInRooms[roomId]) {
                usersInRooms[roomId] = [];
            }

            // 1. Отправляем НОВОМУ пользователю список всех, кто УЖЕ в комнате
            //    (исключая его самого, чтобы он не создавал соединение с собой)
            const existingUsers = usersInRooms[roomId].filter(u => u.socketId !== socket.id);
            console.log(`Отправляем новому пользователю ${socket.id} список существующих:`, existingUsers.map(u => u.socketId));
            socket.emit('all users', existingUsers);

            // 2. Добавляем нового пользователя в список для этой комнаты
            usersInRooms[roomId].push({ socketId: socket.id, user });

            // 3. Уведомляем всех ОСТАЛЬНЫХ пользователей в комнате о новом участнике
            //    (но НЕ самого нового пользователя)
            console.log(`Уведомляем остальных в комнате ${roomId} о новом пользователе ${socket.id}`);
            socket.to(roomId).emit('user joined notification', {
                newUser: { socketId: socket.id, user },
                message: `${user.name} присоединился к комнате`
            });
        });

        // --- ЛОГИКА СИГНАЛИНГА ---
        // Инициатор (обычно новичок) отправляет сигнал существующему участнику
        socket.on('sending signal', payload => {
            console.log(`Пересылаем сигнал от ${payload.callerId} к ${payload.userToSignal}`);
            // Убеждаемся, что не отправляем сигнал самому себе
            if (payload.userToSignal !== payload.callerId) {
                io.to(payload.userToSignal).emit('user joined', {
                    signal: payload.signal,
                    callerId: payload.callerId,
                    user: payload.user
                });
            }
        });

        // Существующий участник отправляет ответный сигнал инициатору
        socket.on('returning signal', payload => {
            console.log(`Возвращаем сигнал от ${socket.id} к ${payload.callerId}`);
            // Убеждаемся, что не отправляем сигнал самому себе
            if (payload.callerId !== socket.id) {
                io.to(payload.callerId).emit('receiving returned signal', {
                    signal: payload.signal,
                    id: socket.id
                });
            }
        });

        // --- ОБРАБОТЧИК ОТКЛЮЧЕНИЯ ---
        socket.on('disconnect', () => {
            console.log(`Соединение разорвано: ${socket.id}`);
            let roomID;
            let disconnectedUser;
            
            // Находим пользователя и удаляем его из списка
            for (const id in usersInRooms) {
                const userIndex = usersInRooms[id].findIndex(u => u.socketId === socket.id);
                if (userIndex !== -1) {
                    roomID = id;
                    disconnectedUser = usersInRooms[id][userIndex];
                    usersInRooms[id].splice(userIndex, 1);
                    break;
                }
            }
            
            if (roomID && disconnectedUser) {
                console.log(`Уведомляем комнату ${roomID} об отключении ${socket.id}`);
                // Уведомляем всех оставшихся, что пользователь ушел
                socket.to(roomID).emit('user left', socket.id);
            }
        });

        // --- ДОПОЛНИТЕЛЬНЫЕ ОБРАБОТЧИКИ ДЛЯ ДИАГНОСТИКИ ---
        socket.on('request room users', ({ roomId }) => {
            const users = usersInRooms[roomId] || [];
            socket.emit('room users list', users);
        });

        // --- ЛОГИКА ДЛЯ ПЛЕЕРА И ЧАТА (остается без изменений) ---
        socket.on('chatMessage', ({ roomId, user, message }) => {
            io.to(roomId).emit('newMessage', { 
                user: { _id: user._id, name: user.name }, 
                message 
            });
        });

        socket.on('addTrackToQueue', async ({ roomId, trackData, user }) => {
            try {
                const room = await Room.findById(roomId);
                if (room) {
                    const newTrack = { ...trackData, addedBy: { _id: user._id, name: user.name } };
                    room.queue.push(newTrack);
                    await room.save();
                    io.to(roomId).emit('queueUpdated', room.queue);
                }
            } catch (error) {
                console.error('Ошибка добавления трека:', error);
            }
        });

        socket.on('togglePlay', async ({ roomId, isPlaying }) => {
            try {
                await Room.findByIdAndUpdate(roomId, { isPlaying });
                io.to(roomId).emit('playerStateChanged', { isPlaying });
            } catch (error) { 
                console.error('Ошибка togglePlay:', error); 
            }
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
            } catch (error) { 
                console.error('Ошибка переключения трека:', error); 
            }
        });
    });
};