const express = require('express')
const app = express()
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const cors = require('cors');

const dotenv = require('dotenv');
dotenv.config();

const port = process.env.PORT || 3000;
require('./db')

// Update allowed origins to include your React dev server
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:5173', // Add your React dev server
  'http://localhost:3000'  // Add additional dev server port if needed
]; 

app.use(
    cors({
        origin: function (origin, callback) {
            // Allow requests with no origin (like mobile apps or curl requests)
            if (!origin || allowedOrigins.includes(origin)) {
                callback(null, true);
            }
            else {
                callback(new Error('Not allowed by CORS'));
            }
        },
        credentials: true
    })
)

// Increase payload size limits for larger startup descriptions
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

app.use(cookieParser({
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 1000 * 60 * 60 * 24 * 7,
    signed: true
}));

// Import routes
const authRoutes = require('./routes/authRoutes');
const startupRoutes = require("./routes/startupRoutes");
const manpowerRoutes = require("./routes/manpowerRoutes");
const userRoutes = require('./routes/userRoutes');

// Use routes
app.use('/auth', authRoutes);
app.use("/api/startups", startupRoutes);
app.use("/api/manpower", manpowerRoutes);
app.use("/api/user", userRoutes);

// Health check endpoint
app.get('/', (req, res) => {
    res.json({
        message: 'LetsGrow Backend API is running!',
        version: '1.0.0',
        endpoints: {
            auth: '/auth/*',
            startups: '/api/startups/*'
        }
    });
});

// Test endpoint
app.get('/getuserdata', (req, res) => {
    res.send('Harshal Jain , 45 , Male')
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Error:', error);
    
    if (error.message === 'Not allowed by CORS') {
        return res.status(403).json({ message: 'CORS error: Origin not allowed' });
    }
    
    res.status(500).json({ 
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
});

// Handle 404 routes
app.use('*', (req, res) => {
    res.status(404).json({ message: 'Route not found' });
});

app.listen(port, () => {
    console.log(`LetsGrow backend app listening on port ${port}`)
    console.log(`Available endpoints:`)
    console.log(`- Health check: http://localhost:${port}/`)
    console.log(`- Auth routes: http://localhost:${port}/auth/*`)
    console.log(`- Startup routes: http://localhost:${port}/api/startups/*`)
})