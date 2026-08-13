export type Quality = 'low' | 'medium' | 'high'

export type ParticleBudget = {
  void: number
  light: number
  earth: number
  stars: number
  spiral: number
  sparkles: number
  dark: number
  fish: number
  birds: number
  trees: number
}

export const BUDGET: Record<Quality, ParticleBudget> = {
  low: {
    void: 160,
    light: 420,
    earth: 240,
    stars: 320,
    spiral: 700,
    sparkles: 28,
    dark: 260,
    fish: 90,
    birds: 40,
    trees: 18,
  },
  medium: {
    void: 320,
    light: 900,
    earth: 480,
    stars: 800,
    spiral: 1600,
    sparkles: 56,
    dark: 520,
    fish: 180,
    birds: 80,
    trees: 28,
  },
  high: {
    void: 720,
    light: 2800,
    earth: 1100,
    stars: 3200,
    spiral: 5200,
    sparkles: 90,
    dark: 1100,
    fish: 320,
    birds: 140,
    trees: 42,
  },
}

export const DPR: Record<Quality, [number, number]> = {
  low: [1, 1],
  medium: [1, 1.25],
  high: [1, 2],
}
