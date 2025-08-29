const mongoose = require('mongoose');

const playlistSchema = mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
        },
        // Ссылка на создателя плейлиста
        owner: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            ref: 'User',
        },
        // Массив с треками (пока просто строки, потом усложним)
        tracks: [
            {
                trackId: String, // ID трека из SoundCloud
                title: String,
                artist: String,
            },
        ],
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model('Playlist', playlistSchema);