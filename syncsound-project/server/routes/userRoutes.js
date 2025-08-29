const express = require('express');
const router = express.Router();
const { registerUser, loginUser } = require('../controllers/userController');

// Когда приходит POST-запрос на /api/users/register, вызывается функция registerUser
router.post('/register', registerUser);

// Когда приходит POST-запрос на /api/users/login, вызывается функция loginUser
router.post('/login', loginUser);

module.exports = router;