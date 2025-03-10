// Middleware para verificar si el usuario está autenticado
const authenticateUser = (req, res, next) => {
    if (req.session && req.session.user) {
        // Si hay una sesión de usuario, continúa con la siguiente middleware/ruta
        return next();
    } else {
        // Si no hay una sesión de usuario, redirige a la página de inicio de sesión
        res.redirect('/login.html'); // Cambia la ruta según tu estructura de archivos
    }
};

module.exports = { authenticateUser };