import { Category, TimeBlock, Todo, Event, WeeklyGoal } from './types';

const STORAGE_KEYS = {
  categories: 'planner_categories',
  timeBlocks: 'planner_timeBlocks',
  todos: 'planner_todos',
  events: 'planner_events',
  weeklyGoals: 'planner_weeklyGoals',
};

// Default categories
const defaultCategories: Category[] = [
  { id: 'work', name: '업무', color: '#e74c3c', icon: '💼' },
  { id: 'study', name: '공부', color: '#3498db', icon: '📚' },
  { id: 'exercise', name: '운동', color: '#2ecc71', icon: '🏃' },
  { id: 'rest', name: '휴식', color: '#9b59b6', icon: '☕' },
  { id: 'hobby', name: '취미', color: '#f39c12', icon: '🎨' },
  { id: 'social', name: '사교', color: '#1abc9c', icon: '👥' },
  { id: 'errands', name: '잡무', color: '#95a5a6', icon: '📋' },
  { id: 'sleep', name: '수면', color: '#34495e', icon: '😴' },
];

function loadFromStorage<T>(key: string, defaultValue: T): T {
  try {
    const stored = localStorage.getItem(key);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error(`Error loading ${key}:`, e);
  }
  return defaultValue;
}

function saveToStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error(`Error saving ${key}:`, e);
  }
}

// Categories
export function getCategories(): Category[] {
  return loadFromStorage(STORAGE_KEYS.categories, defaultCategories);
}

export function saveCategories(categories: Category[]): void {
  saveToStorage(STORAGE_KEYS.categories, categories);
}

// Time Blocks
export function getTimeBlocks(): TimeBlock[] {
  return loadFromStorage(STORAGE_KEYS.timeBlocks, []);
}

export function saveTimeBlocks(blocks: TimeBlock[]): void {
  saveToStorage(STORAGE_KEYS.timeBlocks, blocks);
}

export function getTimeBlocksForDate(date: string): TimeBlock[] {
  const blocks = getTimeBlocks();
  return blocks.filter(b => b.date === date);
}

export function updateTimeBlock(block: TimeBlock): void {
  const blocks = getTimeBlocks();
  const index = blocks.findIndex(b => b.id === block.id);
  if (index >= 0) {
    blocks[index] = block;
  } else {
    blocks.push(block);
  }
  saveTimeBlocks(blocks);
}

// Todos
export function getTodos(): Todo[] {
  return loadFromStorage(STORAGE_KEYS.todos, []);
}

export function saveTodos(todos: Todo[]): void {
  saveToStorage(STORAGE_KEYS.todos, todos);
}

export function getTodosForDate(date: string): Todo[] {
  const todos = getTodos();
  return todos.filter(t => t.date === date).sort((a, b) => a.order - b.order);
}

export function addTodo(todo: Todo): void {
  const todos = getTodos();
  todos.push(todo);
  saveTodos(todos);
}

export function updateTodo(todo: Todo): void {
  const todos = getTodos();
  const index = todos.findIndex(t => t.id === todo.id);
  if (index >= 0) {
    todos[index] = todo;
    saveTodos(todos);
  }
}

export function deleteTodo(id: string): void {
  const todos = getTodos();
  saveTodos(todos.filter(t => t.id !== id));
}

// Events
export function getEvents(): Event[] {
  return loadFromStorage(STORAGE_KEYS.events, []);
}

export function saveEvents(events: Event[]): void {
  saveToStorage(STORAGE_KEYS.events, events);
}

export function getEventsForDate(date: string): Event[] {
  const events = getEvents();
  return events.filter(e => e.date === date);
}

export function getEventsForMonth(year: number, month: number): Event[] {
  const events = getEvents();
  const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;
  return events.filter(e => e.date.startsWith(prefix));
}

export function addEvent(event: Event): void {
  const events = getEvents();
  events.push(event);
  saveEvents(events);
}

export function updateEvent(event: Event): void {
  const events = getEvents();
  const index = events.findIndex(e => e.id === event.id);
  if (index >= 0) {
    events[index] = event;
    saveEvents(events);
  }
}

export function deleteEvent(id: string): void {
  const events = getEvents();
  saveEvents(events.filter(e => e.id !== id));
}

// Weekly Goals
export function getWeeklyGoals(): WeeklyGoal[] {
  return loadFromStorage(STORAGE_KEYS.weeklyGoals, []);
}

export function saveWeeklyGoals(goals: WeeklyGoal[]): void {
  saveToStorage(STORAGE_KEYS.weeklyGoals, goals);
}

export function getWeeklyGoalsForWeek(weekStart: string): WeeklyGoal[] {
  const goals = getWeeklyGoals();
  return goals.filter(g => g.weekStart === weekStart).sort((a, b) => a.order - b.order);
}

export function addWeeklyGoal(goal: WeeklyGoal): void {
  const goals = getWeeklyGoals();
  goals.push(goal);
  saveWeeklyGoals(goals);
}

export function updateWeeklyGoal(goal: WeeklyGoal): void {
  const goals = getWeeklyGoals();
  const index = goals.findIndex(g => g.id === goal.id);
  if (index >= 0) {
    goals[index] = goal;
    saveWeeklyGoals(goals);
  }
}

export function deleteWeeklyGoal(id: string): void {
  const goals = getWeeklyGoals();
  saveWeeklyGoals(goals.filter(g => g.id !== id));
}

// Stats (30분 단위, 2슬롯 = 1시간)
export function getWeeklyStats(weekStart: string): { categoryId: string; hours: number }[] {
  const blocks = getTimeBlocks();
  const startDate = new Date(weekStart);
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 7);

  const weekBlocks = blocks.filter(b => {
    const blockDate = new Date(b.date);
    return blockDate >= startDate && blockDate < endDate && b.categoryId;
  });

  const stats: Record<string, number> = {};
  weekBlocks.forEach(block => {
    if (block.categoryId) {
      // 30분 단위이므로 0.5시간씩 추가
      stats[block.categoryId] = (stats[block.categoryId] || 0) + 0.5;
    }
  });

  return Object.entries(stats).map(([categoryId, hours]) => ({ categoryId, hours }));
}

