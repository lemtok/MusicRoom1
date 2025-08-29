const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        // Пытаемся подключиться к MongoDB, используя строку из .env
        const conn = await mongoose.connect(process.env.MONGO_URI);

        // Если подключение успешно, выводим сообщение в консоль
        console.log(`MongoDB успешно подключена: ${conn.connection.host}`);
    } catch (error) {
        // Если произошла ошибка, выводим ее и завершаем процесс
        console.error(`Ошибка подключения к MongoDB: ${error.message}`);
        process.exit(1);
    }
};

// Экспортируем функцию, чтобы ее можно было использовать в других файлах
module.exports = connectDB;