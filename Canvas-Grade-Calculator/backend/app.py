from flask import Flask, request, jsonify
from flask_cors import CORS
import requests

app = Flask(__name__)
CORS(app)

BASE_URL = "https://cuhsd.instructure.com/api/v1"
USER_ID = "self"

def make_headers(token):
    return {"Authorization": f"Bearer {token}"}

@app.route('/api/courses', methods=['POST'])
def get_courses():
    token = request.json.get('token')
    if not token:
        return jsonify({'error': 'Token required'}), 400
    
    headers = make_headers(token)
    courses_url = f"{BASE_URL}/users/{USER_ID}/courses?enrollment_state=active&include[]=enrollments&include[]=total_scores"
    
    try:
        response = requests.get(courses_url, headers=headers)
        response.raise_for_status()
        courses = response.json()
        
        result = []
        for course in courses:
            enrollments = course.get("enrollments", [])
            current_score = None
            current_grade = None
            
            for e in enrollments:
                if "computed_current_score" in e:
                    current_score = e["computed_current_score"]
                    current_grade = e["computed_current_grade"]
            
            result.append({
                'id': course.get('id'),
                'name': course.get('name', 'Unnamed Course'),
                'current_score': current_score,
                'current_grade': current_grade
            })
        
        return jsonify(result)
    except requests.exceptions.RequestException as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/course/<int:course_id>/assignments', methods=['POST'])
def get_assignments(course_id):
    token = request.json.get('token')
    if not token:
        return jsonify({'error': 'Token required'}), 400
    
    headers = make_headers(token)
    url = f"{BASE_URL}/courses/{course_id}/students/submissions?student_ids[]={USER_ID}&include[]=assignment&per_page=100"
    
    assignments = []
    try:
        while url:
            response = requests.get(url, headers=headers)
            response.raise_for_status()
            submissions = response.json()
            assignments.extend(submissions)
            
            if 'link' in response.headers:
                links = response.headers['link'].split(',')
                url = None
                for link in links:
                    if 'rel="next"' in link:
                        url = link[link.find('<')+1 : link.find('>')]
            else:
                url = None
        
        return jsonify(assignments)
    except requests.exceptions.RequestException as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/course/<int:course_id>/groups', methods=['POST'])
def get_assignment_groups(course_id):
    token = request.json.get('token')
    if not token:
        return jsonify({'error': 'Token required'}), 400
    
    headers = make_headers(token)
    url = f"{BASE_URL}/courses/{course_id}/assignment_groups?include[]=assignments"
    
    try:
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        return jsonify(response.json())
    except requests.exceptions.RequestException as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/calculate-grade', methods=['POST'])
def calculate_grade():
    data = request.json
    assignments = data.get('assignments', [])
    assignment_groups = data.get('assignment_groups', [])
    modifications = data.get('modifications', {})
    
    # Convert string keys to integers
    modifications = {int(k): v for k, v in modifications.items()}
    
    grade = calculate_grade_logic(assignments, assignment_groups, modifications)
    return jsonify({'grade': grade})

def calculate_grade_logic(assignments, assignment_groups, modifications=None):
    group_map = {g['id']: g for g in assignment_groups}
    grouped_assignments = {}
    
    for i, s in enumerate(assignments):
        assignment = s.get("assignment", {})
        group_id = assignment.get("assignment_group_id")
        
        if assignment.get('omit_from_final_grade', False):
            continue
        
        if group_id not in grouped_assignments:
            grouped_assignments[group_id] = []
        
        grouped_assignments[group_id].append((i, s, assignment))
    
    total_weight = 0
    weighted_grade = 0
    
    for group_id, group_assignments in grouped_assignments.items():
        group_info = group_map.get(group_id, {})
        group_weight = group_info.get('group_weight', 0)
        
        drop_lowest = group_info.get('rules', {}).get('drop_lowest', 0)
        drop_highest = group_info.get('rules', {}).get('drop_highest', 0)
        never_drop = group_info.get('rules', {}).get('never_drop', [])
        
        all_assignments = []
        for i, s, assignment in group_assignments:
            points_possible = assignment.get("points_possible", 0)
            points_earned = s.get("score")
            assignment_id = assignment.get("id")
            
            if modifications and i in modifications:
                points_earned = modifications[i]
            
            if points_possible > 0 and points_earned is not None:
                percentage = (points_earned / points_possible) * 100
                all_assignments.append({
                    'earned': points_earned,
                    'possible': points_possible,
                    'percentage': percentage,
                    'id': assignment_id,
                    'never_drop': assignment_id in never_drop
                })
        
        if len(all_assignments) > 0:
            never_drop_assignments = [a for a in all_assignments if a.get('never_drop', False)]
            droppable = [a for a in all_assignments if not a.get('never_drop', False)]
            droppable_sorted = sorted(droppable, key=lambda x: x['percentage'])
            
            if drop_lowest > 0 and len(droppable_sorted) > drop_lowest:
                droppable_sorted = droppable_sorted[drop_lowest:]
            
            if drop_highest > 0 and len(droppable_sorted) > drop_highest:
                droppable_sorted = droppable_sorted[:-drop_highest]
            
            final_assignments = never_drop_assignments + droppable_sorted
            
            group_earned = sum(a['earned'] for a in final_assignments)
            group_possible = sum(a['possible'] for a in final_assignments)
            
            if group_possible > 0:
                group_percentage = (group_earned / group_possible) * 100
                weighted_grade += (group_percentage * group_weight / 100)
                total_weight += group_weight
    
    if total_weight == 0:
        all_graded = []
        for group_id, group_assignments in grouped_assignments.items():
            for i, s, assignment in group_assignments:
                points_possible = assignment.get("points_possible", 0)
                points_earned = s.get("score")
                
                if modifications and i in modifications:
                    points_earned = modifications[i]
                
                if points_earned is not None and points_possible > 0:
                    all_graded.append({'earned': points_earned, 'possible': points_possible})
        
        if len(all_graded) == 0:
            return None
        
        total_earned = sum(a['earned'] for a in all_graded)
        total_possible = sum(a['possible'] for a in all_graded)
        return (total_earned / total_possible) * 100
    
    return weighted_grade

if __name__ == '__main__':
    import os
    port = int(os.environ.get('PORT', 5001))
    app.run(debug=False, host='0.0.0.0', port=port)
