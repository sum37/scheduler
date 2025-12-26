export interface User {
  id: string;
  name: string;
  color: string;
}

export interface Category {
  id: string;
  name: string;
  color: string;
  icon: string;
}

export interface TimeBlock {
  id: string;
  date: string; // YYYY-MM-DD
  hour: number; // 0-47 (30분 단위)
  categoryId: string | null;
  note: string;
  userId?: string;
  userName?: string;
  userColor?: string;
}

export interface Todo {
  id: string;
  date: string; // YYYY-MM-DD
  text: string;
  completed: boolean;
  order: number;
  userId?: string;
  userName?: string;
  userColor?: string;
}

export interface Event {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  time?: string;
  note?: string;
  userId?: string;
  userName?: string;
  userColor?: string;
}

export interface WeeklyGoal {
  id: string;
  weekStart: string; // YYYY-MM-DD (Monday)
  text: string;
  completed: boolean;
  order: number;
  userId?: string;
  userName?: string;
  userColor?: string;
}

export type ViewType = 'daily' | 'weekly' | 'monthly' | 'stats';
