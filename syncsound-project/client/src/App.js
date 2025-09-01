import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';

// Импортируем все наши страницы
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import RoomPage from './pages/RoomPage';
import JoinPage from './pages/JoinPage';

function App() {
    return (
        <Router>
            <main>
                <Routes>
                    <Route path="/" element={<HomePage />} />
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/register" element={<RegisterPage />} />
                    <Route path="/room/:id" element={<RoomPage />} />
                    <Route path="/join/:roomId" element={<JoinPage />} />
                </Routes>
            </main>
        </Router>
    );
}

export default App;