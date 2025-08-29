// Этот middleware будет перехватывать ошибки
const errorHandler = (err, req, res, next) => {
    // Если код статуса был 200 (OK), но произошла ошибка, установим 500 (Server Error)
    const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
    res.status(statusCode);

    // Отправляем JSON с сообщением об ошибке
    res.json({
        message: err.message,
        // В режиме разработки также отправляем стек ошибки для отладки
        stack: process.env.NODE_ENV === 'production' ? null : err.stack,
    });
};

module.exports = { errorHandler };