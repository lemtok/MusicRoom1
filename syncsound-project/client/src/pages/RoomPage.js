import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import ReactPlayer from 'react-player';
import API from '../services/api';
import Peer from 'simple-peer';

// Компонент для отображения участника
const ParticipantView = ({ peer, stream: localStream, user, isMuted, isCurrentUser = false }) => {
    const audioRef = useRef();
    const [audioLevel, setAudioLevel] = useState(0);

    useEffect(() => {
        const setupVisualizer = (stream) => {
            if (isMuted && localStream) { setAudioLevel(0); return; }
            try {
                const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                const source = audioContext.createMediaStreamSource(stream);
                const analyser = audioContext.createAnalyser();
                analyser.fftSize = 256;
                const bufferLength = analyser.frequencyBinCount;
                const dataArray = new Uint8Array(bufferLength);
                source.connect(analyser);
                let animationFrameId;
                const getAudioLevel = () => {
                    analyser.getByteFrequencyData(dataArray);
                    let sum = dataArray.reduce((a, b) => a + b, 0);
                    let avg = (sum / bufferLength) || 0;
                    setAudioLevel(avg);
                    animationFrameId = requestAnimationFrame(getAudioLevel);
                };
                getAudioLevel();
                return () => {
                    cancelAnimationFrame(animationFrameId);
                    source.disconnect();
                    analyser.disconnect();
                    audioContext.close().catch(e => {});
                };
            } catch (e) { console.error('AudioContext Error:', e); }
        };

        if (peer && !isCurrentUser) {
            // Только для удаленных участников - проигрываем аудио и показываем визуализацию
            const handleStream = remoteStream => {
                if (audioRef.current) { 
                    audioRef.current.srcObject = remoteStream; 
                    audioRef.current.play().catch(e => {
                        console.log('Auto-play prevented, user interaction required');
                    }); 
                }
                setupVisualizer(remoteStream);
            };
            if (peer.streams[0]) { 
                handleStream(peer.streams[0]); 
            } else { 
                peer.on("stream", handleStream); 
            }
            return () => { peer.off("stream", handleStream); }
        } else if (localStream && isCurrentUser) {
            // Только для текущего пользователя - показываем визуализацию, но НЕ проигрываем аудио
            const cleanup = setupVisualizer(localStream);
            return cleanup;
        }
    }, [peer, localStream, user, isMuted, isCurrentUser]);

    const audioLevelStyle = { 
        ...styles.audioLevel, 
        width: `${Math.min(100, audioLevel * 2)}%`, 
        backgroundColor: (isMuted && localStream) ? '#6c757d' : '#28a745' 
    };

    return (
        <div style={styles.participant}>
            {/* Аудио элемент ТОЛЬКО для удаленных участников */}
            {peer && !isCurrentUser && <audio playsInline autoPlay ref={audioRef} />}
            <div style={styles.audioVisualizer}>
                <div style={audioLevelStyle}></div>
            </div>
            <span>{user?.name || 'Гость'} {isCurrentUser ? '(Вы)' : ''}</span>
        </div>
    );
};

const RoomPage = () => {
    const { id: roomId } = useParams();
    const navigate = useNavigate();
    const playerRef = useRef(null);
    const chatEndRef = useRef(null);
    const peersRef = useRef([]);
    const socketRef = useRef();
    const userStreamRef = useRef();

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
    const [peers, setPeers] = useState([]);
    const [isMuted, setIsMuted] = useState(false);
    
    const isHost = userInfo?._id === room?.host;
    
    // Создание peer для исходящих соединений (когда мы инициируем)
    function createPeer(userToSignal, callerId, stream, user) {
        const peer = new Peer({
            initiator: true,
            trickle: false,
            stream: stream,
            config: { 
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' }, 
                    { urls: 'stun:stun1.l.google.com:19302' }
                ] 
            }
        });
        
        peer.on("signal", signal => {
            socketRef.current.emit("sending signal", { userToSignal, callerId, signal, user });
        });
        
        return peer;
    }

    // Создание peer для входящих соединений (когда к нам подключаются)
    function addPeer(incomingSignal, callerId, stream, user) {
        const peer = new Peer({
            initiator: false,
            trickle: false,
            stream: stream,
            config: { 
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' }, 
                    { urls: 'stun:stun1.l.google.com:19302' }
                ] 
            }
        });
        
        peer.on("signal", signal => {
            socketRef.current.emit("returning signal", { signal, callerId });
        });
        
        peer.signal(incomingSignal);
        return peer;
    }

    useEffect(() => {
        const storedUserInfo = localStorage.getItem('userInfo');
        if (!storedUserInfo) { navigate('/login'); return; }
        const parsedInfo = JSON.parse(storedUserInfo);
        setUserInfo(parsedInfo);

        const socket = io('https://syncsound-backend.onrender.com');
        socketRef.current = socket;

        const setupRoom = async () => {
            try {
                const config = { headers: { Authorization: `Bearer ${parsedInfo.token}` } };
                const { data } = await API.get(`/api/rooms/${roomId}`, config);
                setRoom(data);
                setQueue(data.queue || []);
                setCurrentTrack(data.currentTrack || null);
                setIsPlaying(data.isPlaying || false);

                // Получаем медиа-поток с микрофона
                const stream = await navigator.mediaDevices.getUserMedia({ 
                    video: false, 
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true
                    }
                });
                userStreamRef.current = stream;
                setLoading(false);
                
                // Присоединяемся к комнате
                socket.emit('joinRoom', { roomId, user: parsedInfo });

                // Обработчик для получения списка уже подключенных пользователей
                socket.on('all users', users => {
                    const newPeers = [];
                    users.forEach(userInRoom => {
                        // Не создаем соединение с самим собой
                        if (userInRoom.socketId !== socket.id) {
                            const peer = createPeer(userInRoom.socketId, socket.id, stream, parsedInfo);
                            peersRef.current.push({ peerId: userInRoom.socketId, peer });
                            newPeers.push({ 
                                peerId: userInRoom.socketId, 
                                peer, 
                                user: userInRoom.user 
                            });
                        }
                    });
                    setPeers(newPeers);
                });

                // Обработчик для нового пользователя, который к нам подключается
                socket.on('user joined', payload => {
                    // Не создаем соединение с самим собой
                    if (payload.callerId === socket.id) return;
                    
                    // Проверяем, нет ли уже соединения с этим пользователем
                    if (peersRef.current.find(p => p.peerId === payload.callerId)) {
                        return;
                    }
                    
                    const peer = addPeer(payload.signal, payload.callerId, stream, payload.user);
                    peersRef.current.push({ peerId: payload.callerId, peer });
                    setPeers(currentPeers => [...currentPeers, { 
                        peerId: payload.callerId, 
                        peer, 
                        user: payload.user 
                    }]);
                });

                // Обработчик для получения ответного сигнала
                socket.on('receiving returned signal', payload => {
                    const item = peersRef.current.find(p => p.peerId === payload.id);
                    if (item) {
                        item.peer.signal(payload.signal);
                    }
                });

                // Обработчик отключения пользователя
                socket.on('user left', id => {
                    const peerObj = peersRef.current.find(p => p.peerId === id);
                    if (peerObj) {
                        peerObj.peer.destroy();
                    }
                    const newPeers = peersRef.current.filter(p => p.peerId !== id);
                    peersRef.current = newPeers;
                    setPeers(newPeers);
                });

            } catch (err) {
                console.error("Ошибка инициализации комнаты:", err);
                setError("Не удалось войти в комнату или получить доступ к микрофону. Проверьте разрешения и обновите страницу.");
                setLoading(false);
            }
        };

        setupRoom();
        
        // Обработчики чата и плеера
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
            if (userStreamRef.current) {
                userStreamRef.current.getTracks().forEach(track => track.stop());
            }
        };
    }, [roomId, navigate]);

    const handleMute = () => {
        if (userStreamRef.current) {
            const isNowMuted = !isMuted;
            userStreamRef.current.getAudioTracks()[0].enabled = !isNowMuted;
            setIsMuted(isNowMuted);
        }
    };

    const handleLeaveRoom = () => { navigate('/'); };
    const addToQueueHandler = (track) => { socketRef.current.emit('addTrackToQueue', { roomId, trackData: track, user: userInfo }); };
    const sendMessageHandler = (e) => { e.preventDefault(); if (newMessage.trim() && userInfo) { socketRef.current.emit('chatMessage', { roomId, user: userInfo, message: newMessage }); setNewMessage(''); } };
    
    const searchHandler = async (e) => {
        e.preventDefault();
        if (!searchQuery.trim()) return;
        setIsSearching(true);
        setSearchResults([]);
        try {
            const config = { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userInfo.token}` } };
            const { data } = await API.post('/api/music/search', { query: searchQuery }, config);
            setSearchResults(data);
        } catch (err) { 
            console.error('Ошибка поиска', err); 
        } finally { 
            setIsSearching(false); 
        }
    };
    
    const handleNextTrack = () => { if (isHost) { socketRef.current.emit('playNextTrack', { roomId }); } };
    const handleTogglePlay = () => { if (isHost && currentTrack) { socketRef.current.emit('togglePlay', { roomId, isPlaying: !isPlaying }); } };
    const handleNativePlay = () => { if (isHost && !isPlaying) { socketRef.current.emit('togglePlay', { roomId, isPlaying: true }); } };
    const handleNativePause = () => { if (isHost && isPlaying) { socketRef.current.emit('togglePlay', { roomId, isPlaying: false }); } };
    
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
                            ) : ( 
                                <div style={styles.noTrack}>
                                    <span>Очередь пуста</span>
                                </div> 
                            )}
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
                            {queue.length > 0 ? (
                                queue.map((track, index) => (
                                    <div key={`${track.id}-${index}`} style={styles.trackItem}>
                                        <span style={styles.queueIndex}>{index + 1}.</span>
                                        <img src={track.artwork_url} alt={track.title} style={styles.trackArt}/>
                                        <div style={styles.trackInfo}>
                                            <strong>{track.title}</strong>
                                            <span>Добавил: {track.addedBy.name}</span>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <p>Очередь пуста.</p>
                            )}
                        </div>
                    </div>
                    <div style={styles.searchContainer}>
                        <form onSubmit={searchHandler}>
                            <input 
                                type="text" 
                                value={searchQuery} 
                                onChange={(e) => setSearchQuery(e.target.value)} 
                                placeholder="Название трека или исполнитель..." 
                                style={styles.searchInput}
                            />
                            <button type="submit" disabled={isSearching} style={styles.searchButton}>
                                {isSearching ? 'Поиск...' : 'Найти'}
                            </button>
                        </form>
                        <div style={styles.searchResults}>
                            {searchResults.map(track => (
                                <div key={track.id} style={styles.trackItem}>
                                    <img src={track.artwork_url} alt={track.title} style={styles.trackArt}/>
                                    <div style={styles.trackInfo}>
                                        <strong>{track.title}</strong>
                                        <span>{track.user.username}</span>
                                    </div>
                                    <button onClick={() => addToQueueHandler(track)} style={styles.addButton}>
                                        +
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                <div style={styles.chatSection}>
                    <div style={styles.voiceControls}>
                        <h4>Участники в аудиочате:</h4>
                        
                        {/* Показываем себя */}
                        {userStreamRef.current && (
                            <ParticipantView 
                                user={userInfo} 
                                stream={userStreamRef.current} 
                                isMuted={isMuted}
                                isCurrentUser={true}
                            />
                        )}

                        {/* Показываем удаленных участников */}
                        {peers.map((p) => (
                            <ParticipantView 
                                key={p.peerId} 
                                peer={p.peer} 
                                user={p.user}
                                isCurrentUser={false}
                            />
                        ))}
                        
                        {userStreamRef.current ? (
                            <div style={styles.userControls}>
                                <button onClick={handleMute} style={isMuted ? styles.mutedButton : styles.controlButtonMic}>
                                    {isMuted ? 'Вкл. микро' : 'Выкл. микро'}
                                </button>
                                <button onClick={handleLeaveRoom} style={styles.leaveButton}>
                                    Выйти
                                </button>
                            </div>
                        ) : (
                            <p style={{color: 'red'}}>Доступ к микрофону не предоставлен.</p>
                        )}
                    </div>
                    <h3>Чат</h3>
                    <div style={styles.chatBox}>
                        {messages.map((msg, index) => (
                            <div key={index} style={styles.message}>
                                <strong style={{ color: msg.user._id === userInfo?._id ? '#007bff' : '#28a745' }}>
                                    {msg.user.name}:
                                </strong>
                                {' '}{msg.message}
                            </div>
                        ))}
                        <div ref={chatEndRef} />
                    </div>
                    <form onSubmit={sendMessageHandler}>
                        <input 
                            type="text" 
                            value={newMessage} 
                            onChange={(e) => setNewMessage(e.target.value)} 
                            placeholder="Введите сообщение..." 
                            style={styles.chatInput}
                        />
                        <button type="submit" style={styles.chatButton}>
                            Отправить
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

// Стили остаются без изменений
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
    participant: { display: 'flex', alignItems: 'center', marginBottom: '5px' },
    audioVisualizer: { width: '100px', height: '20px', border: '1px solid #ccc', marginRight: '10px', backgroundColor: '#e9ecef' },
    audioLevel: { height: '100%', backgroundColor: '#28a745', transition: 'width 0.1s ease-in-out' },
};

export default RoomPage;