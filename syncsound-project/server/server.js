const express = require('express');
const dotenv = require('dotenv');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors'); // <-- 1. Импортируем cors
const connectDB = require('./config/db');
const userRoutes = require('./routes/userRoutes');
const roomRoutes = require('./routes/roomRoutes');
const musicRoutes = require('./routes/musicRoutes');
const { errorHandler } = require('./middleware/errorMiddleware');

dotenv.config();
connectDB();

const app = express();

// --- 2. ДОБАВЛЯЕМ НАСТРОЙКИ CORS ---
// Указываем, какому адресу мы доверяем.
const corsOptions = {
    origin: 'https://syncdound-project-frontend.netlify.app',
    methods: ['GET', 'POST'],
};
app.use(cors(corsOptions));
// --- КОНЕЦ ИЗМЕНЕНИЙ ---

app.use(express.json());

const httpServer = http.createServer(app);

const io = new Server(httpServer, {
    cors: corsOptions, // <-- 3. Используем те же опции и для сокетов
});

require('./socket')(io);

app.get('/', (req, res) => {
    res.send('API для SyncSound запущено...');
});

app.use('/api/users', userRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/music', musicRoutes);

app.use(errorHandler);

const PORT = process.env.PORT || 5000;

httpServer.listen(PORT, () => {
    console.log(`Сервер (HTTP + WebSocket) успешно запущен на порту ${PORT}`);
});