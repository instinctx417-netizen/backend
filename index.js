require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const authRoutes = require('./routes/authRoutes');

const app = express();
const server = http.createServer(app);

// Allowed origins for CORS
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:3000',
  process.env.COMMUNITY_URL || 'http://localhost:3001',
  'https://instinctxai.com',
  'https://www.instinctxai.com',
  'https://community.instinctxai.com',
];

// Socket.io setup
const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) {
        callback(null, true);
        return;
      }
      // Check if origin matches any allowed origin
      const isAllowed = allowedOrigins.some(allowed => {
        const allowedDomain = allowed.replace(/^https?:\/\//, '');
        const originDomain = origin.replace(/^https?:\/\//, '');
        return originDomain === allowedDomain || originDomain.includes(allowedDomain);
      });
      if (isAllowed) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  },
});

// Store Socket.io instance globally for use in routes/controllers
app.set('io', io);

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Join user-specific room when authenticated
  socket.on('join-user-room', (userId) => {
    socket.join(`user-${userId}`);
    console.log(`User ${userId} joined their notification room`);
  });

  // Join admin room
  socket.on('join-admin-room', () => {
    socket.join('admin-room');
    console.log(`Admin joined admin room`);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) {
      callback(null, true);
      return;
    }
    // Check if origin matches any allowed origin
    const isAllowed = allowedOrigins.some(allowed => {
      const allowedDomain = allowed.replace(/^https?:\/\//, '');
      const originDomain = origin.replace(/^https?:\/\//, '');
      return originDomain === allowedDomain || originDomain.includes(allowedDomain);
    });
    if (isAllowed) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));
// Skip JSON parsing for multipart/form-data (file uploads)
app.use((req, res, next) => {
  const contentType = req.headers['content-type'] || '';
  if (contentType.includes('multipart/form-data')) {
    return next();
  }
  express.json()(req, res, next);
});
app.use(express.urlencoded({ extended: true }));

// Health check route
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok',
    message: 'Backend server is running',
    timestamp: new Date().toISOString(),
  });
});

// Sample route
app.get('/api/hello', (req, res) => {
  res.json({ message: "Hello from Backend!" });
});

// Auth routes
app.use('/api/auth', authRoutes);

// Client Portal routes
const clientPortalRoutes = require('./routes/clientPortalRoutes');
app.use('/api/client-portal', clientPortalRoutes);

// Community routes (separate from client portal)
const communityRoutes = require('./routes/communityRoutes');
app.use('/api/community', communityRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
  });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`🚀 Backend server running on http://localhost:${PORT}`);
  console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔔 Socket.io server ready for real-time notifications`);
});