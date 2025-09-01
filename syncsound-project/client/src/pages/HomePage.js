import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';

const HomePage = () => {
    const navigate = useNavigate();

    const [userInfo, setUserInfo] = useState(null);
    const [roomName, setRoomName] = useState('');
    const [rooms, setRooms] = useState([]);
    const [error, setError] = useState(null);
    const [copiedRoomId, setCopiedRoomId] = useState(null);

    useEffect(() => {
        const storedUserInfo = localStorage.getItem('userInfo');
        if (storedUserInfo) {
            const parsedInfo = JSON.parse(storedUserInfo);
            setUserInfo(parsedInfo);
            fetchRooms(parsedInfo.token);
        } else {
            navigate('/login');
        }
    }, [navigate]);

    const fetchRooms = async (token) => {
        try {
            const config = { headers: { Authorization: `Bearer ${token}` } };
            const { data } = await axios.get('/api/rooms', config);
            setRooms(data);
        } catch (err) {
            console.error('Не удалось загрузить комнаты', err);
            setError('Не удалось загрузить комнаты');
        }
    };

    const createRoomHandler = async (e) => {
        e.preventDefault();
        if (!roomName || !userInfo) return;
        try {
            const config = { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userInfo.token}` } };
            const { data: newRoom } = await axios.post('/api/rooms', { name: roomName }, config);
            setRooms([newRoom, ...rooms]);
            setRoomName('');
        } catch (err) {
            console.error('Ошибка создания комнаты', err);
            setError(err.response?.data?.message || 'Ошибка создания комнаты');
        }
    };

    const logoutHandler = () => {
        localStorage.removeItem('userInfo');
        navigate('/login');
    };
    
    const handleCopyLink = (roomId) => {
        const inviteLink = `${window.location.origin}/join/${roomId}`;
        navigator.clipboard.writeText(inviteLink).then(() => {
            setCopiedRoomId(roomId);
            setTimeout(() => setCopiedRoomId(null), 2000);
        });
    };

    if (!userInfo) {
        return <div>Загрузка...</div>;
    }

    return (
        <div style={styles.container}>
            <header style={styles.header}>
                <h1>Добро пожаловать, {userInfo.name}!</h1>
                <button onClick={logoutHandler} style={styles.logoutButton}>Выйти</button>
            </header>

            <div style={styles.content}>
                <div style={styles.formContainer}>
                    <h3>Создать новую комнату</h3>
                    <form onSubmit={createRoomHandler}>
                        <input type="text" placeholder="Название комнаты" value={roomName} onChange={(e) => setRoomName(e.target.value)} style={styles.input}/>
                        <button type="submit" style={styles.button}>Создать</button>
                    </form>
                </div>

                <div style={styles.roomsListContainer}>
                    <h3>Ваши комнаты</h3>
                    {error && <p style={{ color: 'red' }}>{error}</p>}
                    {rooms.length === 0 ? (
                        <p>У вас пока нет комнат. Создайте первую!</p>
                    ) : (
                        <ul style={styles.roomsList}>
                            {rooms.map((room) => (
                                <li key={room._id} style={styles.roomItem}>
                                    <Link to={`/room/${room._id}`} style={styles.roomLink}>
                                        {room.name}
                                    </Link>
                                    <button onClick={() => handleCopyLink(room._id)} style={styles.copyButton}>
                                        {copiedRoomId === room._id ? 'Скопировано!' : 'Пригласить'}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    );
};

const styles = {
    container: { maxWidth: '800px', margin: '2rem auto', padding: '1rem' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #ccc', paddingBottom: '1rem' },
    logoutButton: { padding: '0.5rem 1rem', border: 'none', borderRadius: '4px', backgroundColor: '#dc3545', color: 'white', cursor: 'pointer' },
    content: { display: 'flex', gap: '2rem', marginTop: '2rem' },
    formContainer: { flex: 1 },
    roomsListContainer: { flex: 2 },
    input: { width: 'calc(100% - 20px)', padding: '0.5rem', marginBottom: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' },
    button: { width: '100%', padding: '0.5rem', border: 'none', borderRadius: '4px', backgroundColor: '#007bff', color: 'white', cursor: 'pointer' },
    roomsList: { listStyle: 'none', padding: 0 },
    // Исправлен дубликат ключа и добавлены стили
    roomItem: { padding: '1rem', backgroundColor: '#fff', border: '1px solid #ddd', borderRadius: '4px', marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    roomLink: { textDecoration: 'none', color: 'inherit', fontWeight: 'bold' },
    copyButton: { padding: '5px 10px', border: '1px solid #17a2b8', color: '#17a2b8', backgroundColor: 'transparent', borderRadius: '4px', cursor: 'pointer' },
};

export default HomePage;