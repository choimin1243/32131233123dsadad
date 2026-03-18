import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { createServer as createViteServer } from 'vite';

interface Question {
  question: string;
  options: string[];
  answerIndex: number;
}

interface Student {
  id: string;
  name: string;
  progress: number;
}

interface Room {
  code: string;
  teacherName: string;
  questions: Question[];
  students: Map<string, Student>;
  status: 'waiting' | 'playing' | 'finished';
}

const rooms = new Map<string, Room>();

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: '*',
    },
  });

  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // Socket.io logic
  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('create-room', ({ teacherName, questions, code }) => {
      const room: Room = {
        code,
        teacherName,
        questions,
        students: new Map(),
        status: 'waiting',
      };
      rooms.set(code, room);
      socket.join(code);
      console.log(`Room created: ${code} by ${teacherName}`);
    });

    socket.on('join-room', ({ code, studentName }) => {
      const room = rooms.get(code);
      if (!room) {
        socket.emit('error', '방을 찾을 수 없습니다.');
        return;
      }
      if (room.status !== 'waiting') {
        socket.emit('error', '이미 시작된 방입니다.');
        return;
      }

      const student: Student = {
        id: socket.id,
        name: studentName,
        progress: 0,
      };
      room.students.set(socket.id, student);
      socket.join(code);
      
      // Notify everyone in the room about the new student
      io.to(code).emit('room-update', {
        code: room.code,
        teacherName: room.teacherName,
        students: Array.from(room.students.values()),
        status: room.status,
      });
      
      console.log(`Student ${studentName} joined room ${code}`);
    });

    socket.on('start-quiz', ({ code }) => {
      const room = rooms.get(code);
      if (room) {
        room.status = 'playing';
        io.to(code).emit('quiz-started', { questions: room.questions });
        io.to(code).emit('room-update', {
          code: room.code,
          teacherName: room.teacherName,
          students: Array.from(room.students.values()),
          status: room.status,
        });
      }
    });

    socket.on('submit-answer', ({ code, isCorrect }) => {
      const room = rooms.get(code);
      if (room && room.status === 'playing') {
        const student = room.students.get(socket.id);
        if (student && isCorrect) {
          student.progress += 1;
          
          io.to(code).emit('progress-update', Array.from(room.students.values()));
          
          if (student.progress >= room.questions.length) {
            // Optional: handle winner
          }
        }
      }
    });

    socket.on('disconnect', () => {
      // Clean up student from rooms
      rooms.forEach((room, code) => {
        if (room.students.has(socket.id)) {
          room.students.delete(socket.id);
          io.to(code).emit('room-update', {
            code: room.code,
            teacherName: room.teacherName,
            students: Array.from(room.students.values()),
            status: room.status,
          });
        }
      });
      console.log('User disconnected:', socket.id);
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
