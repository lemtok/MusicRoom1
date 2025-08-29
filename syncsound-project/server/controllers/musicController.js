const play = require('play-dl');

const searchTracks = async (req, res) => {
    const { query } = req.body;
    if (!query) {
        return res.status(400).send('Поисковый запрос не может быть пустым');
    }
    try {
        const searchResults = await play.search(query, { limit: 10, source: { youtube: 'video' } });
        const tracks = searchResults.map(video => ({
            id: video.id,
            title: video.title,
            artwork_url: video.thumbnails[0]?.url || 'https://via.placeholder.com/40',
            duration: video.durationInSec * 1000,
            // Важно: мы сохраняем полную ссылку для ReactPlayer
            permalink_url: video.url, 
            user: { username: video.channel?.name || 'Unknown Artist' },
        }));
        res.json(tracks);
    } catch (error) {
        console.error('Ошибка при поиске на YouTube:', error);
        res.status(500).send('Не удалось выполнить поиск на YouTube');
    }
};

module.exports = {
    searchTracks,
};