import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';

let io: SocketIOServer | null = null;

/**
 * Khởi tạo Socket.IO server và gắn vào HTTP server.
 * Xác thực JWT từ handshake auth token trước khi cho phép kết nối.
 */
export function initSocket(httpServer: HttpServer): SocketIOServer {
  const clientOrigin = process.env.CLIENT_URL || 'http://localhost:5173';

  io = new SocketIOServer(httpServer, {
    cors: {
      origin: [clientOrigin, 'http://localhost:5173', 'http://localhost:3000'],
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  // ─── Middleware: Xác thực JWT ──────────────────────────────────────────────
  io.use((socket: Socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error('Authentication token required'));
    }
    try {
      const jwtSecret = process.env.JWT_SECRET!;
      const decoded = jwt.verify(token, jwtSecret) as any;
      // Gắn userId và role vào socket để dùng sau
      (socket as any).userId = decoded.id || decoded._id || decoded.userId;
      (socket as any).role = decoded.role;
      next();
    } catch {
      next(new Error('Invalid or expired token'));
    }
  });

  // ─── Connection handler ────────────────────────────────────────────────────
  io.on('connection', (socket: Socket) => {
    const userId = (socket as any).userId;
    const role = (socket as any).role;

    // Mỗi user join room riêng theo userId (để gửi thông báo cá nhân)
    socket.join(`user:${userId}`);

    // Admin join thêm room "admins" (nhận thông báo broadcast cho admin)
    if (role === 'admin') {
      socket.join('admins');
      console.log(`🔌 Admin connected: ${userId} [socket: ${socket.id}]`);
    } else {
      console.log(`🔌 User connected: ${userId} [socket: ${socket.id}]`);
    }

    socket.on('disconnect', () => {
      console.log(`🔴 Disconnected: ${userId} [socket: ${socket.id}]`);
    });
  });

  console.log('✅ Socket.IO initialized');
  return io;
}

/**
 * Lấy instance Socket.IO hiện tại.
 * Throw nếu chưa được khởi tạo (gọi trước initSocket).
 */
export function getIO(): SocketIOServer {
  if (!io) throw new Error('Socket.IO not initialized. Call initSocket() first.');
  return io;
}

/**
 * Emit một sự kiện "new_notification" đến tất cả admin đang online.
 */
export function emitToAdmins(event: string, data: any) {
  if (!io) return;
  io.to('admins').emit(event, data);
}

/**
 * Emit một sự kiện đến một user cụ thể (theo userId).
 */
export function emitToUser(userId: string, event: string, data: any) {
  if (!io) return;
  io.to(`user:${userId}`).emit(event, data);
}
