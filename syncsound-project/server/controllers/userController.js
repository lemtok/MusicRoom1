const User = require('../models/User');
const generateToken = require('../utils/generateToken');
const bcrypt = require('bcryptjs');

// @desc    Регистрация нового пользователя
// @route   POST /api/users/register
// @access  Public
const registerUser = async (req, res) => {
    // 1. Получаем данные из тела запроса
    const { name, email, password } = req.body;

    // 2. Проверяем, что все поля переданы
    if (!name || !email || !password) {
        res.status(400);
        throw new Error('Пожалуйста, заполните все поля');
    }

    // 3. Проверяем, не существует ли уже пользователь с таким email
    const userExists = await User.findOne({ email });

    if (userExists) {
        res.status(400);
        throw new Error('Пользователь с таким email уже существует');
    }

    // 4. Создаем нового пользователя в базе данных
    // (хеширование пароля происходит автоматически благодаря pre-save middleware в модели)
    const user = await User.create({
        name,
        email,
        password,
    });

    // 5. Если пользователь успешно создан, отправляем ответ
    if (user) {
        res.status(201).json({
            _id: user._id,
            name: user.name,
            email: user.email,
            token: generateToken(user._id), // Генерируем и отправляем токен
        });
    } else {
        res.status(400);
        throw new Error('Неверные данные пользователя');
    }
};

// @desc    Аутентификация пользователя (логин)
// @route   POST /api/users/login
// @access  Public
const loginUser = async (req, res) => {
    const { email, password } = req.body;

    // 1. Ищем пользователя по email
    const user = await User.findOne({ email });

    // 2. Сравниваем введенный пароль с хешированным паролем в базе
    const isMatch = user && (await bcrypt.compare(password, user.password));

    if (isMatch) {
        // Если все совпало, отправляем данные и новый токен
        res.json({
            _id: user._id,
            name: user.name,
            email: user.email,
            token: generateToken(user._id),
        });
    } else {
        res.status(401); // 401 - Unauthorized
        throw new Error('Неверный email или пароль');
    }
};

module.exports = {
    registerUser,
    loginUser,
};