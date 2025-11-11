import requests

BASE_URL = "https://cuhsd.instructure.com/api/v1"
USER_ID = "self"

# Global variables for API token and headers
API_TOKEN = None
headers = None

def get_all_courses():
    """Get all active courses with grades"""
    courses_url = (
        f"{BASE_URL}/users/{USER_ID}/courses"
        "?enrollment_state=active&include[]=enrollments&include[]=total_scores"
    )
    response = requests.get(courses_url, headers=headers)
    courses = response.json()
    
    print("\n=== YOUR COURSES ===")
    for course in courses:
        name = course.get("name", "Unnamed Course")
        course_id = course.get("id")
        enrollments = course.get("enrollments", [])
        current_score = None
        current_grade = None

        for e in enrollments:
            if "computed_current_score" in e:
                current_score = e["computed_current_score"]
                current_grade = e["computed_current_grade"]

        print(f"\nCourse ID: {course_id}")
        print(f"Name: {name}")
        if current_score is not None:
            print(f"Current Grade: {current_grade} ({current_score}%)")
        else:
            print("No grade available yet.")

def get_assignment_groups(course_id):
    """Get assignment groups with their weights and rules"""
    url = f"{BASE_URL}/courses/{course_id}/assignment_groups?include[]=assignments"
    response = requests.get(url, headers=headers)
    return response.json()

def get_assignments(course_id):
    """Get all assignments and submissions for a course"""
    url = f"{BASE_URL}/courses/{course_id}/students/submissions?student_ids[]={USER_ID}&include[]=assignment&per_page=100"
    assignments = []
    
    while url:
        response = requests.get(url, headers=headers)
        submissions = response.json()
        assignments.extend(submissions)
        
        if 'link' in response.headers:
            links = response.headers['link'].split(',')
            next_url = None
            for link in links:
                if 'rel="next"' in link:
                    next_url = link[link.find('<')+1 : link.find('>')]
            url = next_url
        else:
            url = None
    
    return assignments

def display_assignments(assignments, assignment_groups):
    """Display all assignments with their scores, grouped by assignment group"""
    # Create a mapping of group_id to group info
    group_map = {g['id']: g for g in assignment_groups}
    
    # Group assignments by assignment_group_id
    grouped = {}
    for i, s in enumerate(assignments):
        assignment = s.get("assignment", {})
        group_id = assignment.get("assignment_group_id")
        if group_id not in grouped:
            grouped[group_id] = []
        grouped[group_id].append((i, s))
    
    print("\n=== ASSIGNMENTS ===")
    for group_id, items in grouped.items():
        group_name = group_map.get(group_id, {}).get('name', 'Unknown Group')
        group_weight = group_map.get(group_id, {}).get('group_weight', 0)
        print(f"\n{group_name} (Weight: {group_weight}%)")
        print("-" * 50)
        
        for i, s in items:
            assignment = s.get("assignment", {})
            assignment_name = assignment.get("name", "Unknown Assignment")
            points_earned = s.get("score")
            points_possible = assignment.get("points_possible", 0)
            
            if points_earned is not None:
                print(f"  {i+1}. {assignment_name}: {points_earned} / {points_possible} points")
            else:
                print(f"  {i+1}. {assignment_name}: Not graded / {points_possible} points")

def calculate_grade(assignments, assignment_groups, modifications=None, debug=False):
    """Calculate grade based on assignment group weighting with Canvas rules"""
    # Create a mapping of group_id to group info
    group_map = {g['id']: g for g in assignment_groups}
    
    # Group assignments by assignment_group_id
    grouped_assignments = {}
    for i, s in enumerate(assignments):
        assignment = s.get("assignment", {})
        group_id = assignment.get("assignment_group_id")
        
        # Skip assignments that don't count toward final grade
        if assignment.get('omit_from_final_grade', False):
            continue
        
        if group_id not in grouped_assignments:
            grouped_assignments[group_id] = []
        
        grouped_assignments[group_id].append((i, s, assignment))
    
    # Calculate weighted grade
    total_weight = 0
    weighted_grade = 0
    
    if debug:
        print("\n=== GRADE CALCULATION DEBUG ===")
    
    for group_id, group_assignments in grouped_assignments.items():
        group_info = group_map.get(group_id, {})
        group_name = group_info.get('name', 'Unknown Group')
        group_weight = group_info.get('group_weight', 0)
        
        # Get drop rules
        drop_lowest = group_info.get('rules', {}).get('drop_lowest', 0)
        drop_highest = group_info.get('rules', {}).get('drop_highest', 0)
        never_drop = group_info.get('rules', {}).get('never_drop', [])
        
        # Collect all assignments with their scores
        all_assignments = []
        for i, s, assignment in group_assignments:
            points_possible = assignment.get("points_possible", 0)
            points_earned = s.get("score")
            assignment_id = assignment.get("id")
            
            # Check if this assignment has a modification
            if modifications and i in modifications:
                points_earned = modifications[i]
            
            # Only include assignments with points possible > 0
            if points_possible > 0:
                # For graded assignments
                if points_earned is not None:
                    percentage = (points_earned / points_possible) * 100
                    all_assignments.append({
                        'earned': points_earned,
                        'possible': points_possible,
                        'percentage': percentage,
                        'name': assignment.get('name', 'Unknown'),
                        'id': assignment_id,
                        'never_drop': assignment_id in never_drop,
                        'graded': True
                    })
        
        # Apply drop rules only to graded assignments
        if len(all_assignments) > 0:
            # Separate never_drop assignments
            never_drop_assignments = [a for a in all_assignments if a.get('never_drop', False)]
            droppable = [a for a in all_assignments if not a.get('never_drop', False)]
            
            # Sort droppable by percentage
            droppable_sorted = sorted(droppable, key=lambda x: x['percentage'])
            
            # Drop lowest
            if drop_lowest > 0 and len(droppable_sorted) > drop_lowest:
                droppable_sorted = droppable_sorted[drop_lowest:]
            
            # Drop highest
            if drop_highest > 0 and len(droppable_sorted) > drop_highest:
                droppable_sorted = droppable_sorted[:-drop_highest]
            
            # Combine never_drop and remaining droppable
            final_assignments = never_drop_assignments + droppable_sorted
            
            # Calculate group score
            group_earned = sum(a['earned'] for a in final_assignments)
            group_possible = sum(a['possible'] for a in final_assignments)
            
            if group_possible > 0:
                group_percentage = (group_earned / group_possible) * 100
                weighted_grade += (group_percentage * group_weight / 100)
                total_weight += group_weight
                
                if debug:
                    print(f"\n{group_name}:")
                    print(f"  Weight: {group_weight}%")
                    print(f"  Drop Lowest: {drop_lowest}, Drop Highest: {drop_highest}")
                    print(f"  Assignments counted: {len(final_assignments)} (dropped: {len(all_assignments) - len(final_assignments)})")
                    print(f"  Score: {group_earned:.2f} / {group_possible:.2f} = {group_percentage:.2f}%")
                    print(f"  Contribution: {group_percentage * group_weight / 100:.2f}%")
    
    if debug:
        print(f"\nTotal Weighted Grade: {weighted_grade:.2f}%")
        print(f"Total Weight Used: {total_weight}%")
    
    # If no weights are set, fall back to simple calculation
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

def get_course_enrollment(course_id):
    """Get enrollment data with grade information"""
    url = f"{BASE_URL}/courses/{course_id}/enrollments?user_id={USER_ID}"
    response = requests.get(url, headers=headers)
    enrollments = response.json()
    if enrollments:
        return enrollments[0]
    return None

def what_if_analysis(course_id):
    """Run what-if analysis on a course"""
    assignments = get_assignments(course_id)
    assignment_groups = get_assignment_groups(course_id)
    
    display_assignments(assignments, assignment_groups)
    
    # Calculate current grade
    current_grade = calculate_grade(assignments, assignment_groups)
    if current_grade is not None:
        print(f"\n=== CURRENT GRADE ===")
        print(f"Current percentage: {current_grade:.2f}%")
    else:
        print("\nNo graded assignments yet.")
    
    # What-if modifications
    print("\n=== WHAT-IF ANALYSIS ===")
    print("Enter modifications (or press Enter to finish)")
    print("Format: assignment_number new_score")
    print("Example: 5 95  (changes assignment #5 to 95 points)")
    
    modifications = {}
    while True:
        user_input = input("\nModification (or Enter to calculate): ").strip()
        if not user_input:
            break
        
        try:
            parts = user_input.split()
            assignment_num = int(parts[0]) - 1  # Convert to 0-indexed
            new_score = float(parts[1])
            
            if 0 <= assignment_num < len(assignments):
                modifications[assignment_num] = new_score
                print(f"✓ Updated assignment #{assignment_num + 1} to {new_score} points")
            else:
                print(f"❌ Invalid assignment number. Must be between 1 and {len(assignments)}")
        except (ValueError, IndexError):
            print("❌ Invalid format. Use: assignment_number new_score")
    
    # Calculate new grade with modifications
    if modifications:
        new_grade = calculate_grade(assignments, assignment_groups, modifications)
        if new_grade is not None:
            print(f"\n=== PROJECTED GRADE ===")
            print(f"New percentage: {new_grade:.2f}%")
            if current_grade is not None:
                change = new_grade - current_grade
                print(f"Change: {change:+.2f}%")

# Main menu
def main():
    global API_TOKEN, headers
    
    print("\n" + "="*50)
    print("CANVAS GRADE CALCULATOR")
    print("="*50)
    print("\nTo get your Canvas API token:")
    print("1. Log into Canvas")
    print("2. Go to Account → Settings")
    print("3. Scroll to 'Approved Integrations'")
    print("4. Click '+ New Access Token'")
    print("5. Copy the token\n")
    
    API_TOKEN = input("Enter your Canvas API token: ").strip()
    
    if not API_TOKEN:
        print("❌ API token is required")
        return
    
    headers = {
        "Authorization": f"Bearer {API_TOKEN}"
    }
    
    while True:
        print("\n" + "="*50)
        print("CANVAS GRADE CALCULATOR")
        print("="*50)
        print("1. View all courses")
        print("2. Analyze a specific course")
        print("3. Exit")
        
        choice = input("\nChoice: ").strip()
        
        if choice == "1":
            get_all_courses()
        elif choice == "2":
            course_id = input("\nEnter Course ID: ").strip()
            try:
                what_if_analysis(int(course_id))
            except ValueError:
                print("❌ Invalid Course ID")
        elif choice == "3":
            print("Goodbye!")
            break
        else:
            print("❌ Invalid choice")

if __name__ == "__main__":
    main()