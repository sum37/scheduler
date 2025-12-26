export interface Category {
  id: string;
  name: string;
  color: string;
  icon: string;
}

export interface TimeBlock {
  id: string;
  date: string; // YYYY-MM-DD
  hour: number; // 0-23
  categoryId: string | null;
  note: string;
}

export interface Todo {
  id: string;
  date: string; // YYYY-MM-DD
  text: string;
  completed: boolean;
  order: number;
}

export interface Event {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  time?: string;
  note?: string;
}

export interface WeeklyGoal {
  id: string;
  weekStart: string; // YYYY-MM-DD (Monday)
  text: string;
  completed: boolean;
  order: number;
}

export type ViewType = 'daily' | 'weekly' | 'monthly' | 'stats';

