const jwt = require('jsonwebtoken');

const generateToken = (id) => {
    // jwt.sign() создает токен. Мы "подписываем" ID пользователя
    // секретным ключом, который будет храниться в .env
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: '30d', // Токен будет действителен 30 дней
    });
};

module.exports = generateToken;