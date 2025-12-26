# My Time Planner 📅

나만의 시간 관리 앱 - PWA (Progressive Web App)

## 기능

### 1. 일별 보기 (오늘)
- **시간 블록**: 24시간을 시간 단위로 쪼개서 카테고리별로 색상을 지정
- **투두 리스트**: 매일 할 일을 작성하고 체크

### 2. 주간 보기
- 이번 주 7일을 한눈에 확인
- **주간 목표**: 이번 주에 해야 할 것들을 개괄적으로 작성
- 카테고리 범례

### 3. 월간 캘린더
- 월별 캘린더 보기
- 날짜를 탭하면 약속/일정을 추가할 수 있음
- 날짜를 더블탭하면 일별 보기로 이동

### 4. 주간 통계
- **카테고리별 시간 분석**: 해당 주에 각 카테고리에 몇 시간을 썼는지 확인
- 일별 현황
- 카테고리별 비율 (%)

## 카테고리
| 아이콘 | 이름 | 색상 |
|--------|------|------|
| 💼 | 업무 | 빨강 |
| 📚 | 공부 | 파랑 |
| 🏃 | 운동 | 초록 |
| ☕ | 휴식 | 보라 |
| 🎨 | 취미 | 주황 |
| 👥 | 사교 | 청록 |
| 📋 | 잡무 | 회색 |
| 😴 | 수면 | 진회색 |

## 아이폰에서 사용하기 (PWA 설치)

### 방법 1: Safari로 접속
1. 아이폰에서 Safari로 앱 URL에 접속
2. 하단의 공유 버튼 탭 (📤)
3. "홈 화면에 추가" 선택
4. "추가" 버튼 탭
5. 홈 화면에서 앱처럼 사용!

### 방법 2: 로컬에서 실행 (같은 Wi-Fi)
```bash
# 프로젝트 폴더에서
npm run dev -- --host
```
출력된 Network URL로 아이폰에서 접속 후 홈 화면에 추가

### 방법 3: 배포 후 사용
```bash
npm run build
# dist 폴더를 Vercel, Netlify, GitHub Pages 등에 배포
```

## 개발

```bash
# 의존성 설치
npm install

# 개발 서버 시작
npm run dev

# 빌드
npm run build

# 미리보기
npm run preview
```

## 기술 스택
- React 19 + TypeScript
- Vite + vite-plugin-pwa
- date-fns (날짜 처리)
- LocalStorage (데이터 저장)

## 데이터 저장
모든 데이터는 브라우저의 LocalStorage에 저장됩니다:
- `planner_categories`: 카테고리 목록
- `planner_timeBlocks`: 시간 블록 데이터
- `planner_todos`: 투두 리스트
- `planner_events`: 월간 일정
- `planner_weeklyGoals`: 주간 목표

---
Made with ❤️ for personal productivity
