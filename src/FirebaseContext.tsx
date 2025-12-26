import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { 
  collection, 
  doc, 
  onSnapshot, 
  setDoc, 
  deleteDoc,
  writeBatch,
  query,
  Unsubscribe
} from 'firebase/firestore';
import { db } from './firebase';
import { Category, TimeBlock, Todo, Event, WeeklyGoal } from './types';
import * as localStore from './store';

interface CalendarData {
  categories: Category[];
  timeBlocks: TimeBlock[];
  todos: Todo[];
  events: Event[];
  weeklyGoals: WeeklyGoal[];
}

interface FirebaseContextType {
  // 연결 상태
  isConnected: boolean;
  roomCode: string | null;
  
  // 룸 관리
  createRoom: () => Promise<string>;
  joinRoom: (code: string) => Promise<boolean>;
  leaveRoom: () => void;
  
  // 데이터
  data: CalendarData;
  
  // 데이터 조작
  updateCategories: (categories: Category[]) => void;
  updateTimeBlock: (block: TimeBlock) => void;
  addTodo: (todo: Todo) => void;
  updateTodo: (todo: Todo) => void;
  deleteTodo: (id: string) => void;
  addEvent: (event: Event) => void;
  updateEvent: (event: Event) => void;
  deleteEvent: (id: string) => void;
  addWeeklyGoal: (goal: WeeklyGoal) => void;
  updateWeeklyGoal: (goal: WeeklyGoal) => void;
  deleteWeeklyGoal: (id: string) => void;
}

const FirebaseContext = createContext<FirebaseContextType | null>(null);

// 랜덤 6자리 코드 생성
function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// 로컬 스토리지 키
const ROOM_CODE_KEY = 'calendar_room_code';

export function FirebaseProvider({ children }: { children: ReactNode }) {
  const [isConnected, setIsConnected] = useState(false);
  const [roomCode, setRoomCode] = useState<string | null>(() => {
    return localStorage.getItem(ROOM_CODE_KEY);
  });
  
  const [data, setData] = useState<CalendarData>({
    categories: localStore.getCategories(),
    timeBlocks: localStore.getTimeBlocks(),
    todos: localStore.getTodos(),
    events: localStore.getEvents(),
    weeklyGoals: localStore.getWeeklyGoals(),
  });

  // Firebase 실시간 리스너 설정
  useEffect(() => {
    if (!roomCode) {
      setIsConnected(false);
      return;
    }

    const unsubscribers: Unsubscribe[] = [];

    try {
      // Categories 리스너
      const categoriesRef = collection(db, 'rooms', roomCode, 'categories');
      unsubscribers.push(
        onSnapshot(query(categoriesRef), (snapshot) => {
          if (!snapshot.empty) {
            const categories = snapshot.docs.map(doc => doc.data() as Category);
            setData(prev => ({ ...prev, categories }));
            localStore.saveCategories(categories);
          }
        }, (error) => {
          console.error('Categories listener error:', error);
        })
      );

      // TimeBlocks 리스너
      const timeBlocksRef = collection(db, 'rooms', roomCode, 'timeBlocks');
      unsubscribers.push(
        onSnapshot(query(timeBlocksRef), (snapshot) => {
          const timeBlocks = snapshot.docs.map(doc => doc.data() as TimeBlock);
          setData(prev => ({ ...prev, timeBlocks }));
          localStore.saveTimeBlocks(timeBlocks);
        }, (error) => {
          console.error('TimeBlocks listener error:', error);
        })
      );

      // Todos 리스너
      const todosRef = collection(db, 'rooms', roomCode, 'todos');
      unsubscribers.push(
        onSnapshot(query(todosRef), (snapshot) => {
          const todos = snapshot.docs.map(doc => doc.data() as Todo);
          setData(prev => ({ ...prev, todos }));
          localStore.saveTodos(todos);
        }, (error) => {
          console.error('Todos listener error:', error);
        })
      );

      // Events 리스너
      const eventsRef = collection(db, 'rooms', roomCode, 'events');
      unsubscribers.push(
        onSnapshot(query(eventsRef), (snapshot) => {
          const events = snapshot.docs.map(doc => doc.data() as Event);
          setData(prev => ({ ...prev, events }));
          localStore.saveEvents(events);
        }, (error) => {
          console.error('Events listener error:', error);
        })
      );

      // WeeklyGoals 리스너
      const weeklyGoalsRef = collection(db, 'rooms', roomCode, 'weeklyGoals');
      unsubscribers.push(
        onSnapshot(query(weeklyGoalsRef), (snapshot) => {
          const weeklyGoals = snapshot.docs.map(doc => doc.data() as WeeklyGoal);
          setData(prev => ({ ...prev, weeklyGoals }));
          localStore.saveWeeklyGoals(weeklyGoals);
        }, (error) => {
          console.error('WeeklyGoals listener error:', error);
        })
      );

      setIsConnected(true);
    } catch (error) {
      console.error('Firebase connection error:', error);
      setIsConnected(false);
    }

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [roomCode]);

  // 새 룸 생성
  const createRoom = useCallback(async (): Promise<string> => {
    const code = generateRoomCode();
    
    // 현재 로컬 데이터를 Firebase에 업로드
    const batch = writeBatch(db);
    
    // Categories 업로드
    data.categories.forEach(cat => {
      const ref = doc(db, 'rooms', code, 'categories', cat.id);
      batch.set(ref, cat);
    });
    
    // TimeBlocks 업로드
    data.timeBlocks.forEach(block => {
      const ref = doc(db, 'rooms', code, 'timeBlocks', block.id);
      batch.set(ref, block);
    });
    
    // Todos 업로드
    data.todos.forEach(todo => {
      const ref = doc(db, 'rooms', code, 'todos', todo.id);
      batch.set(ref, todo);
    });
    
    // Events 업로드
    data.events.forEach(event => {
      const ref = doc(db, 'rooms', code, 'events', event.id);
      batch.set(ref, event);
    });
    
    // WeeklyGoals 업로드
    data.weeklyGoals.forEach(goal => {
      const ref = doc(db, 'rooms', code, 'weeklyGoals', goal.id);
      batch.set(ref, goal);
    });
    
    await batch.commit();
    
    setRoomCode(code);
    localStorage.setItem(ROOM_CODE_KEY, code);
    
    return code;
  }, [data]);

  // 룸 참가
  const joinRoom = useCallback(async (code: string): Promise<boolean> => {
    try {
      // 코드를 대문자로 변환하고 공백 제거
      const normalizedCode = code.toUpperCase().replace(/\s/g, '');
      
      setRoomCode(normalizedCode);
      localStorage.setItem(ROOM_CODE_KEY, normalizedCode);
      
      return true;
    } catch (error) {
      console.error('Join room error:', error);
      return false;
    }
  }, []);

  // 룸 나가기
  const leaveRoom = useCallback(() => {
    setRoomCode(null);
    localStorage.removeItem(ROOM_CODE_KEY);
    setIsConnected(false);
    
    // 로컬 데이터로 복원
    setData({
      categories: localStore.getCategories(),
      timeBlocks: localStore.getTimeBlocks(),
      todos: localStore.getTodos(),
      events: localStore.getEvents(),
      weeklyGoals: localStore.getWeeklyGoals(),
    });
  }, []);

  // 데이터 조작 함수들
  const updateCategories = useCallback((categories: Category[]) => {
    if (roomCode) {
      const batch = writeBatch(db);
      categories.forEach(cat => {
        const ref = doc(db, 'rooms', roomCode, 'categories', cat.id);
        batch.set(ref, cat);
      });
      batch.commit();
    }
    localStore.saveCategories(categories);
    setData(prev => ({ ...prev, categories }));
  }, [roomCode]);

  const updateTimeBlock = useCallback((block: TimeBlock) => {
    if (roomCode) {
      const ref = doc(db, 'rooms', roomCode, 'timeBlocks', block.id);
      setDoc(ref, block);
    }
    localStore.updateTimeBlock(block);
    setData(prev => ({
      ...prev,
      timeBlocks: prev.timeBlocks.some(b => b.id === block.id)
        ? prev.timeBlocks.map(b => b.id === block.id ? block : b)
        : [...prev.timeBlocks, block]
    }));
  }, [roomCode]);

  const addTodo = useCallback((todo: Todo) => {
    if (roomCode) {
      const ref = doc(db, 'rooms', roomCode, 'todos', todo.id);
      setDoc(ref, todo);
    }
    localStore.addTodo(todo);
    setData(prev => ({ ...prev, todos: [...prev.todos, todo] }));
  }, [roomCode]);

  const updateTodo = useCallback((todo: Todo) => {
    if (roomCode) {
      const ref = doc(db, 'rooms', roomCode, 'todos', todo.id);
      setDoc(ref, todo);
    }
    localStore.updateTodo(todo);
    setData(prev => ({
      ...prev,
      todos: prev.todos.map(t => t.id === todo.id ? todo : t)
    }));
  }, [roomCode]);

  const deleteTodo = useCallback((id: string) => {
    if (roomCode) {
      const ref = doc(db, 'rooms', roomCode, 'todos', id);
      deleteDoc(ref);
    }
    localStore.deleteTodo(id);
    setData(prev => ({
      ...prev,
      todos: prev.todos.filter(t => t.id !== id)
    }));
  }, [roomCode]);

  const addEvent = useCallback((event: Event) => {
    if (roomCode) {
      const ref = doc(db, 'rooms', roomCode, 'events', event.id);
      setDoc(ref, event);
    }
    localStore.addEvent(event);
    setData(prev => ({ ...prev, events: [...prev.events, event] }));
  }, [roomCode]);

  const updateEvent = useCallback((event: Event) => {
    if (roomCode) {
      const ref = doc(db, 'rooms', roomCode, 'events', event.id);
      setDoc(ref, event);
    }
    localStore.updateEvent(event);
    setData(prev => ({
      ...prev,
      events: prev.events.map(e => e.id === event.id ? event : e)
    }));
  }, [roomCode]);

  const deleteEvent = useCallback((id: string) => {
    if (roomCode) {
      const ref = doc(db, 'rooms', roomCode, 'events', id);
      deleteDoc(ref);
    }
    localStore.deleteEvent(id);
    setData(prev => ({
      ...prev,
      events: prev.events.filter(e => e.id !== id)
    }));
  }, [roomCode]);

  const addWeeklyGoal = useCallback((goal: WeeklyGoal) => {
    if (roomCode) {
      const ref = doc(db, 'rooms', roomCode, 'weeklyGoals', goal.id);
      setDoc(ref, goal);
    }
    localStore.addWeeklyGoal(goal);
    setData(prev => ({ ...prev, weeklyGoals: [...prev.weeklyGoals, goal] }));
  }, [roomCode]);

  const updateWeeklyGoal = useCallback((goal: WeeklyGoal) => {
    if (roomCode) {
      const ref = doc(db, 'rooms', roomCode, 'weeklyGoals', goal.id);
      setDoc(ref, goal);
    }
    localStore.updateWeeklyGoal(goal);
    setData(prev => ({
      ...prev,
      weeklyGoals: prev.weeklyGoals.map(g => g.id === goal.id ? goal : g)
    }));
  }, [roomCode]);

  const deleteWeeklyGoal = useCallback((id: string) => {
    if (roomCode) {
      const ref = doc(db, 'rooms', roomCode, 'weeklyGoals', id);
      deleteDoc(ref);
    }
    localStore.deleteWeeklyGoal(id);
    setData(prev => ({
      ...prev,
      weeklyGoals: prev.weeklyGoals.filter(g => g.id !== id)
    }));
  }, [roomCode]);

  return (
    <FirebaseContext.Provider value={{
      isConnected,
      roomCode,
      createRoom,
      joinRoom,
      leaveRoom,
      data,
      updateCategories,
      updateTimeBlock,
      addTodo,
      updateTodo,
      deleteTodo,
      addEvent,
      updateEvent,
      deleteEvent,
      addWeeklyGoal,
      updateWeeklyGoal,
      deleteWeeklyGoal,
    }}>
      {children}
    </FirebaseContext.Provider>
  );
}

export function useFirebase() {
  const context = useContext(FirebaseContext);
  if (!context) {
    throw new Error('useFirebase must be used within a FirebaseProvider');
  }
  return context;
}

