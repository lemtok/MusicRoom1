const mongoose = require('mongoose');

const roomSchema = mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
        },
        host: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            ref: 'User',
        },
        participants: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User',
            },
        ],
        // +++ НОВОЕ ПОЛЕ +++
        // Очередь будет массивом объектов, структура которых
        // соответствует тому, что мы получаем от YouTube API
        queue: [
            {
                id: String,
                title: String,
                artwork_url: String,
                duration: Number,
                permalink_url: String,
                user: {
                    username: String,
                },
                // Добавим поле, чтобы знать, кто добавил трек
                addedBy: {
                    name: String,
                    _id: mongoose.Schema.Types.ObjectId,
                }
            }
        ],
        currentTrack: {
            id: String,
            title: String,
            artwork_url: String,
            duration: Number,
            permalink_url: String,
            user: { username: String },
            addedBy: { name: String, _id: mongoose.Schema.Types.ObjectId }
        },
        // Состояние плеера
        isPlaying: {
            type: Boolean,
            default: false,
        },
        // Время (по серверу), когда трек начал играть. 
        // Нужно для синхронизации при подключении новых пользователей.
        playbackPosition: {
            type: Number,
            default: 0
        },
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model('Room', roomSchema);