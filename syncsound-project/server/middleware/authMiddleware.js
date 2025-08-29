const jwt = require('jsonwebtoken');
const User = require('../models/User.js');

const protect = async (req, res, next) => {
    let token;

    // Проверяем, есть ли заголовок Authorization и начинается ли он с "Bearer"
    if (
        req.headers.authorization &&
        req.headers.authorization.startsWith('Bearer')
    ) {
        try {
            // 1. Получаем токен из заголовка (убираем "Bearer ")
            token = req.headers.authorization.split(' ')[1];

            // 2. Верифицируем (проверяем) токен
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // 3. Находим пользователя в БД по ID из токена
            // и добавляем его в объект запроса (req), но без пароля
            req.user = await User.findById(decoded.id).select('-password');

            // 4. Передаем управление следующему middleware или контроллеру
            next();
        } catch (error) {
            console.error(error);
            res.status(401); // 401 - Unauthorized
            throw new Error('Нет авторизации, токен недействителен');
        }
    }

    if (!token) {
        res.status(401);
        throw new Error('Нет авторизации, отсутствует токен');
    }
};

module.exports = { protect };