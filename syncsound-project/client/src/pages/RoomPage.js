import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import io from 'socket.io-client';
import ReactPlayer from 'react-player';

let socket;

const RoomPage = () => {
    const { id: roomId } = useParams();
    const navigate = useNavigate();
    const playerRef = useRef(null);
    const chatEndRef = useRef(null);

    const [userInfo, setUserInfo] = useState(null);
    const [room, setRoom] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [systemMessage, setSystemMessage] = useState('');
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [queue, setQueue] = useState([]);
    const [currentTrack, setCurrentTrack] = useState(null);
    const [isPlaying, setIsPlaying] = useState(false);
    
    const isHost = userInfo?._id === room?.host;
    
    const scrollToBottom = () => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); };
    useEffect(scrollToBottom, [messages]);

    useEffect(() => {
        const storedUserInfo = localStorage.getItem('userInfo');
        if (!storedUserInfo) { navigate('/login'); return; }
        const parsedInfo = JSON.parse(storedUserInfo);
        setUserInfo(parsedInfo);

        const fetchRoomData = async () => {
            try {
                const config = { headers: { Authorization: `Bearer ${parsedInfo.token}` } };
                const { data } = await axios.get(`/api/rooms/${roomId}`, config);
                setRoom(data);
                setQueue(data.queue || []);
                setCurrentTrack(data.currentTrack || null);
                setIsPlaying(data.isPlaying || false);
            } catch (err) {
                console.error(err);
                setError(err.response?.data?.message || 'Не удалось загрузить данные комнаты');
            } finally { setLoading(false); }
        };
        fetchRoomData();

        socket = io('http://localhost:5000');
        socket.emit('joinRoom', { roomId, user: parsedInfo });
        
        socket.on('userJoined', (message) => { setSystemMessage(message); setTimeout(() => setSystemMessage(''), 3000); });
        socket.on('newMessage', (messageData) => setMessages((prev) => [...prev, messageData]));
        socket.on('queueUpdated', (newQueue) => setQueue(newQueue));
        socket.on('playerStateChanged', ({ isPlaying }) => setIsPlaying(isPlaying));
        socket.on('newTrackPlaying', ({ currentTrack, isPlaying, queue }) => {
            setCurrentTrack(currentTrack);
            setIsPlaying(isPlaying);
            setQueue(queue);
        });

        return () => socket.disconnect();
    }, [roomId, navigate]);

    const addToQueueHandler = (track) => { socket.emit('addTrackToQueue', { roomId, trackData: track, user: userInfo }); };
    const sendMessageHandler = (e) => { e.preventDefault(); if (newMessage.trim() && userInfo) { socket.emit('chatMessage', { roomId, user: userInfo, message: newMessage }); setNewMessage(''); } };
    const searchHandler = async (e) => {
        e.preventDefault();
        if (!searchQuery.trim()) return;
        setIsSearching(true);
        setSearchResults([]);
        try {
            const config = { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userInfo.token}` } };
            const { data } = await axios.post('/api/music/search', { query: searchQuery }, config);
            setSearchResults(data);
        } catch (err) { console.error('Ошибка поиска', err); } 
        finally { setIsSearching(false); }
    };
    
    const handleNextTrack = () => { if (isHost) { socket.emit('playNextTrack', { roomId }); } };
    const handleTogglePlay = () => { if (isHost && currentTrack) { socket.emit('togglePlay', { roomId, isPlaying: !isPlaying }); } };
    
    const handleNativePlay = () => { if (isHost && !isPlaying) { socket.emit('togglePlay', { roomId, isPlaying: true }); } };
    const handleNativePause = () => { if (isHost && isPlaying) { socket.emit('togglePlay', { roomId, isPlaying: false }); } };
    
    if (loading) return <div>Загрузка...</div>;
    if (error) return <div style={{color: 'red', padding: '2rem'}}>{error}</div>;

    return (
        <div style={styles.container}>
            <h2>Комната: {room?.name}</h2>
            {systemMessage && <div style={styles.systemMessage}>{systemMessage}</div>}
            <div style={styles.mainContent}>
                <div style={styles.playerSection}>
                    <div style={styles.playerArea}>
                        <div style={styles.playerWrapper}>
                            {currentTrack ? (
                                <ReactPlayer 
                                    ref={playerRef} 
                                    url={currentTrack.permalink_url} 
                                    playing={isPlaying} 
                                    controls={true} 
                                    width="100%" 
                                    height="100%" 
                                    style={styles.reactPlayer} 
                                    onEnded={handleNextTrack} 
                                    volume={0.8} 
                                    onError={(e) => console.error('ReactPlayer Error', e)}
                                    onPlay={handleNativePlay}
                                    onPause={handleNativePause}
                                />
                            ) : ( <div style={styles.noTrack}><span>Очередь пуста</span></div> )}
                        </div>
                    </div>
                    {isHost && (
                        <div style={styles.controls}>
                            <button onClick={handleTogglePlay} disabled={!currentTrack} style={styles.controlButton}>
                                {isPlaying ? 'Синхронизировать Паузу' : 'Синхронизировать Play'}
                            </button>
                            <button onClick={handleNextTrack} disabled={queue.length === 0} style={styles.controlButton}>
                                Следующий трек
                            </button>
                        </div>
                    )}
                    <div style={styles.queueContainer}>
                        <h3>Очередь</h3>
                        <div style={styles.queueList}>
                            {queue.length > 0 ? (queue.map((track, index) => (<div key={`${track.id}-${index}`} style={styles.trackItem}>
                                <span style={styles.queueIndex}>{index + 1}.</span>
                                <img src={track.artwork_url} alt={track.title} style={styles.trackArt}/>
                                <div style={styles.trackInfo}><strong>{track.title}</strong><span>Добавил: {track.addedBy.name}</span></div>
                            </div>))) : (<p>Очередь пуста.</p>)}
                        </div>
                    </div>
                    <div style={styles.searchContainer}>
                        <form onSubmit={searchHandler}>
                            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Название трека или исполнитель..." style={styles.searchInput}/>
                            <button type="submit" disabled={isSearching} style={styles.searchButton}>{isSearching ? 'Поиск...' : 'Найти'}</button>
                        </form>
                        <div style={styles.searchResults}>
                            {searchResults.map(track => (
                                <div key={track.id} style={styles.trackItem}>
                                    <img src={track.artwork_url} alt={track.title} style={styles.trackArt}/>
                                    <div style={styles.trackInfo}><strong>{track.title}</strong><span>{track.user.username}</span></div>
                                    <button onClick={() => addToQueueHandler(track)} style={styles.addButton}>+</button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                <div style={styles.chatSection}>
                    <h3>Чат</h3>
                    <div style={styles.chatBox}>
                        {messages.map((msg, index) => (<div key={index} style={styles.message}>
                            <strong style={{ color: msg.user._id === userInfo?._id ? '#007bff' : '#28a745' }}>{msg.user.name}:</strong>{' '}{msg.message}
                        </div>))}
                        <div ref={chatEndRef} />
                    </div>
                    <form onSubmit={sendMessageHandler}>
                        <input type="text" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="Введите сообщение..." style={styles.chatInput}/>
                        <button type="submit" style={styles.chatButton}>Отправить</button>
                    </form>
                </div>
            </div>
        </div>
    );
};

const styles = {
    container: { padding: '2rem', height: 'calc(100vh - 4rem)', boxSizing: 'border-box', fontFamily: 'sans-serif' },
    mainContent: { display: 'flex', gap: '2rem', marginTop: '1rem', height: 'calc(100% - 50px)' },
    playerSection: { flex: 3, backgroundColor: '#f8f9fa', padding: '1rem', borderRadius: '8px', display: 'flex', flexDirection: 'column', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', overflow: 'hidden' },
    chatSection: { flex: 2, display: 'flex', flexDirection: 'column', backgroundColor: '#f8f9fa', padding: '1rem', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' },
    playerArea: { flexShrink: 0 },
    playerWrapper: { position: 'relative', height: '270px', backgroundColor: '#000', borderRadius: '8px', overflow: 'hidden' },
    reactPlayer: { position: 'absolute', top: 0, left: 0 },
    noTrack: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', border: '2px dashed #ccc', borderRadius: '8px', color: '#6c757d', padding: '1rem', textAlign: 'center' },
    controls: { display: 'flex', justifyContent: 'center', gap: '1rem', margin: '1rem 0', flexShrink: 0 },
    controlButton: { padding: '0.5rem 1.5rem', border: 'none', borderRadius: '20px', cursor: 'pointer', backgroundColor: '#007bff', color: 'white', fontWeight: 'bold' },
    queueContainer: { flexGrow: 1, display: 'flex', flexDirection: 'column', minHeight: 0, borderTop: '1px solid #ddd', paddingTop: '1rem', marginTop: '1rem' },
    queueList: { flexGrow: 1, overflowY: 'auto', paddingRight: '10px' },
    queueIndex: { marginRight: '10px', color: '#6c757d', fontWeight: 'bold' },
    searchContainer: { flexShrink: 0, borderTop: '1px solid #ddd', paddingTop: '1rem', marginTop: 'auto' },
    searchInput: { width: 'calc(70% - 2px)', padding: '0.75rem', border: '1px solid #ccc', borderRadius: '4px 0 0 4px', boxSizing: 'border-box' },
    searchButton: { width: '30%', padding: '0.75rem', border: 'none', backgroundColor: '#28a745', color: 'white', cursor: 'pointer', borderRadius: '0 4px 4px 0', boxSizing: 'border-box' },
    searchResults: { marginTop: '1rem', maxHeight: '150px', overflowY: 'auto', paddingRight: '10px' },
    trackItem: { display: 'flex', alignItems: 'center', marginBottom: '0.5rem', padding: '0.5rem', backgroundColor: '#fff', borderRadius: '4px' },
    trackArt: { width: '40px', height: '40px', marginRight: '10px', borderRadius: '4px', objectFit: 'cover', flexShrink: 0 },
    trackInfo: { flexGrow: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', whiteSpace: 'nowrap' },
    'trackInfo > strong': { textOverflow: 'ellipsis', overflow: 'hidden' },
    addButton: { padding: '5px 10px', cursor: 'pointer', border: '1px solid #007bff', backgroundColor: 'transparent', color: '#007bff', borderRadius: '4px' },
    chatBox: { flexGrow: 1, overflowY: 'auto', border: '1px solid #ddd', padding: '10px', marginBottom: '10px', backgroundColor: '#fff', borderRadius: '4px' },
    message: { marginBottom: '5px', wordBreak: 'break-word' },
    chatForm: { display: 'flex' },
    chatInput: { flexGrow: 1, padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px 0 0 4px' },
    chatButton: { padding: '0.5rem 1rem', border: 'none', backgroundColor: '#007bff', color: 'white', cursor: 'pointer', borderRadius: '0 4px 4px 0' },
    systemMessage: { position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)', backgroundColor: '#28a745', color: 'white', padding: '10px 20px', borderRadius: '5px', zIndex: 1000, boxShadow: '0 2px 10px rgba(0,0,0,0.2)' },
};

export default RoomPage;
