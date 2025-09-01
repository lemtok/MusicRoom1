import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';
import API from '../services/api';

const RegisterPage = () => {
    // useNavigate - это хук для программного перехода на другие страницы
    const navigate = useNavigate();

    // Создаем "состояния" для каждого поля ввода
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState(null); // Состояние для хранения ошибки

    // Функция, которая будет вызываться при отправке формы
    const submitHandler = async (e) => {
        e.preventDefault(); // Предотвращаем стандартное поведение формы (перезагрузку страницы)
        setError(null); // Сбрасываем предыдущую ошибку

        // Простая проверка на совпадение паролей
        if (password !== confirmPassword) {
            setError('Пароли не совпадают');
            return;
        }

        try {
            // Формируем тело запроса
            const config = {
                headers: {
                    'Content-Type': 'application/json',
                },
            };
            const body = { name, email, password };

            // Отправляем POST-запрос на наш бэкенд.
            // Благодаря "proxy" в package.json, '/api/users/register' превратится в 'http://localhost:5000/api/users/register'
            const { data } = await API.post(
                '/api/users/register',
                body,
                config
            );

            console.log('Пользователь успешно зарегистрирован:', data);

            // TODO: Сохранить информацию о пользователе (например, в localStorage)

            // Перенаправляем пользователя на страницу входа после успешной регистрации
            navigate('/login');

        } catch (err) {
            // Если сервер вернул ошибку, она будет в err.response.data.message
            setError(err.response?.data?.message || 'Произошла ошибка при регистрации');
            console.error('Ошибка регистрации:', err.response);
        }
    };

    return (
        <div style={styles.container}>
            <form onSubmit={submitHandler} style={styles.form}>
                <h2>Регистрация</h2>
                {error && <p style={styles.error}>{error}</p>}
                <div style={styles.formGroup}>
                    <label htmlFor="name">Имя</label>
                    <input
                        type="text"
                        id="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        style={styles.input}
                    />
                </div>
                <div style={styles.formGroup}>
                    <label htmlFor="email">Email</label>
                    <input
                        type="email"
                        id="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        style={styles.input}
                    />
                </div>
                <div style={styles.formGroup}>
                    <label htmlFor="password">Пароль</label>
                    <input
                        type="password"
                        id="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        style={styles.input}
                    />
                </div>
                <div style={styles.formGroup}>
                    <label htmlFor="confirmPassword">Подтвердите пароль</label>
                    <input
                        type="password"
                        id="confirmPassword"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        style={styles.input}
                    />
                </div>
                <button type="submit" style={styles.button}>
                    Зарегистрироваться
                </button>
                <p style={{ textAlign: 'center', marginTop: '1rem' }}>
                    Уже есть аккаунт? <Link to="/login">Войти</Link>
                </p>
            </form>
        </div>
    );
};

// Добавим немного стилей прямо в файле для простоты
const styles = {
    container: {
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
    },
    form: {
        padding: '2rem',
        boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
        borderRadius: '8px',
        backgroundColor: '#fff',
        width: '350px',
    },
    formGroup: {
        marginBottom: '1rem',
        display: 'flex',
        flexDirection: 'column',
    },
    input: {
        padding: '0.5rem',
        marginTop: '0.25rem',
        borderRadius: '4px',
        border: '1px solid #ccc',
    },
    button: {
        width: '100%',
        padding: '0.75rem',
        border: 'none',
        borderRadius: '4px',
        backgroundColor: '#007bff',
        color: 'white',
        fontSize: '1rem',
        cursor: 'pointer',
    },
    error: {
        color: 'red',
        marginBottom: '1rem',
        textAlign: 'center',
    }
};

export default RegisterPage;