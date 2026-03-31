from typing import List, Dict, Any, Optional
from difflib import SequenceMatcher
import re

from app.services.uma_skill_service import fetch_uma_skills

# Load skills data from JSON file
def load_skills_data() -> Dict[str, Any]:
    """Load UMA skills from shared live source."""
    try:
        return {"skills": fetch_uma_skills()}
    except Exception as exc:
        print(f"Error loading skills for matcher: {exc}")
        return {"skills": []}

def calculate_similarity(text1: str, text2: str) -> float:
    """Calculate similarity ratio between two strings (0-1)"""
    return SequenceMatcher(None, text1.lower(), text2.lower()).ratio()


def normalize_for_match(value: str) -> str:
    """Normalize OCR and skill text for more tolerant matching."""
    lowered = value.lower().strip()
    return re.sub(r"[^\w\u3040-\u30ff\u3400-\u9fff]", "", lowered)


def combined_similarity(query: str, target: str) -> float:
    """Return a robust similarity score combining contains and fuzzy checks."""
    query_clean = query.strip()
    target_clean = target.strip()
    if not query_clean or not target_clean:
        return 0.0

    query_norm = normalize_for_match(query_clean)
    target_norm = normalize_for_match(target_clean)

    if not query_norm or not target_norm:
        return 0.0

    if query_norm == target_norm:
        return 1.0

    if query_norm in target_norm or target_norm in query_norm:
        return 0.97

    base_score = calculate_similarity(query_norm, target_norm)

    if target_norm.startswith(query_norm) or query_norm.startswith(target_norm):
        return max(base_score, 0.9)

    return base_score

def search_skill_by_name(query: str, skills_data: Optional[Dict] = None) -> List[Dict[str, Any]]:
    """
    Search for skills by name (English or Japanese)
    Returns list of matching skills sorted by similarity
    """
    if skills_data is None:
        skills_data = load_skills_data()
    
    query = query.strip()
    if not query:
        return []
    
    skills_list = skills_data.get('skills', [])
    matches = []
    
    for skill in skills_list:
        # Check English name
        eng_similarity = combined_similarity(query, skill.get('name', ''))
        # Check Japanese name
        jp_similarity = combined_similarity(query, skill.get('jpName', ''))
        # Check description
        desc_similarity = combined_similarity(query, skill.get('description', ''))
        
        # Take the highest similarity score
        max_similarity = max(eng_similarity, jp_similarity, desc_similarity)
        
        # Include if similarity is reasonable for OCR-noisy input
        if max_similarity >= 0.52:
            skill_copy = skill.copy()
            skill_copy['similarity'] = max_similarity
            skill_copy['matchType'] = 'name' if eng_similarity == max_similarity else ('jpName' if jp_similarity == max_similarity else 'description')
            matches.append(skill_copy)
    
    # Sort by similarity descending
    matches.sort(key=lambda x: x['similarity'], reverse=True)
    return matches

def find_best_skill_match(text: str, skills_data: Optional[Dict] = None) -> Optional[Dict[str, Any]]:
    """
    Find the best matching skill for the given text
    Returns the skill with highest similarity or None if no good match found
    """
    results = search_skill_by_name(text, skills_data)
    
    if results and results[0]['similarity'] >= 0.75:  # 75% threshold for "best match"
        return results[0]
    
    return None

def extract_and_match_skills(ocr_text: List[str], skills_data: Optional[Dict] = None) -> List[Dict[str, Any]]:
    """
    Extract and match skills from OCR text
    Takes a list of text strings and returns matched skills
    """
    if skills_data is None:
        skills_data = load_skills_data()
    
    matched_by_skill_id: Dict[str, Dict[str, Any]] = {}
    
    for text in ocr_text:
        best_match = find_best_skill_match(text, skills_data)
        if best_match:
            payload = {
                'ocrText': text,
                'matchedSkill': best_match,
                'confidence': best_match['similarity']
            }

            skill_id = str(best_match.get('id', ''))
            previous = matched_by_skill_id.get(skill_id)
            if previous is None or payload['confidence'] > previous['confidence']:
                matched_by_skill_id[skill_id] = payload

    matched_skills = list(matched_by_skill_id.values())
    matched_skills.sort(key=lambda item: item['confidence'], reverse=True)
    return matched_skills

def get_skills_by_category(category: str, skills_data: Optional[Dict] = None) -> List[Dict[str, Any]]:
    """Get all skills for a specific category"""
    if skills_data is None:
        skills_data = load_skills_data()
    
    skills_list = skills_data.get('skills', [])
    return [skill for skill in skills_list if skill.get('category') == category]

def get_skills_by_rarity(rarity: str, skills_data: Optional[Dict] = None) -> List[Dict[str, Any]]:
    """Get all skills for a specific rarity"""
    if skills_data is None:
        skills_data = load_skills_data()
    
    skills_list = skills_data.get('skills', [])
    return [skill for skill in skills_list if skill.get('rarity') == rarity]

def get_all_skills(skills_data: Optional[Dict] = None) -> List[Dict[str, Any]]:
    """Get all available skills"""
    if skills_data is None:
        skills_data = load_skills_data()
    
    return skills_data.get('skills', [])
