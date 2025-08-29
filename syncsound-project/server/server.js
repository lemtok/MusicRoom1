const express = require('express');
const dotenv = require('dotenv');
const http = require('http'); // 1. Импортируем встроенный модуль http
const { Server } = require('socket.io'); // 2. Импортируем Server из socket.io

const connectDB = require('./config/db');
const userRoutes = require('./routes/userRoutes');
const roomRoutes = require('./routes/roomRoutes');
const { errorHandler } = require('./middleware/errorMiddleware');

const musicRoutes = require('./routes/musicRoutes'); // <-- Импортируем маршруты музыки


dotenv.config();
connectDB();

const app = express();
const httpServer = http.createServer(app); // 3. Создаем HTTP сервер на основе Express

// 4. Настраиваем Socket.IO сервер
const io = new Server(httpServer, {
    cors: {
        origin: '*', // Разрешаем доступ с любого источника (для разработки)
        methods: ['GET', 'POST'],
    },
});

// 5. Подключаем логику для сокетов (создадим этот файл на след. шаге)
require('./socket')(io);

app.use(express.json());

app.get('/', (req, res) => {
    res.send('API для SyncSound запущено...');
});

// Подключаем маршруты
app.use('/api/users', userRoutes);
app.use('/api/rooms', roomRoutes);

// Подключаем middleware для обработки ошибок
app.use(errorHandler);

app.use('/api/users', userRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/music', musicRoutes); // <-- Используем маршруты музыки

const PORT = process.env.PORT || 3000;

// 6. Запускаем HTTP сервер вместо app
httpServer.listen(PORT, () => {
    console.log(`Сервер (HTTP + WebSocket) успешно запущен на порту ${PORT}`);
});