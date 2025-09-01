import axios from 'axios';

// Укажите здесь URL вашего бэкенда, который вы получили от Render
const API_URL = 'https://syncsound-backend.onrender.com'; 

const API = axios.create({
    baseURL: API_URL
});

export default API;