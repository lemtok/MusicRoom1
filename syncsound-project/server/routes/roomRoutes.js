const express = require('express');
const router = express.Router();
const { createRoom, getRooms, getRoomById, joinRoom } = require('../controllers/roomController');
const { protect } = require('../middleware/authMiddleware');

// Теперь маршрут '/' обрабатывает два метода:
// POST для создания комнаты и GET для получения списка комнат.
// Оба защищены.
router.route('/').post(protect, createRoom).get(protect, getRooms);
router.route('/:id').get(protect, getRoomById);
router.route('/:id/join').post(protect, joinRoom); // <-- НОВЫЙ МАРШРУТ

module.exports = router;