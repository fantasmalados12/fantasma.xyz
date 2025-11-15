export interface VelocityData {
  date: string;
  wordsLearned: number;
}

export interface WeakArea {
  term: string;
  definition: string;
  attempts: number;
  accuracy: number;
}

export interface StudyPattern {
  hour: number;
  avgAccuracy: number;
  sessionCount: number;
}

export interface POSPerformance {
  pos: string;
  avgAccuracy: number;
  totalTerms: number;
  correctCount: number;
  incorrectCount: number;
}

export interface CEFREstimate {
  level: string;
  confidence: number;
  vocabSize: number;
  nextLevel: string | null;
  wordsToNextLevel: number;
}

export interface ComparisonData {
  userPercentile: number;
  userStats: {
    avgAccuracy: number;
    totalSessions: number;
    totalStudyTime: number;
    vocabSize: number;
  };
  avgStats: {
    avgAccuracy: number;
    totalSessions: number;
    totalStudyTime: number;
    vocabSize: number;
  };
}

export interface SessionTrend {
  date: string;
  accuracy: number;
  duration: number;
  mode: string;
  questionsAnswered: number;
}

export interface RetentionData {
  term: string;
  definition: string;
  firstSeen: string;
  lastAccuracy: number;
  retentionRate: number;
  timesReviewed: number;
}

export interface AnalyticsOverview {
  totalSessions: number;
  avgAccuracy: number;
  totalStudyTime: number;
  lastSessionDate: string;
  wordsLearnedThisWeek: number;
  cefrLevel: CEFREstimate;
  recentSessions: SessionTrend[];
}
