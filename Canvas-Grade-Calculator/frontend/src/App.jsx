import { useState, useEffect } from 'react'
import { Analytics } from "@vercel/analytics/react"
import CountUp from './CountUp'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import './App.css'

function SortableCourseCard({ course, onClick }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: course.id,
    transition: {
      duration: 200,
      easing: 'cubic-bezier(0.25, 1, 0.5, 1)',
    },
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition || 'transform 200ms cubic-bezier(0.25, 1, 0.5, 1)',
  }

  const handleClick = (e) => {
    if (!isDragging) {
      onClick()
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`course-card ${isDragging ? 'dragging' : ''}`}
      onClick={handleClick}
    >
      <h3>{course.name}</h3>
      {course.current_score !== null ? (
        <div className="grade">
          <span className="grade-letter">{course.current_grade}</span>
          <span className="grade-percent">
            <CountUp 
              from={0} 
              to={course.current_score} 
              duration={1}
              className="count-up-text"
            />%
          </span>
        </div>
      ) : (
        <div className="no-grade">No grade yet</div>
      )}
    </div>
  )
}

function App() {
  const [token, setToken] = useState(() => {
    return localStorage.getItem('canvasToken') || ''
  })
  const [canvasUrl, setCanvasUrl] = useState(() => {
    return localStorage.getItem('canvasUrl') || 'cuhsd.instructure.com'
  })
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [courses, setCourses] = useState([])
  const [selectedCourse, setSelectedCourse] = useState(null)
  const [assignments, setAssignments] = useState([])
  const [assignmentGroups, setAssignmentGroups] = useState([])
  const [modifications, setModifications] = useState({})
  const [droppedAssignments, setDroppedAssignments] = useState({})
  const [currentGrade, setCurrentGrade] = useState(null)
  const [projectedGrade, setProjectedGrade] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [upcomingAssignments, setUpcomingAssignments] = useState([])
  const [loadingUpcoming, setLoadingUpcoming] = useState(false)
  const [hypotheticalAssignments, setHypotheticalAssignments] = useState({})
  const [showSlowLoadingMessage, setShowSlowLoadingMessage] = useState(false)
  const [showBgCustomizer, setShowBgCustomizer] = useState(false)
  const [backgroundImage, setBackgroundImage] = useState(() => {
    return localStorage.getItem('backgroundImage') || 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1920&q=80'
  })

  const presetBackgrounds = [
    { name: 'Network', url: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1920&q=80' },
    { name: 'Ocean Waves', url: 'https://images.unsplash.com/photo-1505142468610-359e7d316be0?w=1920&q=80' },
    { name: 'Mountain Peak', url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&q=80' },
    { name: 'City Lights', url: 'https://images.unsplash.com/photo-1514565131-fce0801e5785?w=1920&q=80' },
    { name: 'Forest Path', url: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1920&q=80' },
    { name: 'Desert Dunes', url: 'https://images.unsplash.com/photo-1509316785289-025f5b846b35?w=1920&q=80' },
    { name: 'Northern Lights', url: 'https://images.unsplash.com/photo-1531366936337-7c912a4589a7?w=1920&q=80' },
    { name: 'Dark Gradient', url: '' },
  ]

  const changeBackground = (url) => {
    setBackgroundImage(url)
    localStorage.setItem('backgroundImage', url)
    document.body.style.backgroundImage = url 
      ? `linear-gradient(135deg, rgba(0, 0, 0, 0.6) 0%, rgba(26, 26, 26, 0.65) 50%, rgba(10, 10, 10, 0.6) 100%), url('${url}')`
      : 'linear-gradient(135deg, #000000 0%, #1a1a1a 50%, #0a0a0a 100%)'
  }

  const handleCustomImage = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('Image size should be less than 5MB')
        return
      }
      const reader = new FileReader()
      reader.onload = (event) => {
        const result = event.target?.result
        if (result && typeof result === 'string') {
          changeBackground(result)
          setShowBgCustomizer(false)
        }
      }
      reader.onerror = () => {
        alert('Failed to read image file')
      }
      reader.readAsDataURL(file)
    }
  }

  useEffect(() => {
    // Apply saved background on load
    if (backgroundImage) {
      changeBackground(backgroundImage)
    }
  }, [])

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px movement before drag starts
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = (event) => {
    const { active, over } = event

    if (active.id !== over.id) {
      setCourses((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id)
        const newIndex = items.findIndex((item) => item.id === over.id)
        const newOrder = arrayMove(items, oldIndex, newIndex)
        
        // Save order to localStorage
        const orderMap = {}
        newOrder.forEach((course, index) => {
          orderMap[course.id] = index
        })
        localStorage.setItem('courseOrder', JSON.stringify(orderMap))
        
        return newOrder
      })
    }
  }

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
    setShowSlowLoadingMessage(false)
    
    // Show slow loading message after 3 seconds
    const slowLoadingTimer = setTimeout(() => {
      setShowSlowLoadingMessage(true)
    }, 3000)
    
    try {
      const response = await fetch('/api/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, canvasUrl })
      })
      
      if (!response.ok) throw new Error('Invalid token or network error')
      
      const data = await response.json()
      
      // Load saved course order
      const savedOrder = localStorage.getItem('courseOrder')
      if (savedOrder) {
        try {
          const orderMap = JSON.parse(savedOrder)
          const orderedCourses = [...data].sort((a, b) => {
            const orderA = orderMap[a.id] ?? 999
            const orderB = orderMap[b.id] ?? 999
            return orderA - orderB
          })
          setCourses(orderedCourses)
        } catch {
          setCourses(data)
        }
      } else {
        setCourses(data)
      }
      
      setIsAuthenticated(true)
      
      // Save token and Canvas URL to localStorage
      localStorage.setItem('canvasToken', token)
      localStorage.setItem('canvasUrl', canvasUrl)
      
      // Fetch upcoming assignments in background
      setLoadingUpcoming(true)
      fetch('/api/upcoming-assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, canvasUrl })
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
      clearTimeout(slowLoadingTimer)
      setLoading(false)
      setShowSlowLoadingMessage(false)
    }
  }

  const loadCourse = async (courseId) => {
    setLoading(true)
    setError('')
    setModifications({})
    setDroppedAssignments({})
    setProjectedGrade(null)
    setHypotheticalAssignments({})
    setSelectedCourse({ id: courseId, name: 'Loading...', loading: true })
    
    try {
      const [assignmentsRes, groupsRes] = await Promise.all([
        fetch(`/api/course/${courseId}/assignments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, canvasUrl })
        }),
        fetch(`/api/course/${courseId}/groups`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, canvasUrl })
        })
      ])
      
      if (!assignmentsRes.ok || !groupsRes.ok) {
        throw new Error('Failed to load course data. Please try refreshing.')
      }
      
      let assignmentsData, groupsData
      try {
        assignmentsData = await assignmentsRes.json()
        groupsData = await groupsRes.json()
      } catch (jsonError) {
        console.error('JSON parse error:', jsonError)
        throw new Error('Invalid response from Canvas API. Your session may have expired.')
      }
      
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

  const toggleDropAssignment = (index) => {
    setDroppedAssignments(prev => {
      const newDropped = { ...prev }
      if (newDropped[index]) {
        delete newDropped[index]
      } else {
        newDropped[index] = true
      }
      return newDropped
    })
  }

  const addHypotheticalAssignment = (groupId) => {
    const newId = `hypo-${Date.now()}`
    setHypotheticalAssignments(prev => ({
      ...prev,
      [groupId]: [...(prev[groupId] || []), { id: newId, name: '', score: '', pointsPossible: '' }]
    }))
  }

  const updateHypotheticalAssignment = (groupId, assignmentId, field, value) => {
    setHypotheticalAssignments(prev => ({
      ...prev,
      [groupId]: prev[groupId].map(a => 
        a.id === assignmentId ? { ...a, [field]: value } : a
      )
    }))
  }

  const removeHypotheticalAssignment = (groupId, assignmentId) => {
    setHypotheticalAssignments(prev => ({
      ...prev,
      [groupId]: prev[groupId].filter(a => a.id !== assignmentId)
    }))
  }

  const calculateProjectedGrade = async () => {
    setLoading(true)
    try {
      // Filter out dropped assignments and merge hypothetical assignments
      const filteredAssignments = assignments.filter((_, index) => !droppedAssignments[index])
      const allAssignments = [...filteredAssignments]
      
      Object.entries(hypotheticalAssignments).forEach(([groupId, hypoAssignments]) => {
        hypoAssignments.forEach(hypo => {
          if (hypo.score !== '' && hypo.pointsPossible !== '') {
            allAssignments.push({
              assignment: {
                assignment_group_id: parseInt(groupId),
                points_possible: parseFloat(hypo.pointsPossible),
                name: hypo.name || 'Hypothetical Assignment'
              },
              score: parseFloat(hypo.score)
            })
          }
        })
      })
      
      const response = await fetch('/api/calculate-grade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignments: allAssignments,
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
          <h1>Canvas Plus</h1>
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
              type="text"
              placeholder="Canvas URL (e.g., school.instructure.com)"
              value={canvasUrl}
              onChange={(e) => setCanvasUrl(e.target.value.replace(/^https?:\/\//, '').replace(/\/$/, ''))}
              required
            />
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
          {showSlowLoadingMessage && (
            <div className="slow-loading-message">
              The server may be waking up from inactivity. This can slow down the first load.
            </div>
          )}
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
            localStorage.removeItem('canvasUrl')
            setToken('')
            setCanvasUrl('cuhsd.instructure.com')
          }} className="logout-btn">
            Logout
          </button>
        </div>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={courses.map(c => c.id)}
            strategy={rectSortingStrategy}
          >
            <div className="courses-grid">
              {courses.map(course => (
                <SortableCourseCard
                  key={course.id}
                  course={course}
                  onClick={() => loadCourse(course.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

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

        {/* Background Customizer Corner Button */}
        <button 
          className="bg-customizer-tab"
          onClick={() => setShowBgCustomizer(!showBgCustomizer)}
          title="Customize Background"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21 15 16 10 5 21"/>
          </svg>
        </button>
        
        {/* Background Customizer Overlay */}
        {showBgCustomizer && (
          <>
            <div className="bg-overlay" onClick={() => setShowBgCustomizer(false)}></div>
            <div className="bg-customizer-panel">
              <div className="bg-panel-header">
                <h3>Customize Background</h3>
                <button onClick={() => setShowBgCustomizer(false)} className="close-panel-btn">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
              <div className="bg-panel-content">
                <div className="bg-section">
                  <h4>Preset Backgrounds</h4>
                  <div className="bg-presets-grid">
                    {presetBackgrounds.map((bg) => (
                      <button
                        key={bg.name}
                        onClick={() => changeBackground(bg.url)}
                        className={`bg-preset-card ${backgroundImage === bg.url ? 'active' : ''}`}
                      >
                        <div 
                          className="bg-preview" 
                          style={{
                            backgroundImage: bg.url ? `url('${bg.url}')` : 'linear-gradient(135deg, #000000 0%, #1a1a1a 50%, #0a0a0a 100%)'
                          }}
                        ></div>
                        <span className="bg-preset-name">{bg.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="bg-section">
                  <h4>Custom Image</h4>
                  <label htmlFor="custom-bg" className="custom-bg-upload">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                      <polyline points="17 8 12 3 7 8"/>
                      <line x1="12" y1="3" x2="12" y2="15"/>
                    </svg>
                    <span>Upload Image</span>
                  </label>
                  <input
                    id="custom-bg"
                    type="file"
                    accept="image/*"
                    onChange={handleCustomImage}
                    style={{ display: 'none' }}
                  />
                </div>
              </div>
            </div>
          </>
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

      {loading && (
        <div className="loading-overlay">
          <div className="loading-spinner"></div>
          <div className="loading-text">Loading course data...</div>
          <div className="loading-watermark">Made by Sahaj Khandelwal</div>
        </div>
      )}

      {!loading && (
        <>

      {currentGrade !== null && (
        <div className="grade-summary">
          <div className="grade-box">
            <label>Current Grade</label>
            <div className="grade-value">
              <CountUp 
                from={0} 
                to={currentGrade} 
                duration={1}
                className="count-up-text"
              />%
            </div>
          </div>
          {projectedGrade !== null && (
            <>
              <div className="grade-box">
                <label>Projected Grade</label>
                <div className="grade-value">
                  <CountUp 
                    from={currentGrade} 
                    to={projectedGrade} 
                    duration={1}
                    className="count-up-text"
                  />%
                </div>
              </div>
              <div className="grade-box">
                <label>Change</label>
                <div className={`grade-value ${projectedGrade - currentGrade >= 0 ? 'positive' : 'negative'}`}>
                  {(projectedGrade - currentGrade >= 0 ? '+' : '')}
                  <CountUp 
                    from={0} 
                    to={Math.abs(projectedGrade - currentGrade)} 
                    duration={1}
                    className="count-up-text"
                  />%
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
          
          // Calculate category average (current and projected)
          const gradedAssignments = groupAssignments.filter(({ score, assignment }) => {
            const pointsPossible = assignment?.points_possible || 0
            // Only include assignments that are graded AND have points possible > 0
            return score !== null && score !== undefined && pointsPossible > 0
          })
          
          let categoryAverage = null
          let projectedCategoryAverage = null
          let hasModifications = false
          
          if (gradedAssignments.length > 0) {
            // Current average
            const totalEarned = gradedAssignments.reduce((sum, { score }) => {
              return sum + (score || 0)
            }, 0)
            const totalPossible = gradedAssignments.reduce((sum, { assignment }) => {
              return sum + (assignment?.points_possible || 0)
            }, 0)
            
            if (totalPossible > 0) {
              categoryAverage = ((totalEarned / totalPossible) * 100).toFixed(2)
            }
            
            // Projected average (with modifications)
            const totalEarnedModified = gradedAssignments.reduce((sum, { score, index }) => {
              const modifiedScore = modifications[index] !== undefined ? modifications[index] : score
              return sum + (modifiedScore || 0)
            }, 0)
            
            if (totalPossible > 0) {
              projectedCategoryAverage = ((totalEarnedModified / totalPossible) * 100).toFixed(2)
              hasModifications = Object.keys(modifications).some(modIndex => 
                gradedAssignments.some(({ index }) => index === parseInt(modIndex))
              )
            }
          }
          
          return (
            <div key={groupId} className="assignment-group">
              <div className="group-header">
                <h3>
                  {group.name}
                  {group.group_weight > 0 && <span className="weight"> ({group.group_weight}%)</span>}
                </h3>
                {categoryAverage !== null && (
                  <div className="category-average">
                    Average: <span className="average-value">{categoryAverage}%</span>
                    {hasModifications && projectedCategoryAverage !== categoryAverage && (
                      <>
                        <span className="arrow">→</span>
                        <span className={`projected-value ${parseFloat(projectedCategoryAverage) >= parseFloat(categoryAverage) ? 'positive' : 'negative'}`}>
                          {projectedCategoryAverage}%
                        </span>
                        <span className={`change-badge ${parseFloat(projectedCategoryAverage) >= parseFloat(categoryAverage) ? 'positive' : 'negative'}`}>
                          {parseFloat(projectedCategoryAverage) >= parseFloat(categoryAverage) ? '+' : ''}
                          {(parseFloat(projectedCategoryAverage) - parseFloat(categoryAverage)).toFixed(2)}%
                        </span>
                      </>
                    )}
                  </div>
                )}
              </div>
              <div className="assignments-list">
                {groupAssignments.map(({ assignment, score, index }) => {
                  const pointsPossible = assignment?.points_possible || 0
                  const currentScore = modifications[index] !== undefined ? modifications[index] : score
                  const percentage = pointsPossible > 0 && score !== null ? ((score / pointsPossible) * 100).toFixed(2) : null
                  
                  const assignmentUrl = assignment?.html_url
                  
                  const handleAssignmentClick = (e) => {
                    if (assignmentUrl && e.target.tagName !== 'INPUT') {
                      window.open(assignmentUrl, '_blank', 'noopener,noreferrer')
                    }
                  }
                  
                  return (
                    <div 
                      key={index} 
                      className={`assignment-item ${assignmentUrl ? 'clickable' : ''} ${droppedAssignments[index] ? 'dropped' : ''}`}
                      onClick={handleAssignmentClick}
                    >
                      <label className="drop-checkbox" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={droppedAssignments[index] || false}
                          onChange={() => toggleDropAssignment(index)}
                          title="Drop this assignment from grade calculation"
                        />
                        <span className="checkbox-label">Drop</span>
                      </label>
                      <div className="assignment-info">
                        <span className="assignment-name">
                          {assignment?.name || 'Unknown'}
                          {assignmentUrl && <span className="external-link-icon"> ↗</span>}
                        </span>
                        <span className="assignment-points">
                          {score !== null ? (
                            <>
                              {percentage !== null && (
                                <span className="assignment-percentage">
                                  ({percentage}%)
                                  {modifications[index] !== undefined && pointsPossible > 0 && (
                                    <>
                                      <span className="arrow-small"> → </span>
                                      <span className={`what-if-percentage ${parseFloat(((modifications[index] / pointsPossible) * 100).toFixed(2)) >= parseFloat(percentage) ? 'positive' : 'negative'}`}>
                                        ({((modifications[index] / pointsPossible) * 100).toFixed(2)}%)
                                      </span>
                                    </>
                                  )}
                                </span>
                              )}
                              {' '}{score} / {pointsPossible}
                            </>
                          ) : (
                            `Not graded / ${pointsPossible}`
                          )}
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
                        disabled={droppedAssignments[index]}
                      />
                    </div>
                  )
                })}
                
                {/* Hypothetical Assignments */}
                {hypotheticalAssignments[groupId]?.map((hypo) => (
                  <div key={hypo.id} className="assignment-item hypothetical">
                    <div className="assignment-info">
                      <input
                        type="text"
                        placeholder="Assignment name (optional)"
                        value={hypo.name}
                        onChange={(e) => updateHypotheticalAssignment(groupId, hypo.id, 'name', e.target.value)}
                        className="hypo-name-input"
                      />
                      <div className="hypo-scores">
                        <input
                          type="number"
                          step="0.01"
                          placeholder="Score"
                          value={hypo.score}
                          onChange={(e) => updateHypotheticalAssignment(groupId, hypo.id, 'score', e.target.value)}
                          className="hypo-score-input"
                        />
                        <span>/</span>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="Total"
                          value={hypo.pointsPossible}
                          onChange={(e) => updateHypotheticalAssignment(groupId, hypo.id, 'pointsPossible', e.target.value)}
                          className="hypo-score-input"
                        />
                      </div>
                    </div>
                    <button
                      onClick={() => removeHypotheticalAssignment(groupId, hypo.id)}
                      className="remove-hypo-btn"
                      title="Remove"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                
                <button
                  onClick={() => addHypotheticalAssignment(groupId)}
                  className="add-hypo-btn"
                >
                  + Add Hypothetical Assignment
                </button>
              </div>
            </div>
          )
        })}

        <button 
          onClick={calculateProjectedGrade} 
          disabled={loading || (Object.keys(modifications).length === 0 && Object.keys(hypotheticalAssignments).length === 0 && Object.keys(droppedAssignments).length === 0)}
          className="calculate-btn"
        >
          {loading ? 'Calculating...' : 'Calculate Projected Grade'}
        </button>
      </div>

      {error && (
        <div className="error">
          <strong>Error:</strong> {error}
          <button onClick={() => setError('')} className="dismiss-error">Dismiss</button>
        </div>
      )}
      </>
      )}
      <Analytics />
    </div>
  )
}

export default App
