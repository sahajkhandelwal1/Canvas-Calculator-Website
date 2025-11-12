import { useState, useEffect } from 'react'
import './App.css'

function App() {
  const [token, setToken] = useState(() => {
    return localStorage.getItem('canvasToken') || ''
  })
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [courses, setCourses] = useState([])
  const [selectedCourse, setSelectedCourse] = useState(null)
  const [assignments, setAssignments] = useState([])
  const [assignmentGroups, setAssignmentGroups] = useState([])
  const [modifications, setModifications] = useState({})
  const [currentGrade, setCurrentGrade] = useState(null)
  const [projectedGrade, setProjectedGrade] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [upcomingAssignments, setUpcomingAssignments] = useState([])
  const [loadingUpcoming, setLoadingUpcoming] = useState(false)

  // Auto-login if token exists
  useEffect(() => {
    const savedToken = localStorage.getItem('canvasToken')
    if (savedToken && !isAuthenticated) {
      setToken(savedToken)
      // Trigger login automatically
      handleLogin({ preventDefault: () => {} })
    }
  }, [])

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    
    try {
      const response = await fetch('/api/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      })
      
      if (!response.ok) throw new Error('Invalid token or network error')
      
      const data = await response.json()
      setCourses(data)
      setIsAuthenticated(true)
      
      // Save token to localStorage
      localStorage.setItem('canvasToken', token)
      
      // Fetch upcoming assignments in background
      setLoadingUpcoming(true)
      fetch('/api/upcoming-assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      })
        .then(res => {
          if (res.ok) return res.json()
          throw new Error('Failed to fetch')
        })
        .then(data => {
          console.log('Upcoming assignments received:', data)
          setUpcomingAssignments(data || [])
          setLoadingUpcoming(false)
        })
        .catch(err => {
          console.error('Error fetching upcoming:', err)
          setLoadingUpcoming(false)
        })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const loadCourse = async (courseId) => {
    setLoading(true)
    setError('')
    setModifications({})
    setProjectedGrade(null)
    
    try {
      const [assignmentsRes, groupsRes] = await Promise.all([
        fetch(`/api/course/${courseId}/assignments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token })
        }),
        fetch(`/api/course/${courseId}/groups`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token })
        })
      ])
      
      if (!assignmentsRes.ok || !groupsRes.ok) throw new Error('Failed to load course data')
      
      const assignmentsData = await assignmentsRes.json()
      const groupsData = await groupsRes.json()
      
      setAssignments(assignmentsData)
      setAssignmentGroups(groupsData)
      setSelectedCourse(courses.find(c => c.id === courseId))
      
      const gradeRes = await fetch('/api/calculate-grade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignments: assignmentsData,
          assignment_groups: groupsData,
          modifications: {}
        })
      })
      
      const gradeData = await gradeRes.json()
      setCurrentGrade(gradeData.grade)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleModification = (index, value) => {
    const newMods = { ...modifications }
    if (value === '' || value === null) {
      delete newMods[index]
    } else {
      newMods[index] = parseFloat(value)
    }
    setModifications(newMods)
  }

  const calculateProjectedGrade = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/calculate-grade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignments,
          assignment_groups: assignmentGroups,
          modifications
        })
      })
      
      const data = await response.json()
      setProjectedGrade(data.grade)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const groupedAssignments = () => {
    const grouped = {}
    const groupMap = {}
    
    assignmentGroups.forEach(g => {
      groupMap[g.id] = g
      grouped[g.id] = []
    })
    
    assignments.forEach((s, i) => {
      const assignment = s.assignment || {}
      const groupId = assignment.assignment_group_id
      if (groupId && grouped[groupId]) {
        grouped[groupId].push({ ...s, index: i })
      }
    })
    
    return { grouped, groupMap }
  }

  if (!isAuthenticated) {
    return (
      <div className="container">
        <div className="login-card">
          <h1>Canvas Grade Calculator</h1>
          <div className="instructions">
            <p>To get your Canvas API token:</p>
            <ol>
              <li>Log into Canvas</li>
              <li>Go to Account → Settings</li>
              <li>Scroll to "Approved Integrations"</li>
              <li>Click "+ New Access Token"</li>
              <li>Copy the token</li>
            </ol>
          </div>
          <form onSubmit={handleLogin}>
            <input
              type="password"
              placeholder="Enter your Canvas API token"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              required
            />
            <button type="submit" disabled={loading}>
              {loading ? 'Connecting...' : 'Connect to Canvas'}
            </button>
          </form>
          {error && <div className="error">{error}</div>}
        </div>
      </div>
    )
  }

  if (!selectedCourse) {
    return (
      <div className="container">
        <div className="header">
          <h1>Your Courses</h1>
          <button onClick={() => {
            setIsAuthenticated(false)
            localStorage.removeItem('canvasToken')
            setToken('')
          }} className="logout-btn">
            Logout
          </button>
        </div>
        <div className="courses-grid">
          {courses.map(course => (
            <div key={course.id} className="course-card" onClick={() => loadCourse(course.id)}>
              <h3>{course.name}</h3>
              {course.current_score !== null ? (
                <div className="grade">
                  <span className="grade-letter">{course.current_grade}</span>
                  <span className="grade-percent">{course.current_score?.toFixed(2)}%</span>
                </div>
              ) : (
                <div className="no-grade">No grade yet</div>
              )}
            </div>
          ))}
        </div>

        {(loadingUpcoming || upcomingAssignments.length > 0) && (
          <div className="upcoming-section">
            <h2>📋 Upcoming Assignments</h2>
            {loadingUpcoming && (
              <div className="loading-upcoming">Loading assignments...</div>
            )}
            {!loadingUpcoming && upcomingAssignments.length === 0 && (
              <div className="no-upcoming">No upcoming assignments found</div>
            )}
            {!loadingUpcoming && upcomingAssignments.length > 0 && (
            <div className="upcoming-list">
              {upcomingAssignments.map((assignment, index) => {
                const dueDate = new Date(assignment.due_at)
                const now = new Date()
                const daysUntil = Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24))
                const isUrgent = daysUntil <= 2
                
                return (
                  <div key={index} className={`upcoming-item ${isUrgent ? 'urgent' : ''}`}>
                    <div className="upcoming-info">
                      <div className="upcoming-course">{assignment.course_name}</div>
                      <div className="upcoming-name">{assignment.assignment_name}</div>
                      <div className="upcoming-meta">
                        <span className="upcoming-points">{assignment.points_possible} pts</span>
                        <span className="upcoming-due">
                          {isUrgent ? '🔥 ' : ''}
                          Due {dueDate.toLocaleDateString()} at {dueDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </span>
                      </div>
                    </div>
                    {assignment.html_url && (
                      <a 
                        href={assignment.html_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="view-btn"
                        onClick={(e) => e.stopPropagation()}
                      >
                        View
                      </a>
                    )}
                  </div>
                )
              })}
            </div>
            )}
          </div>
        )}
      </div>
    )
  }

  const { grouped, groupMap } = groupedAssignments()

  return (
    <div className="container">
      <div className="header">
        <button onClick={() => setSelectedCourse(null)} className="back-btn">
          ← Back to Courses
        </button>
        <h1>{selectedCourse.name}</h1>
      </div>

      {currentGrade !== null && (
        <div className="grade-summary">
          <div className="grade-box">
            <label>Current Grade</label>
            <div className="grade-value">{currentGrade.toFixed(2)}%</div>
          </div>
          {projectedGrade !== null && (
            <>
              <div className="grade-box">
                <label>Projected Grade</label>
                <div className="grade-value">{projectedGrade.toFixed(2)}%</div>
              </div>
              <div className="grade-box">
                <label>Change</label>
                <div className={`grade-value ${projectedGrade - currentGrade >= 0 ? 'positive' : 'negative'}`}>
                  {(projectedGrade - currentGrade >= 0 ? '+' : '')}{(projectedGrade - currentGrade).toFixed(2)}%
                </div>
              </div>
            </>
          )}
        </div>
      )}

      <div className="assignments-section">
        <h2>What-If Analysis</h2>
        <p className="hint">Modify assignment scores to see projected grade changes</p>
        
        {Object.entries(grouped).map(([groupId, groupAssignments]) => {
          const group = groupMap[groupId]
          if (!group || groupAssignments.length === 0) return null
          
          return (
            <div key={groupId} className="assignment-group">
              <h3>
                {group.name}
                {group.group_weight > 0 && <span className="weight"> ({group.group_weight}%)</span>}
              </h3>
              <div className="assignments-list">
                {groupAssignments.map(({ assignment, score, index }) => {
                  const pointsPossible = assignment?.points_possible || 0
                  const currentScore = modifications[index] !== undefined ? modifications[index] : score
                  
                  return (
                    <div key={index} className="assignment-item">
                      <div className="assignment-info">
                        <span className="assignment-name">{assignment?.name || 'Unknown'}</span>
                        <span className="assignment-points">
                          {score !== null ? `${score} / ${pointsPossible}` : `Not graded / ${pointsPossible}`}
                        </span>
                      </div>
                      <input
                        type="number"
                        step="0.01"
                        max={pointsPossible}
                        placeholder={score !== null ? score : 'Enter score'}
                        value={modifications[index] !== undefined ? modifications[index] : ''}
                        onChange={(e) => handleModification(index, e.target.value)}
                        className="score-input"
                      />
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}

        <button 
          onClick={calculateProjectedGrade} 
          disabled={loading || Object.keys(modifications).length === 0}
          className="calculate-btn"
        >
          {loading ? 'Calculating...' : 'Calculate Projected Grade'}
        </button>
      </div>

      {error && <div className="error">{error}</div>}
    </div>
  )
}

export default App
