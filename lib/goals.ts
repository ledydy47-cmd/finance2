import type { Goal } from "./types"

export function getActiveGoals(goals: Goal[]) {
  return goals.filter((g) => !g.completed)
}

export function getCompletedGoals(goals: Goal[]) {
  return goals.filter((g) => g.completed)
}

export function isGoalComplete(goal: Goal) {
  return goal.completed || goal.savedAmount >= goal.targetAmount
}

export function shouldCelebrateGoal(goal: Goal) {
  return goal.savedAmount >= goal.targetAmount && !goal.completionCelebrated
}
