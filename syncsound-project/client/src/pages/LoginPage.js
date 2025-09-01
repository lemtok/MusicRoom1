import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';

const LoginPage = () => {
    const navigate = useNavigate();

    // Состояния для полей ввода и ошибок
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState(null);

    const submitHandler = async (e) => {
        e.preventDefault();
        setError(null);

        try {
            const config = {
                headers: {
                    'Content-Type': 'application/json',
                },
            };

            // Отправляем запрос на эндпоинт для логина
            const { data } = await API.post(
                '/api/users/login',
                { email, password },
                config
            );

            console.log('Пользователь успешно вошел:', data);

            // --- КЛЮЧЕВОЙ МОМЕНТ ---
            // Сохраняем информацию о пользователе в localStorage.
            // localStorage - это небольшое хранилище в браузере,
            // данные в котором сохраняются даже после закрытия вкладки.
            // Мы преобразуем объект в строку, так как хранилище работает только со строками.
            localStorage.setItem('userInfo', JSON.stringify(data));

            // Перенаправляем пользователя на главную страницу
            const redirectPath = localStorage.getItem('redirectPath');
            if (redirectPath) {
                localStorage.removeItem('redirectPath'); // Очищаем, чтобы не сработал снова
                navigate(redirectPath); // Отправляем пользователя по ссылке-приглашению
            } else {
                navigate('/'); // Стандартное поведение - на главную
            }


        } catch (err) {
            setError(err.response?.data?.message || 'Произошла ошибка при входе');
            console.error('Ошибка входа:', err.response);
        }
    };

    return (
        <div style={styles.container}>
            <form onSubmit={submitHandler} style={styles.form}>
                <h2>Вход</h2>
                {error && <p style={styles.error}>{error}</p>}
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
                <button type="submit" style={styles.button}>
                    Войти
                </button>
                <p style={{ textAlign: 'center', marginTop: '1rem' }}>
                    Нет аккаунта? <Link to="/register">Зарегистрироваться</Link>
                </p>
            </form>
        </div>
    );
};

// Используем те же стили, что и на странице регистрации
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

export default LoginPage;