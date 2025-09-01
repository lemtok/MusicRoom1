import axios from 'axios';
const API = axios.create({ baseURL: 'https://syncsound-backend.onrender.com' }); // <-- ВАШ URL С RENDER
export default API;