// IMPORTACIÓN DE BIBLIOTECAS
const express = require('express');  //Para la creación de aplicaciones web
const multer = require('multer'); // Manejo de Archivos subidos
const path = require('path'); // Para manejar rutas de archivos y directorios
const ffmpeg = require('fluent-ffmpeg'); // Para trabajar en archivos multimedia
const bodyParser = require('body-parser'); // Para manejar el cuerpo de las solicitudes HTTP
const cors = require("cors"); // Para permitir solicitudes desde diferentes dominios
const mysql = require("mysql2"); // Permite la conexion entre servidor y base de datos 
const session = require('express-session');// Para manejar sesiones de usuario
const bcrypt = require('bcrypt'); // Para hashing de contraseñas
const { authenticateUser } = require('./middleware/auth'); // Para autenticación de usuarios
const {  exec, execFile  } = require('child_process'); // Importa datos para ejecutar comandos de shell
const fs = require('fs');

// CONFIGURACIÓN DE LA APLICACIÓN
const app = express(); // Crea una instancia de Express
const port = process.env.PORT || 5001; // Se define el puerto en el que correrá la aplicación
ffmpeg.setFfmpegPath(require('@ffmpeg-installer/ffmpeg').path); // Configura el camino de FFmpeg

// MIDDLEWARE
app.use(express.static(path.join(__dirname, '../public'))); //Hace publica la carpeta 
app.use(bodyParser.json());  // Middleware para parsear cuerpos de solicitudes en formato JSON
app.use(bodyParser.urlencoded({ extended: true })); // Middleware para parsear cuerpos de solicitudes con datos codificados en URL
app.use(cors()); // Middleware para permitir solicitudes desde diferentes dominios

// CONFIGURACIÓN DE SESIONES
app.use(session({
  secret: 'tu_secreto_aqui', // Cambia esto a una cadena de texto segura
  resave: false,
  saveUninitialized: true,
  cookie: { 
    secure: false,
    httpOnly: true,
    maxAge: 1000 * 60 * 15    // 15 minutos de inactividad permitida
  }
}));

// CONFIGURACIÓN DE MULTER
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
      const uploadPath = path.join(__dirname, '..', 'public', 'uploads');
      cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
      // Reemplaza espacios y caracteres especiales
      const cleanName = file.originalname
          .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Eliminar acentos
          .replace(/ /g, '_')                              // Espacios por guiones bajos
          .replace(/[^\w.-]/g, '');                        // Eliminar caracteres extraños
      cb(null, cleanName);
  }
});


const upload = multer({ storage: storage });
app.use('/uploads', express.static(path.join(__dirname, '..', 'public', 'uploads')));

// CONFIGURACIÓN DE LA CONEXIÓN A LA BASE DE DATOS MySQL
const pool = mysql.createPool({
  host: 'localhost', 
  user: 'root', 
  password: 'contraseña',
  database: 'resident2',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});
// Verificar conexión a la base de datos
pool.getConnection((err, connection) => {
  if (err) {
    console.error("No se pudo conectar a la base de datos:", err);
    return;
  }
  console.log("Conectado exitosamente a la base de datos");
  connection.release(); // liberar la conexión
});

//RUTAS PARA AUTENTICACIÓN
const rateLimit = require('express-rate-limit');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // Máximo de 5 intentos por IP
  message: "Demasiados intentos de inicio de sesión. Intente más tarde."
});

app.post('/login', loginLimiter, async (req, res) => {
  const { correo, contraseña } = req.body;
  console.log("📩 Correo recibido:", correo);





  const query = "SELECT * FROM usuarios WHERE correo = ?";
  pool.query(query, [correo], async (err, results) => {
      if (err) {console.error("❌ Error en la consulta SQL:", err);
        return res.status(500).json({ error: "Error en el servidor" });
  }
      if (results.length === 0) {
          return res.status(401).json({ error: "Correo o contraseña incorrectos" });
      
        }

      const usuario = results[0];
      console.log("👤 Usuario encontrado:", usuario);


      // Verifica la contraseña
      const match = await bcrypt.compare(contraseña, usuario.contraseña);
      if (!match) {
          return res.status(401).json({ error: "Correo o contraseña incorrectos" });
      }

      // Guarda el usuario en la sesión
      req.session.user = usuario;
      console.log('✅ Usuario guardado en sesión:', req.session.user); // 🛠 LOG


     // Verificar si el usuario tiene un perfil creado
      const perfilQuery = "SELECT id FROM historial_clinico WHERE usuario_id = ?";
      pool.query(perfilQuery, [usuario.id], (err, perfilResults) => {
          if (err) {console.error("❌ Error al verificar perfil:", err);
            return res.status(500).json({ error: "Error en el servidor al verificar el perfil" });
      
        }

        console.log("📝 Resultado de perfil:", perfilResults);

          if (usuario.codigo === 'CC2025') {
              if (perfilResults.length > 0) {
                  // Si tiene perfil, redirige a mi-perfil.html/:id
                  const perfilId = perfilResults[0].id;
                  console.log("➡️ Redirigiendo a:", `/mi-perfil/${perfilId}`);
                  res.json({ success: true, redirectUrl: `/mi-perfil/${perfilId}` });
              } else {
                  // Si no tiene perfil, redirige a pacientes-inicio.html
                  console.log("➡️ Redirigiendo a pacientes-inicio.html");
                  res.json({ success: true, redirectUrl: '/pacientes-inicio.html' });
              }
          } else if (usuario.codigo === 'CC2024') {
              console.log("➡️ Redirigiendo a inicio.html");
              res.json({ success: true, redirectUrl: '/inicio.html' });
          } else {
            console.log("❌ Código de usuario no válido:", usuario.codigo);
              res.status(403).json({ error: "Código de usuario no válido" });
          }

          
      });
  });
});

app.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Error al cerrar la sesión: ' + err.message);
      res.status(500).send('Error en el servidor');
      return;
    }
    res.redirect('/login.html'); // Redirigir a la página de inicio o a donde desees después del logout
  });
});

// RUTA PARA REGISTRAR UN NUEVO USUARIO CON CÓDIGO DE ACCESO
app.post('/registrar-usuario', (req, res) => {
  const { nombre, correo, contraseña, codigo } = req.body;

  if (codigo !== 'CC2024' && codigo !== 'CC2025') {
    return res.status(400).json({ error: 'Código de verificación incorrecto' });
  }

  if (contraseña.length < 8) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
  }

  const saltRounds = 12;
  const hashedPassword = bcrypt.hashSync(contraseña, saltRounds);

  pool.query(
    'INSERT INTO usuarios (nombre, correo, contraseña, codigo) VALUES (?, ?, ?, ?)', 
    [nombre, correo, hashedPassword, codigo], 
    (err, results) => {
      if (err) {
        console.error('Error al registrar el usuario:', err);
        return res.status(500).json({ error: 'Error al registrar el usuario' });
      }
      res.status(200).json({ message: 'Usuario registrado con éxito' });
    }
  );
});

const requireCC2024 = (req, res, next) => {
  console.log('Verificando usuario:', req.session.user);
  if (!req.session || !req.session.user) {
    console.log('Usuario no autenticado. Redirigiendo a login.');
    return res.redirect('/login.html'); // Redirigir si no hay sesión activa
  }

  if (req.session.user.codigo !== 'CC2024') {
    console.log('Acceso denegado para el usuario con código:', req.session.user.codigo);
    return res.status(403).json({ error: "Acceso denegado. No tienes permiso para ver esta página." });
  }

  console.log('Acceso permitido.');
  next(); // Permitir acceso a la ruta
};

const requireCC2025 = (req, res, next) => {
  console.log('Verificando usuario:', req.session.user);
  if (!req.session || !req.session.user) {
    console.log('Usuario no autenticado. Redirigiendo a login.');
    return res.redirect('/login.html'); // Redirigir si no hay sesión activa
  }

  if (req.session.user.codigo !== 'CC2025') {
    console.log('Acceso denegado para el usuario con código:', req.session.user.codigo);
    return res.status(403).json({ error: "Acceso denegado. No tienes permiso para ver esta página." });
  }

  console.log('Acceso permitido.');
  next(); // Permitir acceso a la ruta
};



app.use((req, res, next) => {
  if (req.path === '/login' || req.path === '/logout' || req.path === '/registrar-usuario' || req.path === '/login.html') {
    return next(); // No aplicar autenticación en estas rutas
  }
  authenticateUser(req, res, next);
});   // Se protegen las rutas

// Registrar nuevo paciente
app.post('/registrar-paciente', (req, res) => {
  const { nombre, fecha_nacimiento, genero, telefono, email, fecha_registro, peso, estatura, sintomas, fecha_sintomas, enfermedades, antecedentes_familiares } = req.body;

  // Primero, verifica si el correo ya está registrado
  pool.query('SELECT email FROM pacientes WHERE email = ?', [email], (err, results) => {
    if (err) {
      console.error('Error al verificar el correo:', err);
      return res.status(500).json({ error: "Error al verificar el correo" });
    }
    if (results.length > 0) {
      // Si el correo ya está en uso, retorna un mensaje indicando esto
      return res.status(409).json({ error: "El correo electrónico ya está registrado" });
    } else {
      // Si no está en uso, procede a insertar el nuevo paciente
      pool.query('INSERT INTO pacientes (nombre, fecha_nacimiento, genero, telefono, email, fecha_registro, peso, estatura, sintomas, fecha_sintomas, enfermedades, antecedentes_familiares) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', 
      [nombre, fecha_nacimiento, genero, telefono, email, fecha_registro, peso, estatura, sintomas, fecha_sintomas, enfermedades, antecedentes_familiares], (err, results) => {
        if (err) {
          console.error('Error al insertar en la base de datos:', err);
          return res.status(500).json({ error: "Error al insertar los datos" });
        } else {
          res.status(200).json({ message: "Paciente registrado con éxito" });
        }
      });
    }
  });
});

// RUTAS PARA CONSULTAR DATOS
// Usuarios de la salud registrados
app.get('/consultar', (req, res) => {
  pool.query('SELECT * FROM usuarios', (err, results) => {
    if (err) {
      console.error('Error al consultar la base de datos:', err);
      res.status(500).send('Error al consultar los datos');
    } else {
      console.log('Usuarios consultados con éxito');
      res.status(200).json(results);
    }
  });
});

// Pacientes
app.get('/consultar-pacientes', (req, res) => {
  pool.query('SELECT * FROM pacientes', (err, results) => {
    if (err) {
      console.error('Error al consultar la base de datos:', err);
      res.status(500).send('Error al consultar los datos');
    } else {
      console.log('Pacientes consultados con éxito');
      res.status(200).json(results);
    }
  });
});

// Información de un paciente específico
app.get('/consultar-paciente/:id', (req, res) => {
    const pacienteId = req.params.id;
    pool.query('SELECT * FROM pacientes WHERE id = ?', [pacienteId], (err, results) => {
        if (err) {
            console.error('Error al consultar la base de datos:', err);
            res.status(500).send('Error al consultar los datos');
        } else {
            res.status(200).json(results[0]);
        }
    });
});

// Registro de un nuevo paciente (desde login de paciente)
app.post('/pacientes-inicio', (req, res) => {
  const { nombre, fecha_nacimiento, genero, telefono, email, fecha_registro, peso, estatura, sintomas, fecha_sintomas, enfermedades, antecedentes_familiares } = req.body;

  // Primero, verifica si el correo ya está registrado
  pool.query('SELECT email FROM historial_clinico WHERE email = ?', [email], (err, results) => {
    if (err) {
      console.error('Error al verificar el correo:', err);
      return res.status(500).json({ error: "Error al verificar el correo" });
    }
    if (results.length > 0) {
      // Si el correo ya está en uso, retorna un mensaje indicando esto
      return res.status(409).json({ error: "El correo electrónico ya está registrado" });
    } else {
      // Si no está en uso, procede a insertar el nuevo paciente
      pool.query('INSERT INTO historial_clinico (nombre, fecha_nacimiento, genero, telefono, email, fecha_registro, peso, estatura, sintomas, fecha_sintomas, enfermedades, antecedentes_familiares) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', 
      [nombre, fecha_nacimiento, genero, telefono, email, fecha_registro, peso, estatura, sintomas, fecha_sintomas, enfermedades, antecedentes_familiares], (err, results) => {
        if (err) {
          console.error('Error al insertar en la base de datos:', err);
          return res.status(500).json({ error: "Error al insertar los datos" });
        } else {
          const pacienteId = results.insertId;
          res.status(200).json({ succes:true, message: "Paciente registrado con éxito", pacienteId: pacienteId });
        }
      });
    }
  });
});

//Perfil de usuario

// Mostrar el perfil de usuario
// Perfil de usuario
app.get('/api/mi-perfil/:id', (req, res) => {
  const pacienteId = req.params.id;
pool.query(
  'SELECT nombre, genero, fecha_nacimiento, telefono, email, fecha_registro, peso, estatura, sintomas, fecha_sintomas, enfermedades, antecedentes_familiares FROM historial_clinico WHERE id = ?',
  [pacienteId],
  (error, results) => {
    if (error) {
      console.error('Error en la base de datos:', error);
      return res.status(500).json({ error: 'Error en la base de datos' });
    }

    if (results.length === 0) {
      return res.status(404).json({ error: 'Paciente no encontrado' });
    }

    // Formatear la fecha antes de enviarla
    const paciente = results[0];
    const fechaNacimiento = new Date(paciente.fecha_nacimiento);
    paciente.fecha_nacimiento = `${fechaNacimiento.getDate().toString().padStart(2, '0')}/${(fechaNacimiento.getMonth() + 1).toString().padStart(2, '0')}/${fechaNacimiento.getFullYear()}`;
    const fechasintomas = new Date(paciente.fecha_sintomas);
    paciente.fecha_sintomas = `${fechasintomas.getDate().toString().padStart(2, '0')}/${(fechasintomas.getMonth() + 1).toString().padStart(2, '0')}/${fechasintomas.getFullYear()}`;
    res.json({ paciente });
  }
);
});

app.put('/api/mi-perfil/:id', (req, res) => {
  const { id } = req.params;
  const { genero, fecha_nacimiento, telefono, email, peso, estatura, sintomas, fecha_sintomas, enfermedades, antecedentes_familiares } = req.body;

  pool.promise().query(
      `UPDATE historial_clinico SET 
          genero = ?, fecha_nacimiento = ?, telefono = ?, email = ?, 
          peso = ?, estatura = ?, sintomas = ?, fecha_sintomas = ?, 
          enfermedades = ?, antecedentes_familiares = ? 
       WHERE id = ?`,
      [ genero, fecha_nacimiento, telefono, email, peso, estatura, sintomas, fecha_sintomas, enfermedades, antecedentes_familiares, id]
  )
  .then(() => {
      res.json({ success: true });
  })
  .catch(error => {
      console.error("Error actualizando el perfil:", error);
      res.status(500).json({ success: false, message: "Error al actualizar" });
  });
});

// RUTAS PARA CONSULTAR DATOS
// Pacientes registrados por si mismos
app.get('/api/pacientes', (req, res) => {
  pool.query(
    'SELECT id, nombre, genero, fecha_nacimiento, telefono, email, fecha_registro FROM historial_clinico',
    (error, results) => {
      if (error) {
        console.error('Error en la base de datos:', error);
        return res.status(500).json({ error: 'Error en la base de datos' });
      }

      // Formatear fechas antes de enviarlas
      const pacientes = results.map(paciente => ({
        ...paciente,
        fecha_nacimiento: new Date(paciente.fecha_nacimiento).toLocaleDateString(),
        fecha_registro: new Date(paciente.fecha_registro).toLocaleDateString()
      }));

      res.json({ pacientes });
    }
  );
});




//RUTAS PARA MANEJO DE ARCHIVOS
// Subir archivo específico para un paciente
app.post('/subir_archivo_px', upload.single('file'), (req, res) => {
  const { patientId, type } = req.body; // Datos recibidos del formulario
  const nombreArchivo = req.file.filename;
  const fechaSubida = new Date(); // Fecha actual

  // Definir la ruta relativa del archivo, por ejemplo: '/uploads/nombreArchivo'
  const rutaArchivo = `/uploads/${nombreArchivo}`;

  console.log("Archivo recibido:", req.file);
  console.log("Datos recibidos:", req.body);

  // Inserta la información en la base de datos
  const sql = 'INSERT INTO archivos_paciente (paciente_id, nombre_archivo, tipo_archivo, fecha_subida, ruta_archivo) VALUES (?, ?, ?, ?,?)';
  pool.query(sql, [patientId, nombreArchivo, type, fechaSubida, rutaArchivo], (err, results) => {
    if (err) {
      console.error('Error al insertar en la base de datos:', err);
      res.status(500).send('Error al insertar los datos del archivo');
      return;
    } else {
      console.log('Archivo registrado con éxito:', results);
      res.status(200).json({ success: true, message: 'Archivo subido con éxito' });
    }
  });
});

//Archivo subido por un paciente
app.post('/archivo_px', upload.single('file'), (req, res) => {
  const { patientId, type } = req.body; // Datos recibidos del formulario
  const nombreArchivo = req.file.filename;
  const fechaSubida = new Date(); // Fecha actual

  // Definir la ruta relativa del archivo, por ejemplo: '/uploads/nombreArchivo'
  const rutaArchivo = `/uploads/${nombreArchivo}`;

  console.log("Archivo recibido:", req.file);
  console.log("Datos recibidos:", req.body);

  // Inserta la información en la base de datos
  const sql = 'INSERT INTO archivos (paciente_id, nombre_archivo, tipo_archivo, fecha_subida, ruta_archivo) VALUES (?, ?, ?, ?,?)';
  pool.query(sql, [patientId, nombreArchivo, type, fechaSubida, rutaArchivo], (err, results) => {
    if (err) {
      console.error('Error al insertar en la base de datos:', err);
      res.status(500).send('Error al insertar los datos del archivo');
      return;
    } else {
      console.log('Archivo registrado con éxito:', results);
      res.status(200).json({ success: true, message: 'Archivo subido con éxito' });
    }
  });
});
// Consultar archivos de un paciente
app.get('/consultar-archivos-paciente/:id', (req, res) => {
  const pacienteId = req.params.id;
  pool.query('SELECT id, nombre_archivo, tipo_archivo, fecha_subida, ruta_archivo FROM archivos_paciente WHERE paciente_id = ? AND nombre_archivo NOT LIKE "%.hea"', [pacienteId], (err, results) => {
    if (err) {
      console.error('Error al consultar los archivos del paciente:', err);
      res.status(500).send('Error al consultar los archivos del paciente');
    } else {
      console.log('Archivos consultados con éxito');
      res.status(200).json(results);
    }
  });
});

app.get('/consultar-archivos/:id', (req, res) => {
  const pacienteId = req.params.id;
  pool.query(
    'SELECT id, nombre_archivo, tipo_archivo, fecha_subida, ruta_archivo FROM archivos WHERE paciente_id = ? AND nombre_archivo NOT LIKE "%.hea"', 
    [pacienteId], 
    (err, results) => {
      if (err) {
        console.error('Error al consultar los archivos del paciente en la tabla archivos:', err);
        res.status(500).send('Error al consultar los archivos del paciente');
      } else {
        console.log('Archivos consultados con éxito desde la tabla archivos');
        res.status(200).json(results);
      }
    }
  );
});


// Obtener comentarios de un archivo
app.get('/consultar-comentarios/:id_archivo/:tipo_perfil', (req, res) => {
    const {id_archivo, tipo_perfil }= req.params;

    const query = `
        SELECT c.comentario, c.usuario, c.fecha 
        FROM comentarios c 
        WHERE c.id_archivo = ? AND c.tipo_perfil = ?
    `;

    pool.query(query, [id_archivo, tipo_perfil], (err, results) => {
        if (err) {
            console.error('Error al consultar comentarios:', err);
            return res.status(500).json({ error: 'Error al consultar comentarios' });
        }
        res.json(results);
    });
});

//Agregar comentario a un archivo 
app.post('/agregar-comentario', (req, res) => {
    const { archivoId, comentario, tipoPerfil } = req.body;
    const usuario = req.session.user ? req.session.user.nombre : 'Anónimo'; // Asumiendo que el nombre de usuario está en la sesión

    const query = `
        INSERT INTO comentarios (id_archivo, usuario, comentario, fecha, tipo_perfil) 
        VALUES (?, ?, ?, NOW(), ?)
    `;


    pool.query(query, [archivoId, usuario, comentario, tipoPerfil], (err, results) => {
        if (err) {
            console.error('Error al agregar comentario:', err);
            return res.status(500).json({ error: 'Error al agregar comentario' });
        }
        res.json({ message: 'Comentario agregado con éxito' });
    });
});

// Actualizar el perfil del paciente
app.put('/actualizar-paciente/:id', (req, res) => {
    const id = req.params.id;
    const { fecha_nacimiento, genero, telefono, email, peso, altura, sintomas, fecha_sintomas, enfermedades, antecedentes_familiares  } = req.body;

    const query = `
        UPDATE pacientes 
        SET fecha_nacimiento = ?, genero = ?, telefono = ?, email = ?, peso = ?, altura = ?, sintomas = ?, fecha_sintomas = ?, enfermedades = ?, antecedentes_familiares = ? 
        WHERE id = ?
    `;

    pool.query(query, [fecha_nacimiento, genero, telefono, email, id, peso, altura, sintomas, fecha_sintomas, enfermedades, antecedentes_familiares], (err, results) => {
        if (err) {
            console.error('Error al actualizar el perfil del paciente:', err);
            return res.status(500).json({ error: 'Error al actualizar el perfil del paciente' });
        }
        res.json({ message: 'Perfil actualizado con éxito' });
    });
});

//RUTAS PARA PROCESAMIENTO DE ARCHIVOS
// Ruta para procesar fonocardiograma y devolver la ruta del archivo WAV
app.get('/obtener-datos-fonocardiograma/:nombre_archivo', (req, res) => {
  const nombreArchivo = req.params.nombre_archivo;
  const filePath = path.join(__dirname, '..', 'public', 'uploads', nombreArchivo);
  const scriptPath = path.join(__dirname, 'process_audio.py');
  const wavPath = filePath.replace('.mp3', '.wav');

  exec(`python ${scriptPath} ${filePath}`, { maxBuffer: 1533 * 1533 * 15 }, (error, stdout, stderr) => {
      if (error) {
          console.error(`Error ejecutando el script Python: ${error.message}`);
          return res.status(500).json({ error: 'Error procesando el archivo .mp3' });
      }
      if (stderr) {
          console.error(`Error en el script Python: ${stderr}`);
          return res.status(500).json({ error: 'Error procesando el archivo .mp3' });
      }

       // Verificar si el archivo WAV existe y devolver su ruta
       if (fs.existsSync(wavPath)) {
        res.status(200).json({
            ...JSON.parse(stdout),
            rutaWav: `/uploads/${path.basename(wavPath)}` // Asegúrate de que la carpeta uploads sea accesible
        });
    } else {
        console.error('Archivo WAV no encontrado.');
        res.status(500).json({ error: 'Archivo WAV no generado.' });
    }
});
}); 



app.get('/obtener-datos-electrocardiograma/:nombre_archivo', (req, res) => {
  const nombreArchivo = req.params.nombre_archivo;
  const filePath = path.join(__dirname, '..', 'public', 'uploads', nombreArchivo);
  const scriptPath = path.join(__dirname, 'process_ecg.py');

  exec(`python ${scriptPath} ${filePath}`, { maxBuffer: 2044 * 2044 * 20 }, (error, stdout, stderr) => {
        if (error) {
            console.error(`Error ejecutando el script Python: ${error.message}`);
            return res.status(500).json({ error: 'Error al procesar el archivo .dat' });
        }
        if (stderr) {
            console.error(`Error en el script Python: ${stderr}`);
            return res.status(500).json({ error: 'Error al procesar el archivo .dat' });
        }

        try {
            console.log("Salida JSON del scipt Python:", stdout);
            const data = JSON.parse(stdout);
            res.json(data);
        } catch (parseError) {
            console.error(`Error al parsear la salida del script Python: ${parseError.message}`);
            res.status(500).json({ error: 'Datos inválidos recibidos del servidor' });
        }
    });
});

// RUTAS PARA SERVIR ARCHIVOS HTML
app.get('/formulario', authenticateUser,requireCC2024, (req, res) => {
  res.sendFile(path.join(__dirname, '../public/formulario.html'));
});
app.get('/inicio.html',authenticateUser, requireCC2024, (req, res) => {
  res.sendFile(path.join(__dirname, '../public/inicio.html'));

});
app.get('/perfil.html', authenticateUser,requireCC2024, (req, res) => {
  console.log('Usuario autenticado:', req.session.user);
  res.sendFile(path.join(__dirname, '../public/perfil.html'));
});

app.get('/perfil-del-paciente/:id', authenticateUser,requireCC2024, (req, res)=>{
  res.sendFile(path.join(__dirname,'../public/perfil-del-paciente.html'));
});

app.get('/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/login.html'));
});

app.get('/pacientes-inicio.html',authenticateUser,requireCC2025, (req, res) => {
  if (req.session.user) {
    res.sendFile(path.join(__dirname, '../public/pacientes-inicio.html'));
  } else {
    res.redirect('/login.html');
  }
});

app.get('/historial-clinico',authenticateUser,requireCC2025, (req, res) => {
  res.sendFile(path.join(__dirname, '../public/historial-clinico.html'));
});

app.get('/mi-perfil/:id',authenticateUser,requireCC2025, (req, res) => {
  res.sendFile(path.join(__dirname, '../public/mi-perfil.html'));
});

app.get('/Perfiles-pacientes', authenticateUser,requireCC2024, (req, res)=>{
  res.sendFile(path.join(__dirname, '../public/Perfiles-pacientes.html'));
});

app.get('/Respuestas-medicos/:id',authenticateUser,requireCC2025, (req, res)=>{
  res.sendFile(path.join(__dirname, '../public/Respuestas-medicos.html'));
});



//INICIALIZACIÓN DEL SERVIDOR
app.listen(port, () => {
  console.log(`Servidor corriendo en el puerto ${port}`);
});


