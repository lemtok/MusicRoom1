const express = require('express');
const router = express.Router();
// Убираем getStreamUrl из импорта
const { searchTracks } = require('../controllers/musicController');
const { protect } = require('../middleware/authMiddleware');

router.post('/search', protect, searchTracks);
// Полностью удаляем строку router.post('/stream', ...);

module.exports = router;