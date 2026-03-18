/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Trophy, 
  Users, 
  Play, 
  Plus, 
  ArrowRight, 
  CheckCircle2, 
  XCircle,
  Loader2,
  Flag,
  User as UserIcon
} from 'lucide-react';
import { generateQuizQuestions, Question } from './services/gemini';
import { cn } from './lib/utils';

interface Student {
  id: string;
  name: string;
  progress: number;
}

type View = 'landing' | 'teacher-create' | 'teacher-lobby' | 'student-join' | 'student-lobby' | 'quiz' | 'results';

export default function App() {
  const [view, setView] = useState<View>('landing');
  const [name, setName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [topic, setTopic] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);

  useEffect(() => {
    const newSocket = io();
    setSocket(newSocket);

    newSocket.on('room-update', (data) => {
      setStudents(data.students);
    });

    newSocket.on('quiz-started', (data) => {
      setQuestions(data.questions);
      setView('quiz');
    });

    newSocket.on('progress-update', (updatedStudents) => {
      setStudents(updatedStudents);
    });

    newSocket.on('error', (msg) => {
      setError(msg);
      setTimeout(() => setError(null), 3000);
    });

    return () => {
      newSocket.disconnect();
    };
  }, []);

  const handleCreateRoom = async () => {
    if (!name || !topic) return;
    setIsGenerating(true);
    try {
      const generatedQuestions = await generateQuizQuestions(topic);
      if (generatedQuestions.length === 0) {
        throw new Error('문제를 생성하지 못했습니다.');
      }
      setQuestions(generatedQuestions);
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      setRoomCode(code);
      socket?.emit('create-room', { teacherName: name, questions: generatedQuestions, code });
      setView('teacher-lobby');
    } catch (err) {
      setError('문제 생성 중 오류가 발생했습니다.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleJoinRoom = () => {
    if (!name || !roomCode) return;
    socket?.emit('join-room', { code: roomCode, studentName: name });
    setView('student-lobby');
  };

  const handleStartQuiz = () => {
    socket?.emit('start-quiz', { code: roomCode });
  };

  const handleAnswer = (index: number) => {
    if (isAnswered) return;
    setSelectedOption(index);
    setIsAnswered(true);
    const isCorrect = index === questions[currentQuestionIndex].answerIndex;
    if (isCorrect) setScore(s => s + 1);
    
    socket?.emit('submit-answer', { code: roomCode, isCorrect });

    setTimeout(() => {
      if (currentQuestionIndex < questions.length - 1) {
        setCurrentQuestionIndex(prev => prev + 1);
        setSelectedOption(null);
        setIsAnswered(false);
      } else {
        setView('results');
      }
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-[#F5F5F0] text-[#141414] font-sans selection:bg-[#141414] selection:text-[#F5F5F0]">
      <AnimatePresence mode="wait">
        {/* Error Toast */}
        {error && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-red-500 text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-2"
          >
            <XCircle size={20} />
            {error}
          </motion.div>
        )}

        {/* Landing View */}
        {view === 'landing' && (
          <motion.div 
            key="landing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center min-h-screen p-6 text-center"
          >
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="mb-8"
            >
              <Trophy size={80} className="text-[#141414] mb-4 mx-auto" strokeWidth={1.5} />
              <h1 className="text-6xl font-bold tracking-tighter mb-2 italic serif">AI QUIZ RACE</h1>
              <p className="text-lg opacity-60">문제를 맞추고 결승선까지 달려보세요!</p>
            </motion.div>

            <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
              <button 
                onClick={() => setView('teacher-create')}
                className="flex-1 bg-[#141414] text-[#F5F5F0] py-4 px-8 rounded-2xl font-medium hover:scale-105 transition-transform flex items-center justify-center gap-2"
              >
                <Plus size={20} /> 교사로 시작하기
              </button>
              <button 
                onClick={() => setView('student-join')}
                className="flex-1 border-2 border-[#141414] py-4 px-8 rounded-2xl font-medium hover:bg-[#141414] hover:text-[#F5F5F0] transition-all flex items-center justify-center gap-2"
              >
                <Users size={20} /> 학생으로 참여하기
              </button>
            </div>
          </motion.div>
        )}

        {/* Teacher Create View */}
        {view === 'teacher-create' && (
          <motion.div 
            key="teacher-create"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex flex-col items-center justify-center min-h-screen p-6"
          >
            <div className="w-full max-w-md space-y-8">
              <div className="text-center">
                <h2 className="text-4xl font-bold tracking-tight italic serif">방 만들기</h2>
                <p className="opacity-60">퀴즈 주제를 입력하고 AI로 문제를 생성하세요.</p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs uppercase font-bold tracking-widest opacity-50">이름</label>
                  <input 
                    type="text" 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="선생님 성함을 입력하세요"
                    className="w-full bg-white border-b-2 border-[#141414] p-4 focus:outline-none text-xl"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs uppercase font-bold tracking-widest opacity-50">퀴즈 주제</label>
                  <textarea 
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="예: 중학교 1학년 과학 - 광합성"
                    className="w-full bg-white border-b-2 border-[#141414] p-4 focus:outline-none text-xl min-h-[120px] resize-none"
                  />
                </div>
              </div>

              <button 
                onClick={handleCreateRoom}
                disabled={isGenerating || !name || !topic}
                className="w-full bg-[#141414] text-[#F5F5F0] py-4 rounded-2xl font-medium disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="animate-spin" size={20} /> 문제 생성 중...
                  </>
                ) : (
                  <>
                    <Play size={20} /> 방 만들기
                  </>
                )}
              </button>
            </div>
          </motion.div>
        )}

        {/* Student Join View */}
        {view === 'student-join' && (
          <motion.div 
            key="student-join"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex flex-col items-center justify-center min-h-screen p-6"
          >
            <div className="w-full max-w-md space-y-8">
              <div className="text-center">
                <h2 className="text-4xl font-bold tracking-tight italic serif">참여하기</h2>
                <p className="opacity-60">참여 코드와 이름을 입력하세요.</p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs uppercase font-bold tracking-widest opacity-50">참여 코드</label>
                  <input 
                    type="text" 
                    value={roomCode}
                    onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                    placeholder="ABCDEF"
                    className="w-full bg-white border-b-2 border-[#141414] p-4 focus:outline-none text-3xl font-mono tracking-widest text-center"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs uppercase font-bold tracking-widest opacity-50">내 이름</label>
                  <input 
                    type="text" 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="이름을 입력하세요"
                    className="w-full bg-white border-b-2 border-[#141414] p-4 focus:outline-none text-xl"
                  />
                </div>
              </div>

              <button 
                onClick={handleJoinRoom}
                disabled={!name || !roomCode}
                className="w-full bg-[#141414] text-[#F5F5F0] py-4 rounded-2xl font-medium disabled:opacity-50 flex items-center justify-center gap-2"
              >
                입장하기 <ArrowRight size={20} />
              </button>
            </div>
          </motion.div>
        )}

        {/* Lobby View (Shared for Teacher/Student) */}
        {(view === 'teacher-lobby' || view === 'student-lobby') && (
          <motion.div 
            key="lobby"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col min-h-screen p-6"
          >
            <div className="max-w-4xl mx-auto w-full flex-1 flex flex-col">
              <div className="flex flex-col md:flex-row justify-between items-center mb-12 gap-6">
                <div>
                  <h2 className="text-5xl font-bold tracking-tighter italic serif">{roomCode}</h2>
                  <p className="opacity-50 uppercase tracking-widest text-xs font-bold">참여 코드</p>
                </div>
                {view === 'teacher-lobby' && (
                  <button 
                    onClick={handleStartQuiz}
                    className="bg-[#141414] text-[#F5F5F0] py-4 px-12 rounded-full font-bold text-xl hover:scale-105 transition-transform flex items-center gap-2"
                  >
                    <Play size={24} /> 시작하기
                  </button>
                )}
                {view === 'student-lobby' && (
                  <div className="flex items-center gap-2 text-xl font-medium opacity-60">
                    <Loader2 className="animate-spin" /> 선생님이 시작하기를 기다리는 중...
                  </div>
                )}
              </div>

              <div className="flex-1 bg-white/50 rounded-3xl p-8 border-2 border-dashed border-[#141414]/20">
                <div className="flex items-center gap-2 mb-6">
                  <Users size={24} />
                  <h3 className="text-xl font-bold">참여 중인 학생 ({students.length})</h3>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  <AnimatePresence>
                    {students.map((student) => (
                      <motion.div 
                        key={student.id}
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.8, opacity: 0 }}
                        className="bg-white p-4 rounded-2xl shadow-sm border border-[#141414]/5 flex items-center gap-3"
                      >
                        <div className="w-10 h-10 bg-[#141414] text-[#F5F5F0] rounded-full flex items-center justify-center font-bold">
                          {student.name[0]}
                        </div>
                        <span className="font-medium truncate">{student.name}</span>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Quiz View */}
        {view === 'quiz' && (
          <motion.div 
            key="quiz"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col min-h-screen"
          >
            {/* Race Map */}
            <div className="bg-[#141414] text-[#F5F5F0] p-6 overflow-hidden">
              <div className="max-w-6xl mx-auto relative h-24 flex items-center">
                <div className="absolute inset-x-0 h-1 bg-white/20 rounded-full" />
                <div className="absolute right-0 top-1/2 -translate-y-1/2 flex flex-col items-center">
                  <Flag className="text-[#F5F5F0]" size={32} />
                  <span className="text-[10px] font-bold uppercase tracking-widest mt-1">FINISH</span>
                </div>
                
                <div className="relative flex-1 h-full">
                  {students.map((student) => (
                    <motion.div
                      key={student.id}
                      initial={false}
                      animate={{ 
                        left: `${(student.progress / questions.length) * 100}%`,
                        y: student.id === socket?.id ? -10 : 10
                      }}
                      transition={{ type: 'spring', stiffness: 100 }}
                      className={cn(
                        "absolute top-1/2 -translate-y-1/2 flex flex-col items-center transition-all",
                        student.id === socket?.id ? "z-20" : "z-10 opacity-60"
                      )}
                    >
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2",
                        student.id === socket?.id ? "bg-white text-[#141414] border-[#141414]" : "bg-gray-400 text-white border-transparent"
                      )}>
                        {student.name[0]}
                      </div>
                      <span className="text-[10px] mt-1 font-medium whitespace-nowrap">{student.name}</span>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>

            {/* Question Area */}
            <div className="flex-1 p-6 flex flex-col items-center justify-center max-w-4xl mx-auto w-full">
              <div className="w-full mb-12 text-center">
                <div className="text-xs font-bold uppercase tracking-widest opacity-50 mb-2">
                  Question {currentQuestionIndex + 1} of {questions.length}
                </div>
                <h3 className="text-3xl md:text-4xl font-bold tracking-tight">
                  {questions[currentQuestionIndex]?.question}
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                {questions[currentQuestionIndex]?.options.map((option, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleAnswer(idx)}
                    disabled={isAnswered}
                    className={cn(
                      "p-6 rounded-3xl text-left text-xl font-medium transition-all border-2 flex items-center justify-between",
                      !isAnswered && "bg-white border-transparent hover:border-[#141414] hover:scale-[1.02]",
                      isAnswered && idx === questions[currentQuestionIndex].answerIndex && "bg-green-500 text-white border-green-500",
                      isAnswered && selectedOption === idx && idx !== questions[currentQuestionIndex].answerIndex && "bg-red-500 text-white border-red-500",
                      isAnswered && selectedOption !== idx && idx !== questions[currentQuestionIndex].answerIndex && "bg-white opacity-40 border-transparent"
                    )}
                  >
                    {option}
                    {isAnswered && idx === questions[currentQuestionIndex].answerIndex && <CheckCircle2 size={24} />}
                    {isAnswered && selectedOption === idx && idx !== questions[currentQuestionIndex].answerIndex && <XCircle size={24} />}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* Results View */}
        {view === 'results' && (
          <motion.div 
            key="results"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center min-h-screen p-6 text-center"
          >
            <Trophy size={120} className="text-[#141414] mb-8" />
            <h2 className="text-6xl font-bold tracking-tighter italic serif mb-4">RACE FINISHED!</h2>
            <div className="text-3xl font-medium mb-12">
              당신의 점수: <span className="font-bold text-4xl">{score}</span> / {questions.length}
            </div>

            <div className="w-full max-w-2xl bg-white rounded-3xl p-8 shadow-xl mb-8">
              <h3 className="text-xl font-bold mb-6 flex items-center justify-center gap-2">
                <Users size={24} /> 최종 순위
              </h3>
              <div className="space-y-4">
                {[...students].sort((a, b) => b.progress - a.progress).map((student, idx) => (
                  <div key={student.id} className="flex items-center justify-between p-4 bg-[#F5F5F0] rounded-2xl">
                    <div className="flex items-center gap-4">
                      <span className="text-2xl font-bold opacity-30">#{idx + 1}</span>
                      <div className="w-10 h-10 bg-[#141414] text-[#F5F5F0] rounded-full flex items-center justify-center font-bold">
                        {student.name[0]}
                      </div>
                      <span className="text-xl font-bold">{student.name}</span>
                    </div>
                    <div className="text-xl font-medium">
                      {student.progress} / {questions.length}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button 
              onClick={() => window.location.reload()}
              className="bg-[#141414] text-[#F5F5F0] py-4 px-12 rounded-full font-bold text-xl hover:scale-105 transition-transform"
            >
              처음으로 돌아가기
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
