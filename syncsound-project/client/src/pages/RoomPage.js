import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import io from 'socket.io-client';
import ReactPlayer from 'react-player';
import API from '../services/api';
import Peer from 'simple-peer'; // <-- Убедитесь, что этот импорт есть

let socket;

// Маленький компонент для рендеринга аудиопотоков от других участников
const Audio = (props) => {
    const ref = useRef();

    useEffect(() => {
        props.peer.on("stream", stream => {
            if (ref.current) {
                ref.current.srcObject = stream;
            }
        });
    }, [props.peer]);

    return (
        // playsInline и autoPlay уже есть, добавим muted={false} для явности
        <audio playsInline autoPlay ref={ref} muted={false} />
    );
};

const RoomPage = () => {
    const { id: roomId } = useParams();
    const navigate = useNavigate();
    const playerRef = useRef(null);
    const chatEndRef = useRef(null);

    // --- Существующие состояния ---
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
    
    // --- НОВЫЕ СОСТОЯНИЯ ДЛЯ АУДИОЧАТА ---
    const [peers, setPeers] = useState([]);
    const [userStream, setUserStream] = useState();
    const [isMuted, setIsMuted] = useState(false);
    const peersRef = useRef([]);

    const isHost = userInfo?._id === room?.host;
    
    useEffect(() => {
        const storedUserInfo = localStorage.getItem('userInfo');
        if (!storedUserInfo) { navigate('/login'); return; }
        const parsedInfo = JSON.parse(storedUserInfo);
        setUserInfo(parsedInfo);

        const fetchRoomData = async () => {
            try {
                const config = { headers: { Authorization: `Bearer ${parsedInfo.token}` } };
                const { data } = await API.get(`/api/rooms/${roomId}`, config);
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

        socket = io('https://syncsound-backend.onrender.com');
        
        // --- ЗАПРОС ДОСТУПА К МИКРОФОНУ И ПОДКЛЮЧЕНИЕ ---
        navigator.mediaDevices.getUserMedia({ video: false, audio: true }).then(stream => {
            setUserStream(stream);
            
            socket.emit('joinRoom', { roomId, user: parsedInfo });
            
            socket.on('all users', users => {
                const newPeers = [];
                users.forEach(u => {
                    const peer = createPeer(u.socketId, socket.id, stream, parsedInfo);
                    peersRef.current.push({ peerId: u.socketId, peer });
                    newPeers.push({ peerId: u.socketId, peer, user: u.user });
                });
                setPeers(newPeers);
            });
            
            socket.on('user joined', payload => {
                const peer = addPeer(payload.signal, payload.callerId, stream);
                peersRef.current.push({ peerId: payload.callerId, peer });
                const newPeer = { peerId: payload.callerId, peer, user: payload.user };
                setPeers(users => [...users, newPeer]);
            });

            socket.on('receiving returned signal', payload => {
                const item = peersRef.current.find(p => p.peerId === payload.id);
                item.peer.signal(payload.signal);
            });

            socket.on('user left', id => {
                const peerObj = peersRef.current.find(p => p.peerId === id);
                if(peerObj) {
                    peerObj.peer.destroy();
                }
                const newPeers = peersRef.current.filter(p => p.peerId !== id);
                peersRef.current = newPeers;
                setPeers(newPeers);
            });
        }).catch(err => {
            console.error("Ошибка доступа к микрофону:", err);
            // Если пользователь отказал в доступе, просто подключаемся без аудио
            socket.emit('joinRoom', { roomId, user: parsedInfo });
        });

        // Старые обработчики событий
        socket.on('systemMessage', (message) => { setSystemMessage(message); setTimeout(() => setSystemMessage(''), 3000); });
        socket.on('newMessage', (messageData) => setMessages((prev) => [...prev, messageData]));
        socket.on('queueUpdated', (newQueue) => setQueue(newQueue));
        socket.on('playerStateChanged', ({ isPlaying }) => setIsPlaying(isPlaying));
        socket.on('newTrackPlaying', ({ currentTrack, isPlaying, queue }) => {
            setCurrentTrack(currentTrack);
            setIsPlaying(isPlaying);
            setQueue(queue);
        });

        return () => {
            socket.disconnect();
            if (userStream) {
                userStream.getTracks().forEach(track => track.stop());
            }
        };
    }, [roomId, navigate]);

    // --- ФУНКЦИИ ДЛЯ WEBRTC ---
    // --- НОВАЯ, ИСПРАВЛЕННАЯ ВЕРСИЯ ---
    function createPeer(userToSignal, callerId, stream, user) {
        const peer = new Peer({
            initiator: true,
            trickle: false,
            stream,
            // --- ДОБАВЛЕН ЭТОТ БЛОК ---
            config: {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' },
                    { urls: 'stun:stun2.l.google.com:19302' }, // Добавим еще один для надежности
                ]
            }
            // --- КОНЕЦ ДОБАВЛЕННОГО БЛОКА ---
        });
        
        peer.on("signal", signal => {
            socket.emit("sending signal", { userToSignal, callerId, signal, user });
        });
        return peer;
    }
    function addPeer(incomingSignal, callerId, stream) {
        const peer = new Peer({ 
            initiator: false, 
            trickle: false, 
            stream,
            config: {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' },
                ]
            }
        });
        peer.on("signal", signal => {
            socket.emit("returning signal", { signal, callerId });
        });
        peer.signal(incomingSignal);
        return peer;
    }

    // --- НОВЫЕ ОБРАБОТЧИКИ УПРАВЛЕНИЯ ---
    const handleMute = () => {
        if (userStream) {
            const isNowMuted = !isMuted;
            userStream.getAudioTracks()[0].enabled = !isNowMuted;
            setIsMuted(isNowMuted);
        }
    };
    const handleLeaveRoom = () => { navigate('/'); };

    // --- СТАРЫЕ ОБРАБОТЧИКИ ---
    const addToQueueHandler = (track) => { socket.emit('addTrackToQueue', { roomId, trackData: track, user: userInfo }); };
    const sendMessageHandler = (e) => { e.preventDefault(); if (newMessage.trim() && userInfo) { socket.emit('chatMessage', { roomId, user: userInfo, message: newMessage }); setNewMessage(''); } };
    const searchHandler = async (e) => {
        e.preventDefault();
        if (!searchQuery.trim()) return;
        setIsSearching(true);
        setSearchResults([]);
        try {
            const config = { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userInfo.token}` } };
            const { data } = await API.post('/api/music/search', { query: searchQuery }, config);
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
                    {/* ... существующая разметка плеера, кнопок, очереди и поиска ... */}
                </div>
                <div style={styles.chatSection}>
                    {/* --- НОВЫЙ БЛОК: УЧАСТНИКИ И УПРАВЛЕНИЕ --- */}
                    <div style={styles.voiceControls}>
                        <h4>Участники в аудиочате ({peers.length > 0 ? peers.length + 1 : 1}):</h4>
                        {/* Рендерим аудио-элементы для каждого пира */}
                        {peers.map((p) => <Audio key={p.peerId} peer={p.peer} />)}
                        
                        {userStream ? (
                            <div style={styles.userControls}>
                                <button onClick={handleMute} style={isMuted ? styles.mutedButton : styles.controlButtonMic}>
                                    {isMuted ? 'Вкл. микро' : 'Выкл. микро'}
                                </button>
                                <button onClick={handleLeaveRoom} style={styles.leaveButton}>
                                    Выйти
                                </button>
                            </div>
                        ) : <p style={{color: 'red'}}>Доступ к микрофону не предоставлен.</p>}
                    </div>
                    {/* --- КОНЕЦ НОВОГО БЛОКА --- */}
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
    voiceControls: { marginBottom: '1rem', borderBottom: '1px solid #ddd', paddingBottom: '1rem' },
    userControls: { display: 'flex', gap: '10px', marginTop: '10px' },
    controlButtonMic: { padding: '5px 10px', border: 'none', borderRadius: '4px', cursor: 'pointer', backgroundColor: '#6c757d', color: 'white' },
    mutedButton: { padding: '5px 10px', border: 'none', borderRadius: '4px', cursor: 'pointer', backgroundColor: '#ffc107', color: 'black' },
    leaveButton: { padding: '5px 10px', border: 'none', borderRadius: '4px', cursor: 'pointer', backgroundColor: '#dc3545', color: 'white' },
};

export default RoomPage;
