from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os

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
    
    # Get user info for logging and response
    try:
        user_response = requests.get(f"{BASE_URL}/users/{USER_ID}", headers=headers, timeout=5)
        if user_response.status_code == 200:
            user_data = user_response.json()
            username = user_data.get('name', 'Unknown User')
            user_id = user_data.get('id', 'Unknown ID')
            user_info = {'name': username, 'id': user_id}
            print(f"\n{'='*60}")
            print(f"👤 USER LOGIN: {username} (ID: {user_id})")
            print(f"🌐 Canvas: {canvas_url}")
            print(f"{'='*60}")
    except:
        user_info = {'name': 'Unknown User', 'id': 'Unknown ID'}
    
    courses_url = f"{BASE_URL}/users/{USER_ID}/courses?enrollment_state=active&include[]=enrollments&include[]=total_scores"
    
    try:
        response = requests.get(courses_url, headers=headers)
        response.raise_for_status()
        courses = response.json()
        
        result = []
        
        # Helper function to calculate grade for a course
        def calculate_course_grade(course_id):
            try:
                # Get assignments and assignment groups for this course
                assignments_url = f"{BASE_URL}/courses/{course_id}/students/submissions?student_ids[]={USER_ID}&include[]=assignment&include[]=submission_comments&per_page=50"
                groups_url = f"{BASE_URL}/courses/{course_id}/assignment_groups?include[]=assignments"
                
                assignments_response = requests.get(assignments_url, headers=headers, timeout=10)
                groups_response = requests.get(groups_url, headers=headers, timeout=10)
                
                if assignments_response.status_code == 200 and groups_response.status_code == 200:
                    assignments_data = assignments_response.json()
                    groups_data = groups_response.json()
                    
                    # Calculate grade using existing logic
                    calculated_grade = calculate_grade_logic(assignments_data, groups_data)
                    return calculated_grade
                    
            except Exception as e:
                return None
            
            return None
        
        for course in courses:
            enrollments = course.get("enrollments", [])
            current_score = None
            current_grade = None
            
            # First try to get grade from Canvas enrollment data
            for e in enrollments:
                if "computed_current_score" in e:
                    current_score = e["computed_current_score"]
                    current_grade = e["computed_current_grade"]
            
            # If no grade available (locked), calculate it manually
            if current_score is None:
                calculated_score = calculate_course_grade(course.get('id'))
                if calculated_score is not None:
                    current_score = round(calculated_score, 2)
                    # Convert score to letter grade (basic conversion)
                    if calculated_score >= 97:
                        current_grade = "A"
                    elif calculated_score >= 93:
                        current_grade = "A"
                    elif calculated_score >= 90:
                        current_grade = "A-"
                    elif calculated_score >= 87:
                        current_grade = "B+"
                    elif calculated_score >= 83:
                        current_grade = "B"
                    elif calculated_score >= 80:
                        current_grade = "B-"
                    elif calculated_score >= 77:
                        current_grade = "C+"
                    elif calculated_score >= 73:
                        current_grade = "C"
                    elif calculated_score >= 70:
                        current_grade = "C-"
                    elif calculated_score >= 67:
                        current_grade = "D+"
                    elif calculated_score >= 63:
                        current_grade = "D"
                    elif calculated_score >= 60:
                        current_grade = "D-"
                    else:
                        current_grade = "F"
            
            result.append({
                'id': course.get('id'),
                'name': course.get('name', 'Unnamed Course'),
                'current_score': current_score,
                'current_grade': current_grade
            })
        
        print(f"✅ Loaded {len(result)} courses")
        
        # Include user info in response
        response_data = {
            'courses': result,
            'user': user_info
        }
        
        return jsonify(response_data)
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
    url = f"{BASE_URL}/courses/{course_id}/students/submissions?student_ids[]={USER_ID}&include[]=assignment&include[]=submission_comments&per_page=50"
    
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
        
        return jsonify(assignments)
    except requests.exceptions.RequestException as e:
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

@app.route('/api/course/<int:course_id>/grading-scheme', methods=['POST'])
def get_grading_scheme(course_id):
    token = request.json.get('token')
    canvas_url = request.json.get('canvasUrl', 'cuhsd.instructure.com')
    
    if not token:
        return jsonify({'error': 'Token required'}), 400
    
    BASE_URL = get_base_url(canvas_url)
    headers = make_headers(token)
    
    try:
        # Try to get the course's grading standard
        course_url = f"{BASE_URL}/courses/{course_id}?include[]=grading_standard"
        course_response = requests.get(course_url, headers=headers, timeout=10)
        
        if course_response.status_code == 200:
            course_data = course_response.json()
            grading_standard = course_data.get('grading_standard')
            
            # Canvas grading_standard can be a dict with 'grading_scheme' key or direct array
            if grading_standard:
                # If it's a dict, extract the grading_scheme array
                if isinstance(grading_standard, dict):
                    scheme = grading_standard.get('grading_scheme', grading_standard)
                else:
                    scheme = grading_standard
                
                return jsonify({'grading_scheme': scheme})
        
        # If no custom grading standard, return default
        return jsonify({'grading_scheme': None})
        
    except requests.exceptions.RequestException as e:
        return jsonify({'error': str(e)}), 500

def score_to_letter_grade(score, grading_scheme=None):
    """Convert a percentage score to a letter grade using the grading scheme"""
    if score is None:
        return None
    
    # If custom grading scheme provided, use it
    if grading_scheme and isinstance(grading_scheme, list):
        for entry in grading_scheme:
            if isinstance(entry, dict):
                name = entry.get('name', '')
                value = entry.get('value', 0)
                # Canvas grading schemes use decimal values (0.9 = 90%)
                if score >= (value * 100):
                    return name
    
    # Default grading scale
    if score >= 97:
        return "A+"
    elif score >= 93:
        return "A"
    elif score >= 90:
        return "A-"
    elif score >= 87:
        return "B+"
    elif score >= 83:
        return "B"
    elif score >= 80:
        return "B-"
    elif score >= 77:
        return "C+"
    elif score >= 73:
        return "C"
    elif score >= 70:
        return "C-"
    elif score >= 67:
        return "D+"
    elif score >= 63:
        return "D"
    elif score >= 60:
        return "D-"
    else:
        return "F"

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
                                        'lock_at': assignment.get('lock_at'),
                                        'points_possible': assignment.get('points_possible', 0),
                                        'html_url': assignment.get('html_url', '')
                                    })
                            except Exception as e:
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
        
        return jsonify(upcoming[:10])  # Return top 10 upcoming
    except requests.exceptions.RequestException as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/overdue-assignments', methods=['POST'])
def get_overdue_assignments():
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
        
        overdue = []
        from datetime import timezone
        now = datetime.now(timezone.utc)
        
        def fetch_course_overdue_assignments(course):
            course_id = course.get('id')
            course_name = course.get('name', 'Unknown Course')
            course_overdue = []
            
            try:
                # Get assignments for this course
                assignments_url = f"{BASE_URL}/courses/{course_id}/assignments?per_page=50"
                assignments_response = requests.get(assignments_url, headers=headers, timeout=5)
                
                if assignments_response.status_code == 200:
                    assignments = assignments_response.json()
                    
                    for assignment in assignments:
                        due_at = assignment.get('due_at')
                        lock_at = assignment.get('lock_at')
                        
                        if due_at:
                            try:
                                due_date = datetime.fromisoformat(due_at.replace('Z', '+00:00'))
                                lock_date = None
                                if lock_at:
                                    lock_date = datetime.fromisoformat(lock_at.replace('Z', '+00:00'))
                                
                                # Only include overdue assignments (past due but within last 90 days)
                                if due_date < now and due_date > now - timedelta(days=90):
                                    # Check if assignment is still accessible (not locked)
                                    is_locked = lock_date and lock_date < now
                                    
                                    course_overdue.append({
                                        'course_name': course_name,
                                        'assignment_name': assignment.get('name', 'Unnamed Assignment'),
                                        'due_at': due_at,
                                        'lock_at': lock_at,
                                        'is_locked': is_locked,
                                        'points_possible': assignment.get('points_possible', 0),
                                        'html_url': assignment.get('html_url', ''),
                                        'days_overdue': (now - due_date).days
                                    })
                            except Exception as e:
                                pass
            except:
                pass
            
            return course_overdue
        
        # Fetch assignments from all courses in parallel (max 5 at a time)
        with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
            results = executor.map(fetch_course_overdue_assignments, courses)
            for course_overdue in results:
                overdue.extend(course_overdue)
        
        # Sort by due date (most recently overdue first)
        overdue.sort(key=lambda x: datetime.fromisoformat(x['due_at'].replace('Z', '+00:00')), reverse=True)
        
        return jsonify(overdue[:15])  # Return top 15 overdue
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

@app.route('/api/feedback', methods=['POST'])
def send_feedback():
    """Send feedback email - saves to log file and attempts email delivery"""
    try:
        feedback_text = request.json.get('feedback', '')
        user_name = request.json.get('email', 'Anonymous')  # Using 'email' field for backward compatibility
        user_id = request.json.get('userId', 'Unknown')
        
        if not feedback_text:
            return jsonify({'error': 'Feedback text required'}), 400
        
        # Log feedback to console (IMPORTANT - CHECK YOUR TERMINAL!)
        print("\n" + "="*60)
        print("🎉 NEW FEEDBACK RECEIVED!")
        print("="*60)
        print(f"From: {user_name} (ID: {user_id})")
        print(f"Message:\n{feedback_text}")
        print("="*60 + "\n")
        
        # Save to file as backup (PRIMARY METHOD)
        from datetime import datetime
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        try:
            with open('feedback.log', 'a', encoding='utf-8') as f:
                f.write(f"\n{'='*60}\n")
                f.write(f"Timestamp: {timestamp}\n")
                f.write(f"From: {user_name} (ID: {user_id})\n")
                f.write(f"Message:\n{feedback_text}\n")
                f.write(f"{'='*60}\n")
            print("✅ Feedback saved to feedback.log")
        except Exception as file_error:
            print(f"⚠️  Could not save to file: {file_error}")
        
        # Try to send email using Gmail SMTP
        try:
            print("📧 Attempting to send email via SMTP...")
            
            # Get SMTP credentials from environment variables
            smtp_email = os.environ.get('SMTP_EMAIL')
            smtp_password = os.environ.get('SMTP_PASSWORD')
            
            if smtp_email and smtp_password:
                msg = MIMEMultipart()
                msg['From'] = smtp_email
                msg['To'] = 'sahajkhandelwal2@gmail.com'
                msg['Subject'] = 'Canvas Plus Feedback'
                
                body = f"""
New feedback received from Canvas Plus!

From: {user_name} (Canvas ID: {user_id})
Timestamp: {timestamp}

Message:
{feedback_text}
"""
                msg.attach(MIMEText(body, 'plain'))
                
                # Connect to Gmail SMTP server
                server = smtplib.SMTP('smtp.gmail.com', 587)
                server.starttls()
                server.login(smtp_email, smtp_password)
                server.send_message(msg)
                server.quit()
                
                print("✅ Email sent successfully via SMTP!")
            else:
                print("ℹ️  SMTP credentials not configured (set SMTP_EMAIL and SMTP_PASSWORD env vars)")
                print("ℹ️  Feedback saved to log file - check feedback.log")
        except Exception as email_error:
            print(f"⚠️  Could not send email: {email_error}")
            print("ℹ️  Feedback still saved to log file")
        
        # Always return success since we saved to log file
        return jsonify({
            'success': True, 
            'message': 'Feedback received! Check the server logs or feedback.log file.'
        })
            
    except Exception as e:
        print(f"❌ Error processing feedback: {e}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5001))
    app.run(debug=False, host='0.0.0.0', port=port)
