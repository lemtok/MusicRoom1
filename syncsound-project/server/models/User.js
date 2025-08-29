const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Создаем схему (описание структуры) для пользователя
const userSchema = mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'Пожалуйста, добавьте имя'],
        },
        email: {
            type: String,
            required: [true, 'Пожалуйста, добавьте email'],
            unique: true, // email должен быть уникальным
            match: [/.+\@.+\..+/, 'Пожалуйста, введите корректный email'],
        },
        password: {
            type: String,
            required: [true, 'Пожалуйста, добавьте пароль'],
        },
    },
    {
        // Добавляет два поля: createdAt и updatedAt
        timestamps: true,
    }
);

// Middleware (функция), которая будет выполняться ПЕРЕД сохранением пользователя в базу
userSchema.pre('save', async function (next) {
    // Хешируем пароль, только если он был изменен (или новый)
    if (!this.isModified('password')) {
        return next();
    }

    // "Соль" - это случайная строка, добавляемая к паролю для усложнения хеша
    const salt = await bcrypt.genSalt(10);
    // Хешируем пароль пользователя с этой солью
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

// Создаем и экспортируем модель 'User' на основе нашей схемы
module.exports = mongoose.model('User', userSchema);