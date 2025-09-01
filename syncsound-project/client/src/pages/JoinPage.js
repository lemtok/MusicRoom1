import React, { useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';

const JoinPage = () => {
    const { roomId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        const join = async () => {
            const storedUserInfo = localStorage.getItem('userInfo');

            if (!storedUserInfo) {
                // Если пользователь не залогинен, сохраняем, куда он хотел попасть...
                localStorage.setItem('redirectPath', location.pathname);
                // ...и отправляем на страницу входа.
                navigate('/login');
                return;
            }

            try {
                const { token } = JSON.parse(storedUserInfo);
                const config = {
                    headers: { Authorization: `Bearer ${token}` },
                };
                
                // Отправляем запрос на бэкенд для присоединения
                await axios.post(`/api/rooms/${roomId}/join`, {}, config);

                // Если все успешно, перенаправляем в комнату
                navigate(`/room/${roomId}`);
            } catch (err) {
                console.error('Не удалось присоединиться к комнате', err);
                // Если ошибка, отправляем на главную
                navigate('/');
            }
        };

        join();
    }, [roomId, navigate, location.pathname]);

    return (
        <div style={{ padding: '2rem', textAlign: 'center' }}>
            <h2>Присоединение к комнате...</h2>
        </div>
    );
};

export default JoinPage;