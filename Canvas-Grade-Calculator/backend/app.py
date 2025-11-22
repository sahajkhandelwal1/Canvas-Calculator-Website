from flask import Flask, request, jsonify
from flask_cors import CORS
import requests

app = Flask(__name__)
CORS(app)

USER_ID = "self"

def make_headers(token):
    return {"Authorization": f"Bearer {token}"}

def get_base_url(canvas_url):
    """Construct base URL from canvas domain"""
    # Remove any protocol and trailing slashes
    clean_url = canvas_url.replace('https://', '').replace('http://', '').rstrip('/')
    return f"https://{clean_url}/api/v1"

@app.route('/api/courses', methods=['POST'])
def get_courses():
    token = request.json.get('token')
    canvas_url = request.json.get('canvasUrl', 'cuhsd.instructure.com')
    
    if not token:
        return jsonify({'error': 'Token required'}), 400
    
    BASE_URL = get_base_url(canvas_url)
    headers = make_headers(token)
    
    # Get user info for logging
    try:
        user_response = requests.get(f"{BASE_URL}/users/{USER_ID}", headers=headers, timeout=5)
        if user_response.status_code == 200:
            user_data = user_response.json()
            username = user_data.get('name', 'Unknown User')
            user_id = user_data.get('id', 'Unknown ID')
            print(f"\n{'='*60}")
            print(f"USER LOGIN: {username} (ID: {user_id}) - {canvas_url}")
            print(f"{'='*60}")
    except:
        print(f"\nUSER LOGIN: Unable to fetch user info - {canvas_url}")
    
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
    canvas_url = request.json.get('canvasUrl', 'cuhsd.instructure.com')
    
    if not token:
        return jsonify({'error': 'Token required'}), 400
    
    BASE_URL = get_base_url(canvas_url)
    headers = make_headers(token)
    url = f"{BASE_URL}/courses/{course_id}/students/submissions?student_ids[]={USER_ID}&include[]=assignment&per_page=50"
    
    assignments = []
    max_retries = 2
    
    try:
        while url:
            retry_count = 0
            success = False
            
            while retry_count < max_retries and not success:
                try:
                    response = requests.get(url, headers=headers, timeout=45)
                    response.raise_for_status()
                    
                    # Check if response is JSON
                    content_type = response.headers.get('Content-Type', '')
                    if 'application/json' not in content_type:
                        print(f"Non-JSON response for course {course_id}: {content_type}")
                        print(f"Response preview: {response.text[:200]}")
                        retry_count += 1
                        if retry_count < max_retries:
                            import time
                            time.sleep(2)
                            continue
                        return jsonify({'error': 'Canvas returned an invalid response. The course may be too large or temporarily unavailable.'}), 500
                    
                    submissions = response.json()
                    assignments.extend(submissions)
                    success = True
                    
                except requests.exceptions.Timeout:
                    retry_count += 1
                    if retry_count < max_retries:
                        print(f"Timeout for course {course_id}, retrying...")
                        import time
                        time.sleep(2)
                    else:
                        raise
            
            if not success:
                break
                
            if 'link' in response.headers:
                links = response.headers['link'].split(',')
                url = None
                for link in links:
                    if 'rel="next"' in link:
                        url = link[link.find('<')+1 : link.find('>')]
            else:
                url = None
        
        print(f"Successfully fetched {len(assignments)} assignments for course {course_id}")
        return jsonify(assignments)
    except requests.exceptions.RequestException as e:
        print(f"Error fetching assignments for course {course_id}: {str(e)}")
        return jsonify({'error': f'Failed to load course data: {str(e)}'}), 500

@app.route('/api/course/<int:course_id>/groups', methods=['POST'])
def get_assignment_groups(course_id):
    token = request.json.get('token')
    canvas_url = request.json.get('canvasUrl', 'cuhsd.instructure.com')
    
    if not token:
        return jsonify({'error': 'Token required'}), 400
    
    BASE_URL = get_base_url(canvas_url)
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

@app.route('/api/upcoming-assignments', methods=['POST'])
def get_upcoming_assignments():
    token = request.json.get('token')
    canvas_url = request.json.get('canvasUrl', 'cuhsd.instructure.com')
    
    if not token:
        return jsonify({'error': 'Token required'}), 400
    
    BASE_URL = get_base_url(canvas_url)
    headers = make_headers(token)
    
    try:
        from datetime import datetime, timedelta
        import concurrent.futures
        
        # Get all active courses
        courses_url = f"{BASE_URL}/users/{USER_ID}/courses?enrollment_state=active&per_page=100"
        courses_response = requests.get(courses_url, headers=headers)
        courses_response.raise_for_status()
        courses = courses_response.json()
        
        print(f"Found {len(courses)} courses")
        
        upcoming = []
        from datetime import timezone
        now = datetime.now(timezone.utc)
        
        def fetch_course_assignments(course):
            course_id = course.get('id')
            course_name = course.get('name', 'Unknown Course')
            course_upcoming = []
            
            try:
                # Get assignments for this course
                assignments_url = f"{BASE_URL}/courses/{course_id}/assignments?per_page=50"
                assignments_response = requests.get(assignments_url, headers=headers, timeout=5)
                
                if assignments_response.status_code == 200:
                    assignments = assignments_response.json()
                    print(f"Course {course_name}: {len(assignments)} assignments")
                    
                    for assignment in assignments:
                        due_at = assignment.get('due_at')
                        if due_at:
                            try:
                                due_date = datetime.fromisoformat(due_at.replace('Z', '+00:00'))
                                # Only include future assignments (within next 60 days)
                                if due_date > now and due_date < now + timedelta(days=60):
                                    course_upcoming.append({
                                        'course_name': course_name,
                                        'assignment_name': assignment.get('name', 'Unnamed Assignment'),
                                        'due_at': due_at,
                                        'points_possible': assignment.get('points_possible', 0),
                                        'html_url': assignment.get('html_url', '')
                                    })
                            except Exception as e:
                                print(f"Error parsing assignment: {e}")
                                pass
            except:
                pass
            
            return course_upcoming
        
        # Fetch assignments from all courses in parallel (max 5 at a time)
        with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
            results = executor.map(fetch_course_assignments, courses)
            for course_upcoming in results:
                upcoming.extend(course_upcoming)
        
        # Sort by due date
        upcoming.sort(key=lambda x: datetime.fromisoformat(x['due_at'].replace('Z', '+00:00')))
        
        print(f"Total upcoming assignments found: {len(upcoming)}")
        
        return jsonify(upcoming[:10])  # Return top 10 upcoming
    except requests.exceptions.RequestException as e:
        return jsonify({'error': str(e)}), 500

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
            points_possible = assignment.get("points_possible") or 0
            points_earned = s.get("score")
            assignment_id = assignment.get("id")
            
            if modifications and i in modifications:
                points_earned = modifications[i]
            
            if points_possible and points_possible > 0 and points_earned is not None:
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
    
    # Normalize the grade if weights don't add up to 100%
    # Canvas does this automatically - scales the grade proportionally
    if total_weight > 0 and total_weight != 100:
        weighted_grade = (weighted_grade / total_weight) * 100
    
    return weighted_grade

if __name__ == '__main__':
    import os
    port = int(os.environ.get('PORT', 5001))
    app.run(debug=False, host='0.0.0.0', port=port)
