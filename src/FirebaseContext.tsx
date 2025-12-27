import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { 
  collection, 
  doc, 
  onSnapshot, 
  setDoc, 
  deleteDoc,
  getDocs,
  writeBatch,
  query,
  where,
  Unsubscribe
} from 'firebase/firestore';
import { db } from './firebase';
import { User, Category, TimeBlock, Todo, Event, WeeklyGoal } from './types';
import * as localStore from './store';

// 테마별 색상 매핑
const THEME_COLORS: Record<string, string> = {
  mint: '#6ea89e',
  pink: '#c97390',
  blue: '#6a9ec9',
  yellow: '#c9a86a',
  purple: '#a06ac4',
};

// 기본 색상 (민트)
const DEFAULT_COLOR = '#6ea89e';

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
  login: (name: string) => Promise<{ success: boolean; error?: string }>;
  register: (name: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  updateUserColor: (themeId: string) => void;
  
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
  // 사용자 정보 (로컬 스토리지에서 복원)
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const id = localStorage.getItem(USER_ID_KEY);
    const name = localStorage.getItem(USER_NAME_KEY);
    const color = localStorage.getItem(USER_COLOR_KEY);
    
    // 모든 정보가 있어야 로그인 상태
    if (id && name && color) {
      return { id, name, color };
    }
    
    return null;
  });
  
  const [isConnected, setIsConnected] = useState(false);
  const [roomCode, setRoomCode] = useState<string | null>(() => {
    return localStorage.getItem(ROOM_CODE_KEY);
  });
  const [roomUsers, setRoomUsers] = useState<User[]>([]);
  
  const [data, setData] = useState<CalendarData>({
    categories: [],
    timeBlocks: [],
    todos: [],
    events: [],
    weeklyGoals: [],
  });
  
  // 공유 데이터를 별도로 저장 (타인의 데이터 유지용)
  const sharedDataRef = useRef<{ timeBlocks: TimeBlock[]; events: Event[] }>({
    timeBlocks: [],
    events: [],
  });

  // 회원가입
  const register = useCallback(async (name: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const normalizedName = name.trim().toLowerCase();
      
      // 이름 중복 체크
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('normalizedName', '==', normalizedName));
      const snapshot = await getDocs(q);
      
      if (!snapshot.empty) {
        return { success: false, error: '이미 사용 중인 이름입니다' };
      }
      
      // 새 사용자 생성
      const newId = generateUserId();
      // 저장된 테마에서 색상 가져오기 (없으면 기본 민트)
      const savedTheme = localStorage.getItem('calendar_theme') || 'mint';
      const newColor = THEME_COLORS[savedTheme] || DEFAULT_COLOR;
      const newUser: User & { normalizedName: string; createdAt: number } = {
        id: newId,
        name: name.trim(),
        color: newColor,
        normalizedName,
        createdAt: Date.now(),
      };
      
      // Firebase에 사용자 정보 저장
      await setDoc(doc(db, 'users', newId), newUser);
      
      // 기본 카테고리 저장
      const defaultCategories = localStore.getCategories();
      for (const cat of defaultCategories) {
        await setDoc(doc(db, 'userData', newId, 'categories', cat.id), cat);
      }
      
      // 로컬 스토리지에 저장
      localStorage.setItem(USER_ID_KEY, newId);
      localStorage.setItem(USER_NAME_KEY, name.trim());
      localStorage.setItem(USER_COLOR_KEY, newColor);
      
      // 새 계정은 공유 상태 초기화!
      localStorage.removeItem(ROOM_CODE_KEY);
      setRoomCode(null);
      setRoomUsers([]);
      
      setCurrentUser({ id: newId, name: name.trim(), color: newColor });
      
      return { success: true };
    } catch (error) {
      console.error('Register error:', error);
      return { success: false, error: 'Firebase 연결 오류' };
    }
  }, []);

  // 로그인
  const login = useCallback(async (name: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const normalizedName = name.trim().toLowerCase();
      
      // Firebase에서 사용자 찾기
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('normalizedName', '==', normalizedName));
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        return { success: false, error: '등록되지 않은 이름입니다' };
      }
      
      const userData = snapshot.docs[0].data();
      const user: User = {
        id: userData.id,
        name: userData.name,
        color: userData.color,
      };
      
      // 로컬 스토리지에 저장
      localStorage.setItem(USER_ID_KEY, user.id);
      localStorage.setItem(USER_NAME_KEY, user.name);
      localStorage.setItem(USER_COLOR_KEY, user.color);
      
      setCurrentUser(user);
      
      return { success: true };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: 'Firebase 연결 오류' };
    }
  }, []);

  // 로그아웃 (사용자 정보만 삭제, 공유 상태는 유지)
  const logout = useCallback(async () => {
    // 로컬 스토리지에서 사용자 정보만 초기화 (roomCode는 유지!)
    localStorage.removeItem(USER_ID_KEY);
    localStorage.removeItem(USER_NAME_KEY);
    localStorage.removeItem(USER_COLOR_KEY);
    // localStorage.removeItem(ROOM_CODE_KEY); // 공유 상태 유지를 위해 삭제하지 않음
    
    // 상태 초기화 (roomCode는 유지)
    setCurrentUser(null);
    // setRoomCode(null); // 공유 상태 유지
    setIsConnected(false);
    setRoomUsers([]);
    setData({
      categories: [],
      timeBlocks: [],
      todos: [],
      events: [],
      weeklyGoals: [],
    });
  }, []);

  // 사용자 색상 업데이트 (테마 변경 시)
  const updateUserColor = useCallback(async (themeId: string) => {
    const newColor = THEME_COLORS[themeId] || DEFAULT_COLOR;
    
    // 로컬 스토리지 업데이트
    localStorage.setItem(USER_COLOR_KEY, newColor);
    
    // 현재 사용자 상태 업데이트
    if (currentUser) {
      const updatedUser = { ...currentUser, color: newColor };
      setCurrentUser(updatedUser);
      
      // Firebase 사용자 정보 업데이트
      try {
        await setDoc(doc(db, 'users', currentUser.id), {
          id: currentUser.id,
          name: currentUser.name,
          color: newColor,
          normalizedName: currentUser.name.toLowerCase(),
        }, { merge: true });
      } catch (error) {
        console.error('Error updating user color in Firebase:', error);
      }
    }
  }, [currentUser]);

  // 개인 데이터 Firebase 리스너 (로그인 시)
  useEffect(() => {
    if (!currentUser) {
      return;
    }

    console.log('[Firebase] Setting up personal data listeners for:', currentUser.id);
    const unsubscribers: Unsubscribe[] = [];
    const userId = currentUser.id;

    try {
      // Categories 리스너
      const categoriesRef = collection(db, 'userData', userId, 'categories');
      unsubscribers.push(
        onSnapshot(query(categoriesRef), (snapshot) => {
          const categories = snapshot.docs.map(doc => doc.data() as Category);
          console.log('[Firebase] Categories loaded:', categories.length);
          setData(prev => ({ ...prev, categories: categories.length > 0 ? categories : localStore.getCategories() }));
        }, (error) => {
          console.error('Categories listener error:', error);
        })
      );

      // TimeBlocks 리스너
      const timeBlocksRef = collection(db, 'userData', userId, 'timeBlocks');
      unsubscribers.push(
        onSnapshot(query(timeBlocksRef), (snapshot) => {
          const timeBlocks = snapshot.docs.map(doc => doc.data() as TimeBlock);
          console.log('[Firebase] TimeBlocks loaded:', timeBlocks.length);
          setData(prev => ({ ...prev, timeBlocks }));
        }, (error) => {
          console.error('TimeBlocks listener error:', error);
        })
      );

      // Todos 리스너
      const todosRef = collection(db, 'userData', userId, 'todos');
      unsubscribers.push(
        onSnapshot(query(todosRef), (snapshot) => {
          const todos = snapshot.docs.map(doc => doc.data() as Todo);
          console.log('[Firebase] Todos loaded:', todos.length);
          setData(prev => ({ ...prev, todos }));
        }, (error) => {
          console.error('Todos listener error:', error);
        })
      );

      // Events 리스너
      const eventsRef = collection(db, 'userData', userId, 'events');
      unsubscribers.push(
        onSnapshot(query(eventsRef), (snapshot) => {
          const events = snapshot.docs.map(doc => doc.data() as Event);
          console.log('[Firebase] Events loaded:', events.length);
          setData(prev => ({ ...prev, events }));
        }, (error) => {
          console.error('Events listener error:', error);
        })
      );

      // WeeklyGoals 리스너
      const weeklyGoalsRef = collection(db, 'userData', userId, 'weeklyGoals');
      unsubscribers.push(
        onSnapshot(query(weeklyGoalsRef), (snapshot) => {
          const weeklyGoals = snapshot.docs.map(doc => doc.data() as WeeklyGoal);
          console.log('[Firebase] WeeklyGoals loaded:', weeklyGoals.length);
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
      console.log('[Firebase] Cleaning up personal data listeners');
      unsubscribers.forEach(unsub => unsub());
    };
  }, [currentUser]);

  // 공유 방 리스너 (방 코드가 있을 때)
  useEffect(() => {
    if (!roomCode || !currentUser) {
      setRoomUsers([]);
      return;
    }

    console.log('[Firebase] Setting up room listeners for:', roomCode);
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
          console.log('[Firebase] Room users:', users.length);
          setRoomUsers(users);
        }, (error) => {
          console.error('Users listener error:', error);
        })
      );
    } catch (error) {
      console.error('Room connection error:', error);
    }

    return () => {
      console.log('[Firebase] Cleaning up room listeners');
      unsubscribers.forEach(unsub => unsub());
    };
  }, [roomCode, currentUser]);

  // 공유 사용자들의 데이터 리스너 (timeBlocks, events만 공유)
  useEffect(() => {
    if (!currentUser || roomUsers.length === 0) {
      return;
    }

    // 나를 제외한 다른 사용자들
    const otherUsers = roomUsers.filter(u => u.id !== currentUser.id);
    if (otherUsers.length === 0) {
      return;
    }

    console.log('[Firebase] Setting up shared data listeners for:', otherUsers.map(u => u.name));
    const unsubscribers: Unsubscribe[] = [];
    
    // 각 사용자별 데이터를 저장 (timeBlocks, events만)
    const sharedDataMap: { [userId: string]: { timeBlocks: TimeBlock[]; events: Event[] } } = {};

    const updateSharedData = () => {
      // 모든 공유 사용자의 데이터를 병합 (timeBlocks, events만)
      const allSharedTimeBlocks: TimeBlock[] = [];
      const allSharedEvents: Event[] = [];

      Object.values(sharedDataMap).forEach(userData => {
        allSharedTimeBlocks.push(...userData.timeBlocks);
        allSharedEvents.push(...userData.events);
      });

      // ref에 공유 데이터 저장 (updateTimeBlock에서 참조용)
      sharedDataRef.current = {
        timeBlocks: allSharedTimeBlocks,
        events: allSharedEvents,
      };

      setData(prev => ({
        ...prev,
        // 내 데이터 + 공유 데이터 병합 (timeBlocks, events만)
        timeBlocks: [
          ...prev.timeBlocks.filter(b => b.userId === currentUser.id),
          ...allSharedTimeBlocks
        ],
        events: [
          ...prev.events.filter(e => e.userId === currentUser.id),
          ...allSharedEvents
        ],
        // todos, weeklyGoals는 공유하지 않음 (개인 데이터만)
      }));
    };

    otherUsers.forEach(user => {
      // 초기화
      sharedDataMap[user.id] = { timeBlocks: [], events: [] };

      // TimeBlocks 리스너 (공유됨)
      const timeBlocksRef = collection(db, 'userData', user.id, 'timeBlocks');
      unsubscribers.push(
        onSnapshot(query(timeBlocksRef), (snapshot) => {
          sharedDataMap[user.id].timeBlocks = snapshot.docs.map(doc => doc.data() as TimeBlock);
          console.log(`[Firebase] Shared TimeBlocks from ${user.name}:`, sharedDataMap[user.id].timeBlocks.length);
          updateSharedData();
        }, (error) => {
          console.error(`TimeBlocks listener error for ${user.name}:`, error);
        })
      );

      // Events 리스너 (공유됨)
      const eventsRef = collection(db, 'userData', user.id, 'events');
      unsubscribers.push(
        onSnapshot(query(eventsRef), (snapshot) => {
          sharedDataMap[user.id].events = snapshot.docs.map(doc => doc.data() as Event);
          console.log(`[Firebase] Shared Events from ${user.name}:`, sharedDataMap[user.id].events.length);
          updateSharedData();
        }, (error) => {
          console.error(`Events listener error for ${user.name}:`, error);
        })
      );

      // Todos, WeeklyGoals는 공유하지 않음 (개인 데이터)
    });

    return () => {
      console.log('[Firebase] Cleaning up shared data listeners');
      unsubscribers.forEach(unsub => unsub());
    };
  }, [currentUser, roomUsers]);

  // 새 룸 생성
  const createRoom = useCallback(async (): Promise<string> => {
    if (!currentUser) throw new Error('User not initialized');
    
    const code = generateRoomCode();
    
    // 사용자 등록
    const userRef = doc(db, 'rooms', code, 'users', currentUser.id);
    await setDoc(userRef, currentUser);
    
    setRoomCode(code);
    localStorage.setItem(ROOM_CODE_KEY, code);
    
    return code;
  }, [currentUser]);

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
  const leaveRoom = useCallback(async () => {
    // Firebase에서 사용자 삭제 (다른 사용자에게 알림)
    if (roomCode && currentUser) {
      try {
        const userRef = doc(db, 'rooms', roomCode, 'users', currentUser.id);
        await deleteDoc(userRef);
        console.log('[Firebase] User removed from room');
      } catch (error) {
        console.error('[Firebase] Error removing user:', error);
      }
    }
    
    setRoomCode(null);
    localStorage.removeItem(ROOM_CODE_KEY);
    setRoomUsers([]);
  }, [roomCode, currentUser]);

  // 데이터 조작 함수들 (사용자 정보 포함, Firebase에 저장)
  const updateCategories = useCallback((categories: Category[]) => {
    if (!currentUser) return;
    
    const batch = writeBatch(db);
    categories.forEach(cat => {
      const ref = doc(db, 'userData', currentUser.id, 'categories', cat.id);
      batch.set(ref, cat);
    });
    batch.commit();
    
    setData(prev => ({ ...prev, categories }));
  }, [currentUser]);

  const updateTimeBlock = useCallback((block: TimeBlock) => {
    if (!currentUser) return;
    
    const blockWithUser = {
      ...block,
      userId: currentUser.id,
      userName: currentUser.name,
      userColor: currentUser.color,
    };
    
    // 개인 데이터에 저장
    const ref = doc(db, 'userData', currentUser.id, 'timeBlocks', block.id);
    setDoc(ref, blockWithUser);
    
    setData(prev => {
      // prev에서 타인의 데이터 가져오기 (userId가 없거나 다른 사용자)
      const othersBlocksFromPrev = prev.timeBlocks.filter(
        b => b.userId && b.userId !== currentUser.id
      );
      
      // sharedDataRef에서도 가져오기 (더 최신일 수 있음)
      const othersBlocksFromRef = sharedDataRef.current.timeBlocks;
      
      // 둘 중 더 많은 쪽 사용 (데이터 유실 방지)
      const othersBlocks = othersBlocksFromRef.length >= othersBlocksFromPrev.length 
        ? othersBlocksFromRef 
        : othersBlocksFromPrev;
      
      // 내 데이터만 업데이트
      const myBlocks = prev.timeBlocks.filter(
        b => !b.userId || b.userId === currentUser.id
      );
      
      const updatedMyBlocks = myBlocks.some(b => b.id === block.id)
        ? myBlocks.map(b => b.id === block.id ? blockWithUser : b)
        : [...myBlocks, blockWithUser];
      
      return {
        ...prev,
        timeBlocks: [...updatedMyBlocks, ...othersBlocks]
      };
    });
  }, [currentUser]);

  const addTodo = useCallback((todo: Todo) => {
    if (!currentUser) return;
    
    const todoWithUser = {
      ...todo,
      userId: currentUser.id,
      userName: currentUser.name,
      userColor: currentUser.color,
    };
    
    // 개인 데이터에 저장
    const ref = doc(db, 'userData', currentUser.id, 'todos', todo.id);
    setDoc(ref, todoWithUser);
    
    setData(prev => ({ ...prev, todos: [...prev.todos, todoWithUser] }));
  }, [currentUser]);

  const updateTodo = useCallback((todo: Todo) => {
    if (!currentUser) return;
    
    const todoWithUser = {
      ...todo,
      userId: todo.userId || currentUser.id,
      userName: todo.userName || currentUser.name,
      userColor: todo.userColor || currentUser.color,
    };
    
    // 개인 데이터에 저장
    const ref = doc(db, 'userData', currentUser.id, 'todos', todo.id);
    setDoc(ref, todoWithUser);
    
    setData(prev => ({
      ...prev,
      todos: prev.todos.map(t => t.id === todo.id ? todoWithUser : t)
    }));
  }, [currentUser]);

  const deleteTodo = useCallback((id: string) => {
    if (!currentUser) return;
    
    // 개인 데이터에서 삭제
    const ref = doc(db, 'userData', currentUser.id, 'todos', id);
    deleteDoc(ref);
    
    setData(prev => ({
      ...prev,
      todos: prev.todos.filter(t => t.id !== id)
    }));
  }, [currentUser]);

  const addEvent = useCallback((event: Event) => {
    if (!currentUser) return;
    
    const eventWithUser = {
      ...event,
      userId: currentUser.id,
      userName: currentUser.name,
      userColor: currentUser.color,
    };
    
    // 개인 데이터에 저장
    const ref = doc(db, 'userData', currentUser.id, 'events', event.id);
    setDoc(ref, eventWithUser);
    
    setData(prev => {
      // prev에서 타인의 데이터 가져오기
      const othersEventsFromPrev = prev.events.filter(
        e => e.userId && e.userId !== currentUser.id
      );
      const othersEventsFromRef = sharedDataRef.current.events;
      const othersEvents = othersEventsFromRef.length >= othersEventsFromPrev.length 
        ? othersEventsFromRef 
        : othersEventsFromPrev;
      
      const myEvents = prev.events.filter(e => !e.userId || e.userId === currentUser.id);
      return { ...prev, events: [...myEvents, eventWithUser, ...othersEvents] };
    });
  }, [currentUser]);

  const updateEvent = useCallback((event: Event) => {
    if (!currentUser) return;
    
    const eventWithUser = {
      ...event,
      userId: event.userId || currentUser.id,
      userName: event.userName || currentUser.name,
      userColor: event.userColor || currentUser.color,
    };
    
    // 개인 데이터에 저장
    const ref = doc(db, 'userData', currentUser.id, 'events', event.id);
    setDoc(ref, eventWithUser);
    
    setData(prev => {
      // prev에서 타인의 데이터 가져오기
      const othersEventsFromPrev = prev.events.filter(
        e => e.userId && e.userId !== currentUser.id
      );
      const othersEventsFromRef = sharedDataRef.current.events;
      const othersEvents = othersEventsFromRef.length >= othersEventsFromPrev.length 
        ? othersEventsFromRef 
        : othersEventsFromPrev;
      
      // 내 데이터만 업데이트
      const myEvents = prev.events.filter(e => !e.userId || e.userId === currentUser.id);
      const updatedMyEvents = myEvents.map(e => e.id === event.id ? eventWithUser : e);
      return { ...prev, events: [...updatedMyEvents, ...othersEvents] };
    });
  }, [currentUser]);

  const deleteEvent = useCallback((id: string) => {
    if (!currentUser) return;
    
    // 개인 데이터에서 삭제
    const ref = doc(db, 'userData', currentUser.id, 'events', id);
    deleteDoc(ref);
    
    setData(prev => ({
      ...prev,
      events: prev.events.filter(e => e.id !== id)
    }));
  }, [currentUser]);

  const addWeeklyGoal = useCallback((goal: WeeklyGoal) => {
    if (!currentUser) return;
    
    const goalWithUser = {
      ...goal,
      userId: currentUser.id,
      userName: currentUser.name,
      userColor: currentUser.color,
    };
    
    // 개인 데이터에 저장
    const ref = doc(db, 'userData', currentUser.id, 'weeklyGoals', goal.id);
    setDoc(ref, goalWithUser);
    
    setData(prev => ({ ...prev, weeklyGoals: [...prev.weeklyGoals, goalWithUser] }));
  }, [currentUser]);

  const updateWeeklyGoal = useCallback((goal: WeeklyGoal) => {
    if (!currentUser) return;
    
    const goalWithUser = {
      ...goal,
      userId: goal.userId || currentUser.id,
      userName: goal.userName || currentUser.name,
      userColor: goal.userColor || currentUser.color,
    };
    
    // 개인 데이터에 저장
    const ref = doc(db, 'userData', currentUser.id, 'weeklyGoals', goal.id);
    setDoc(ref, goalWithUser);
    
    setData(prev => ({
      ...prev,
      weeklyGoals: prev.weeklyGoals.map(g => g.id === goal.id ? goalWithUser : g)
    }));
  }, [currentUser]);

  const deleteWeeklyGoal = useCallback((id: string) => {
    if (!currentUser) return;
    
    // 개인 데이터에서 삭제
    const ref = doc(db, 'userData', currentUser.id, 'weeklyGoals', id);
    deleteDoc(ref);
    
    setData(prev => ({
      ...prev,
      weeklyGoals: prev.weeklyGoals.filter(g => g.id !== id)
    }));
  }, [currentUser]);

  return (
    <FirebaseContext.Provider value={{
      currentUser,
      login,
      register,
      logout,
      updateUserColor,
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
