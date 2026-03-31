import { API_BASE_URL } from './api_base'

import type { UmaSkill } from './uma_skills';

export interface SkillMatch {
  ocrText: string;
  matchedSkill: {
    id: number;
    name: string;
    jpName: string;
    description: string;
    skillPoints: number;
    evalPoints: number;
    pointRatio: number;
    category: string;
    rarity: string;
  };
  confidence: number;
}

export interface SkillSearchResponse {
  query: string;
  count: number;
  results: UmaSkill[];
}

export interface SkillMatchResponse {
  totalTexts: number;
  matchedCount: number;
  matches: SkillMatch[];
}

// Search for skills by name
export async function searchSkill(query: string): Promise<SkillSearchResponse> {
  const response = await fetch(`${API_BASE_URL}/api/japan/skill-search`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });

  if (!response.ok) {
    throw new Error(`Failed to search skill: ${response.status}`);
  }

  return response.json();
}

// Match OCR text to skills
export async function matchOCRSkills(ocrTexts: string[]): Promise<SkillMatchResponse> {
  const response = await fetch(`${API_BASE_URL}/api/japan/match-skills`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ocrTexts }),
  });

  if (!response.ok) {
    throw new Error(`Failed to match skills: ${response.status}`);
  }

  return response.json();
}

// Get all available skills
export async function getAllSkills(): Promise<{ totalSkills: number; skills: UmaSkill[] }> {
  const response = await fetch(`${API_BASE_URL}/api/japan/all-skills`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch all skills: ${response.status}`);
  }

  return response.json();
}
