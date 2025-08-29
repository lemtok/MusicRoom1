const Room = require('../models/Room');
const User = require('../models/User');

// @desc    Создание новой комнаты
// @route   POST /api/rooms
// @access  Private (только для авторизованных)
const createRoom = async (req, res) => {
    const { name } = req.body;

    if (!name) {
        res.status(400);
        throw new Error('Пожалуйста, укажите название комнаты');
    }

    // Создаем комнату в базе данных
    const room = await Room.create({
        name,
        host: req.user._id, // ID хоста мы берем из req.user, который добавил authMiddleware
        participants: [req.user._id], // Сразу добавляем хоста в участники
    });

    if (room) {
        res.status(201).json(room);
    } else {
        res.status(400);
        throw new Error('Не удалось создать комнату');
    }
};

// @desc    Получение комнат пользователя
// @route   GET /api/rooms
// @access  Private
const getRooms = async (req, res) => {
    // Ищем все комнаты, где в массиве 'participants' есть ID текущего пользователя
    const rooms = await Room.find({ participants: req.user._id });

    if (rooms) {
        res.json(rooms);
    } else {
        res.status(404);
        throw new Error('Комнаты не найдены');
    }
};

// @desc    Получение комнаты по ID
// @route   GET /api/rooms/:id
// @access  Private
const getRoomById = async (req, res) => {
    const room = await Room.findById(req.params.id);

    if (room) {
        const isParticipant = room.participants.some(participantId => participantId.equals(req.user._id));

        if (isParticipant) {
            res.json(room);
        } else {
            res.status(403); // 403 Forbidden
            throw new Error('У вас нет доступа к этой комнате');
        }
    } else {
        res.status(404);
        throw new Error('Комната не найдена');
    }
};

// @desc    Присоединение пользователя к комнате
// @route   POST /api/rooms/:id/join
// @access  Private
const joinRoom = async (req, res) => {
    const room = await Room.findById(req.params.id);

    if (room) {
        // Проверяем, не является ли пользователь уже участником
        const isParticipant = room.participants.some(p => p.equals(req.user._id));

        if (isParticipant) {
            // Если уже участник, просто возвращаем успех
            return res.status(200).json({ message: 'Вы уже в этой комнате' });
        }

        // Добавляем ID нового пользователя в массив участников
        room.participants.push(req.user._id);
        await room.save();

        res.status(200).json({ message: 'Вы успешно присоединились к комнате' });
    } else {
        res.status(404);
        throw new Error('Комната не найдена');
    }
};

module.exports = {
    createRoom,
    getRooms,
    getRoomById,
    joinRoom, // <-- Экспортируем новую функцию
};