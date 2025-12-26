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
import { User, Category, TimeBlock, Todo, Event, WeeklyGoal } from './types';
import * as localStore from './store';

// 사용자 색상 옵션
const USER_COLORS = [
  '#6ea89e', // 민트 (기본)
  '#e8a87c', // 살구
  '#c38d9e', // 로즈
  '#41b3a3', // 틸
  '#e27d60', // 코랄
  '#85cdca', // 아쿠아
];

interface CalendarData {
  categories: Category[];
  timeBlocks: TimeBlock[];
  todos: Todo[];
  events: Event[];
  weeklyGoals: WeeklyGoal[];
}

interface FirebaseContextType {
  // 사용자 정보
  currentUser: User | null;
  setUserName: (name: string) => void;
  
  // 연결 상태
  isConnected: boolean;
  roomCode: string | null;
  roomUsers: User[];
  
  // 룸 관리
  createRoom: () => Promise<string>;
  joinRoom: (code: string) => Promise<boolean>;
  leaveRoom: () => void;
  
  // 데이터 (모든 사용자의 데이터)
  data: CalendarData;
  
  // 데이터 조작 (현재 사용자 데이터만)
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

// 랜덤 사용자 ID 생성
function generateUserId(): string {
  return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// 로컬 스토리지 키
const ROOM_CODE_KEY = 'calendar_room_code';
const USER_ID_KEY = 'calendar_user_id';
const USER_NAME_KEY = 'calendar_user_name';
const USER_COLOR_KEY = 'calendar_user_color';

export function FirebaseProvider({ children }: { children: ReactNode }) {
  // 사용자 정보
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const id = localStorage.getItem(USER_ID_KEY);
    const name = localStorage.getItem(USER_NAME_KEY) || localStorage.getItem('userName') || '';
    const color = localStorage.getItem(USER_COLOR_KEY) || USER_COLORS[0];
    
    if (id) {
      return { id, name, color };
    }
    
    // 새 사용자 ID 생성
    const newId = generateUserId();
    const newColor = USER_COLORS[Math.floor(Math.random() * USER_COLORS.length)];
    localStorage.setItem(USER_ID_KEY, newId);
    localStorage.setItem(USER_COLOR_KEY, newColor);
    return { id: newId, name, color: newColor };
  });
  
  const [isConnected, setIsConnected] = useState(false);
  const [roomCode, setRoomCode] = useState<string | null>(() => {
    return localStorage.getItem(ROOM_CODE_KEY);
  });
  const [roomUsers, setRoomUsers] = useState<User[]>([]);
  
  const [data, setData] = useState<CalendarData>({
    categories: localStore.getCategories(),
    timeBlocks: localStore.getTimeBlocks(),
    todos: localStore.getTodos(),
    events: localStore.getEvents(),
    weeklyGoals: localStore.getWeeklyGoals(),
  });

  // 사용자 이름 설정
  const setUserName = useCallback((name: string) => {
    localStorage.setItem(USER_NAME_KEY, name);
    localStorage.setItem('userName', name);
    setCurrentUser(prev => prev ? { ...prev, name } : null);
    
    // Firebase에 사용자 정보 업데이트
    if (roomCode && currentUser) {
      const userRef = doc(db, 'rooms', roomCode, 'users', currentUser.id);
      setDoc(userRef, { ...currentUser, name }, { merge: true });
    }
  }, [roomCode, currentUser]);

  // Firebase 실시간 리스너 설정
  useEffect(() => {
    if (!roomCode || !currentUser) {
      setIsConnected(false);
      return;
    }

    const unsubscribers: Unsubscribe[] = [];

    try {
      // 현재 사용자를 room에 등록
      const userRef = doc(db, 'rooms', roomCode, 'users', currentUser.id);
      setDoc(userRef, currentUser, { merge: true });
      
      // Users 리스너
      const usersRef = collection(db, 'rooms', roomCode, 'users');
      unsubscribers.push(
        onSnapshot(query(usersRef), (snapshot) => {
          const users = snapshot.docs.map(doc => doc.data() as User);
          setRoomUsers(users);
        }, (error) => {
          console.error('Users listener error:', error);
        })
      );

      // Categories 리스너
      const categoriesRef = collection(db, 'rooms', roomCode, 'categories');
      unsubscribers.push(
        onSnapshot(query(categoriesRef), (snapshot) => {
          if (!snapshot.empty) {
            const categories = snapshot.docs.map(doc => doc.data() as Category);
            setData(prev => ({ ...prev, categories }));
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
  }, [roomCode, currentUser]);

  // 새 룸 생성
  const createRoom = useCallback(async (): Promise<string> => {
    if (!currentUser) throw new Error('User not initialized');
    
    const code = generateRoomCode();
    const batch = writeBatch(db);
    
    // 사용자 등록
    const userRef = doc(db, 'rooms', code, 'users', currentUser.id);
    batch.set(userRef, currentUser);
    
    // Categories 업로드
    data.categories.forEach(cat => {
      const ref = doc(db, 'rooms', code, 'categories', cat.id);
      batch.set(ref, cat);
    });
    
    // 기존 로컬 데이터에 userId 추가하여 업로드
    data.timeBlocks.forEach(block => {
      const ref = doc(db, 'rooms', code, 'timeBlocks', block.id);
      batch.set(ref, { 
        ...block, 
        userId: currentUser.id,
        userName: currentUser.name,
        userColor: currentUser.color
      });
    });
    
    data.todos.forEach(todo => {
      const ref = doc(db, 'rooms', code, 'todos', todo.id);
      batch.set(ref, { 
        ...todo, 
        userId: currentUser.id,
        userName: currentUser.name,
        userColor: currentUser.color
      });
    });
    
    data.events.forEach(event => {
      const ref = doc(db, 'rooms', code, 'events', event.id);
      batch.set(ref, { 
        ...event, 
        userId: currentUser.id,
        userName: currentUser.name,
        userColor: currentUser.color
      });
    });
    
    data.weeklyGoals.forEach(goal => {
      const ref = doc(db, 'rooms', code, 'weeklyGoals', goal.id);
      batch.set(ref, { 
        ...goal, 
        userId: currentUser.id,
        userName: currentUser.name,
        userColor: currentUser.color
      });
    });
    
    await batch.commit();
    
    setRoomCode(code);
    localStorage.setItem(ROOM_CODE_KEY, code);
    
    return code;
  }, [data, currentUser]);

  // 룸 참가
  const joinRoom = useCallback(async (code: string): Promise<boolean> => {
    if (!currentUser) return false;
    
    try {
      const normalizedCode = code.toUpperCase().replace(/\s/g, '');
      
      // 사용자를 room에 등록
      const userRef = doc(db, 'rooms', normalizedCode, 'users', currentUser.id);
      await setDoc(userRef, currentUser);
      
      setRoomCode(normalizedCode);
      localStorage.setItem(ROOM_CODE_KEY, normalizedCode);
      
      return true;
    } catch (error) {
      console.error('Join room error:', error);
      return false;
    }
  }, [currentUser]);

  // 룸 나가기
  const leaveRoom = useCallback(() => {
    setRoomCode(null);
    localStorage.removeItem(ROOM_CODE_KEY);
    setIsConnected(false);
    setRoomUsers([]);
    
    setData({
      categories: localStore.getCategories(),
      timeBlocks: localStore.getTimeBlocks(),
      todos: localStore.getTodos(),
      events: localStore.getEvents(),
      weeklyGoals: localStore.getWeeklyGoals(),
    });
  }, []);

  // 데이터 조작 함수들 (사용자 정보 포함)
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
    if (!currentUser) return;
    
    const blockWithUser = {
      ...block,
      userId: currentUser.id,
      userName: currentUser.name,
      userColor: currentUser.color,
    };
    
    if (roomCode) {
      const ref = doc(db, 'rooms', roomCode, 'timeBlocks', block.id);
      setDoc(ref, blockWithUser);
    }
    localStore.updateTimeBlock(block);
    setData(prev => ({
      ...prev,
      timeBlocks: prev.timeBlocks.some(b => b.id === block.id)
        ? prev.timeBlocks.map(b => b.id === block.id ? blockWithUser : b)
        : [...prev.timeBlocks, blockWithUser]
    }));
  }, [roomCode, currentUser]);

  const addTodo = useCallback((todo: Todo) => {
    if (!currentUser) return;
    
    const todoWithUser = {
      ...todo,
      userId: currentUser.id,
      userName: currentUser.name,
      userColor: currentUser.color,
    };
    
    if (roomCode) {
      const ref = doc(db, 'rooms', roomCode, 'todos', todo.id);
      setDoc(ref, todoWithUser);
    }
    localStore.addTodo(todo);
    setData(prev => ({ ...prev, todos: [...prev.todos, todoWithUser] }));
  }, [roomCode, currentUser]);

  const updateTodo = useCallback((todo: Todo) => {
    if (!currentUser) return;
    
    const todoWithUser = {
      ...todo,
      userId: todo.userId || currentUser.id,
      userName: todo.userName || currentUser.name,
      userColor: todo.userColor || currentUser.color,
    };
    
    if (roomCode) {
      const ref = doc(db, 'rooms', roomCode, 'todos', todo.id);
      setDoc(ref, todoWithUser);
    }
    localStore.updateTodo(todo);
    setData(prev => ({
      ...prev,
      todos: prev.todos.map(t => t.id === todo.id ? todoWithUser : t)
    }));
  }, [roomCode, currentUser]);

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
    if (!currentUser) return;
    
    const eventWithUser = {
      ...event,
      userId: currentUser.id,
      userName: currentUser.name,
      userColor: currentUser.color,
    };
    
    if (roomCode) {
      const ref = doc(db, 'rooms', roomCode, 'events', event.id);
      setDoc(ref, eventWithUser);
    }
    localStore.addEvent(event);
    setData(prev => ({ ...prev, events: [...prev.events, eventWithUser] }));
  }, [roomCode, currentUser]);

  const updateEvent = useCallback((event: Event) => {
    if (!currentUser) return;
    
    const eventWithUser = {
      ...event,
      userId: event.userId || currentUser.id,
      userName: event.userName || currentUser.name,
      userColor: event.userColor || currentUser.color,
    };
    
    if (roomCode) {
      const ref = doc(db, 'rooms', roomCode, 'events', event.id);
      setDoc(ref, eventWithUser);
    }
    localStore.updateEvent(event);
    setData(prev => ({
      ...prev,
      events: prev.events.map(e => e.id === event.id ? eventWithUser : e)
    }));
  }, [roomCode, currentUser]);

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
    if (!currentUser) return;
    
    const goalWithUser = {
      ...goal,
      userId: currentUser.id,
      userName: currentUser.name,
      userColor: currentUser.color,
    };
    
    if (roomCode) {
      const ref = doc(db, 'rooms', roomCode, 'weeklyGoals', goal.id);
      setDoc(ref, goalWithUser);
    }
    localStore.addWeeklyGoal(goal);
    setData(prev => ({ ...prev, weeklyGoals: [...prev.weeklyGoals, goalWithUser] }));
  }, [roomCode, currentUser]);

  const updateWeeklyGoal = useCallback((goal: WeeklyGoal) => {
    if (!currentUser) return;
    
    const goalWithUser = {
      ...goal,
      userId: goal.userId || currentUser.id,
      userName: goal.userName || currentUser.name,
      userColor: goal.userColor || currentUser.color,
    };
    
    if (roomCode) {
      const ref = doc(db, 'rooms', roomCode, 'weeklyGoals', goal.id);
      setDoc(ref, goalWithUser);
    }
    localStore.updateWeeklyGoal(goal);
    setData(prev => ({
      ...prev,
      weeklyGoals: prev.weeklyGoals.map(g => g.id === goal.id ? goalWithUser : g)
    }));
  }, [roomCode, currentUser]);

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
      currentUser,
      setUserName,
      isConnected,
      roomCode,
      roomUsers,
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
