import { useState, useEffect, useRef } from 'react'
import { Analytics } from "@vercel/analytics/react"
import CountUp from './CountUp'
import BounceCards from './BounceCards'
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

function SortableCourseCard({ course, onClick, displayName }) {
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
      <h3>{displayName}</h3>
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
  const [overdueAssignments, setOverdueAssignments] = useState([])
  const [loadingOverdue, setLoadingOverdue] = useState(false)
  const [assignmentsTab, setAssignmentsTab] = useState('upcoming')
  const [hypotheticalAssignments, setHypotheticalAssignments] = useState({})
  const [showSlowLoadingMessage, setShowSlowLoadingMessage] = useState(false)
  const [loadingProgress, setLoadingProgress] = useState(0)
  const [isInitialLoad, setIsInitialLoad] = useState(true)
  const [showFeedback, setShowFeedback] = useState(false)
  const [feedbackText, setFeedbackText] = useState('')
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false)
  const [showBgCustomizer, setShowBgCustomizer] = useState(false)
  const [hiddenCourses, setHiddenCourses] = useState(() => {
    const saved = localStorage.getItem('hiddenCourses')
    return saved ? JSON.parse(saved) : {}
  })
  const [showCourseManager, setShowCourseManager] = useState(false)
  const [showBounceCards, setShowBounceCards] = useState(() => {
    const saved = localStorage.getItem('showBounceCards')
    return saved !== null ? JSON.parse(saved) : true // Default to true
  })
  const [backgroundImage, setBackgroundImage] = useState(() => {
    return localStorage.getItem('backgroundImage') || 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1920&q=80'
  })
  const [customCourseNames, setCustomCourseNames] = useState(() => {
    const saved = localStorage.getItem('customCourseNames')
    return saved ? JSON.parse(saved) : {}
  })
  const [showNameEditor, setShowNameEditor] = useState(false)
  const [userInfo, setUserInfo] = useState({ name: 'Anonymous', id: null })
  const [assignmentSearch, setAssignmentSearch] = useState('')
  const [showAssignmentSearch, setShowAssignmentSearch] = useState(false)
  const [showCalculatePrompt, setShowCalculatePrompt] = useState(false)
  const [selectedAssignmentDetail, setSelectedAssignmentDetail] = useState(null)
  const [showAssignmentDetail, setShowAssignmentDetail] = useState(false)
  const [selectedSemester, setSelectedSemester] = useState(() => {
    return localStorage.getItem('selectedSemester') || 'all'
  })
  const [semester1Grade, setSemester1Grade] = useState(null)
  const [semester2Grade, setSemester2Grade] = useState(null)
  const [courseSemesterGrades, setCourseSemesterGrades] = useState({})
  const [loadingSemesterGrades, setLoadingSemesterGrades] = useState(false)
  const hasAppliedInitialSemesterFilter = useRef(false)
  
  // Cache for course data to speed up semester calculations
  const [courseDataCache, setCourseDataCache] = useState(() => {
    const cached = localStorage.getItem('courseDataCache')
    return cached ? JSON.parse(cached) : {}
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
    
    // Apply background with mobile fallback
    const backgroundStyle = url 
      ? `linear-gradient(135deg, rgba(0, 0, 0, 0.6) 0%, rgba(26, 26, 26, 0.65) 50%, rgba(10, 10, 10, 0.6) 100%), url('${url}')`
      : 'linear-gradient(135deg, #000000 0%, #1a1a1a 50%, #0a0a0a 100%)'
    
    document.body.style.backgroundImage = backgroundStyle
    document.body.style.backgroundSize = 'cover'
    document.body.style.backgroundPosition = 'center'
    document.body.style.backgroundAttachment = 'fixed'
    document.body.style.backgroundColor = '#000000' // Fallback color
  }

  // Helper function to get display name (custom or original)
  const getDisplayName = (course) => {
    return customCourseNames[course.id] || course.name
  }

  // Cache management functions
  const getCachedCourseData = (courseId) => {
    const cached = courseDataCache[courseId]
    if (!cached) return null
    
    // Check if cache is still valid (24 hours)
    const cacheAge = Date.now() - cached.timestamp
    const maxAge = 24 * 60 * 60 * 1000 // 24 hours
    
    if (cacheAge > maxAge) {
      return null
    }
    
    return cached
  }

  const setCachedCourseData = (courseId, data) => {
    const newCache = {
      ...courseDataCache,
      [courseId]: {
        ...data,
        timestamp: Date.now()
      }
    }
    setCourseDataCache(newCache)
    localStorage.setItem('courseDataCache', JSON.stringify(newCache))
  }

  const clearCourseCache = () => {
    setCourseDataCache({})
    localStorage.removeItem('courseDataCache')
  }

  // Determine semester based on assignment due date
  const getSemester = (dueDate) => {
    if (!dueDate) return null
    
    const date = new Date(dueDate)
    const month = date.getMonth() + 1 // 0-indexed, so add 1
    const year = date.getFullYear()
    
    // Semester 1: August (8) to December (12)
    // Semester 2: January (1) to June (6)
    // Summer: July (7) - treat as semester 2
    
    if (month >= 8 && month <= 12) {
      return 1
    } else if (month >= 1 && month <= 7) {
      return 2
    }
    
    return null
  }

  // Convert score to letter grade using grading scheme
  const scoreToLetterGrade = (score, gradingScheme) => {
    if (score === null || score === undefined) {
      return 'N/A'
    }
    
    // If custom grading scheme provided, use it
    if (gradingScheme && Array.isArray(gradingScheme)) {
      // Sort by value descending to check from highest to lowest
      const sortedScheme = [...gradingScheme].sort((a, b) => {
        const aVal = Array.isArray(a) ? a[1] : a.value
        const bVal = Array.isArray(b) ? b[1] : b.value
        return bVal - aVal
      })
      
      for (const entry of sortedScheme) {
        let name, threshold
        
        // Handle both array format [name, value] and object format {name, value}
        if (Array.isArray(entry)) {
          name = entry[0]
          threshold = entry[1] * 100 // Canvas uses decimal (0.84 = 84%)
        } else if (entry.name && entry.value !== undefined) {
          name = entry.name
          threshold = entry.value * 100
        } else {
          continue
        }
        
        if (score >= threshold) {
          return name
        }
      }
    }
    
    // Default grading scale
    if (score >= 97) return "A+"
    else if (score >= 93) return "A"
    else if (score >= 90) return "A-"
    else if (score >= 87) return "B+"
    else if (score >= 83) return "B"
    else if (score >= 80) return "B-"
    else if (score >= 77) return "C+"
    else if (score >= 73) return "C"
    else if (score >= 70) return "C-"
    else if (score >= 67) return "D+"
    else if (score >= 63) return "D"
    else if (score >= 60) return "D-"
    else return "F"
  }

  // Filter assignments by semester
  const filterAssignmentsBySemester = (assignmentsList) => {
    if (selectedSemester === 'all') {
      return assignmentsList
    }
    
    return assignmentsList.filter((assignment) => {
      const dueDate = assignment?.assignment?.due_at
      if (!dueDate) return true // Include assignments without due dates
      
      const semester = getSemester(dueDate)
      return semester === parseInt(selectedSemester)
    })
  }

  // Save semester selection to localStorage
  const changeSemester = (semester) => {
    setSelectedSemester(semester)
    localStorage.setItem('selectedSemester', semester)
    
    // If on course detail page, recalculate current grade for the selected semester
    if (selectedCourse) {
      recalculateCurrentGrade(semester)
    }
    
    // Update course cards to show semester-specific grades
    updateCourseGradesForSemester(semester)
  }

  // Update course grades based on semester selection
  const updateCourseGradesForSemester = async (semester) => {
    if (semester === 'all') {
      // Reset to original grades
      setLoadingSemesterGrades(true)
      const response = await fetch('/api/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, canvasUrl })
      })
      
      if (response.ok) {
        const data = await response.json()
        const coursesData = data.courses || data
        
        // Maintain course order
        const savedOrder = localStorage.getItem('courseOrder')
        if (savedOrder) {
          try {
            const orderMap = JSON.parse(savedOrder)
            const orderedCourses = [...coursesData].sort((a, b) => {
              const orderA = orderMap[a.id] ?? 999
              const orderB = orderMap[b.id] ?? 999
              return orderA - orderB
            })
            setCourses(orderedCourses)
          } catch {
            setCourses(coursesData)
          }
        } else {
          setCourses(coursesData)
        }
      }
      setLoadingSemesterGrades(false)
    } else {
      // Calculate semester-specific grades for each course
      setLoadingSemesterGrades(true)
      const updatedCourses = await Promise.all(
        courses.map(async (course) => {
          try {
            // Check cache first
            const cachedData = getCachedCourseData(course.id)
            let assignmentsData, groupsData, gradingScheme
            
            if (cachedData) {
              // Use cached data
              assignmentsData = cachedData.assignments
              groupsData = cachedData.groups
              gradingScheme = cachedData.gradingScheme
              
              // Check if we have cached semester grade
              const semesterKey = `semester${semester}`
              if (cachedData[semesterKey]) {
                return {
                  ...course,
                  current_score: cachedData[semesterKey].score,
                  current_grade: cachedData[semesterKey].grade
                }
              }
            } else {
              // Fetch fresh data
              const [assignmentsRes, groupsRes, gradingSchemeRes] = await Promise.all([
                fetch(`/api/course/${course.id}/assignments`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ token, canvasUrl })
                }),
                fetch(`/api/course/${course.id}/groups`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ token, canvasUrl })
                }),
                fetch(`/api/course/${course.id}/grading-scheme`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ token, canvasUrl })
                })
              ])
              
              if (!assignmentsRes.ok || !groupsRes.ok) {
                return course // Return original if fetch fails
              }
              
              assignmentsData = await assignmentsRes.json()
              groupsData = await groupsRes.json()
              const gradingSchemeData = await gradingSchemeRes.json()
              gradingScheme = gradingSchemeData?.grading_scheme
              
              // Cache the fetched data
              setCachedCourseData(course.id, {
                assignments: assignmentsData,
                groups: groupsData,
                gradingScheme: gradingScheme
              })
            }
            
            // Filter assignments by semester
            const semesterAssignments = assignmentsData.filter((assignment) => {
              const dueDate = assignment?.assignment?.due_at
              if (!dueDate) return true
              return getSemester(dueDate) === parseInt(semester)
            })
            
            if (semesterAssignments.length === 0) {
              return { ...course, current_score: null, current_grade: 'N/A' }
            }
            
            // Calculate grade for this semester
            const gradeRes = await fetch('/api/calculate-grade', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                assignments: semesterAssignments,
                assignment_groups: groupsData,
                modifications: {}
              })
            })
            
            const gradeData = await gradeRes.json()
            const semesterScore = gradeData.grade
            
            // Convert to letter grade using course's grading scheme
            const letterGrade = scoreToLetterGrade(semesterScore, gradingScheme)
            
            // Cache the calculated semester grade
            const cachedCourseData = getCachedCourseData(course.id) || {}
            const semesterKey = `semester${semester}`
            setCachedCourseData(course.id, {
              ...cachedCourseData,
              assignments: assignmentsData,
              groups: groupsData,
              gradingScheme: gradingScheme,
              [semesterKey]: {
                score: semesterScore,
                grade: letterGrade
              }
            })
            
            return {
              ...course,
              current_score: semesterScore,
              current_grade: letterGrade
            }
          } catch (error) {
            console.error(`Error calculating semester grade for course ${course.id}:`, error)
            return course
          }
        })
      )
      
      setCourses(updatedCourses)
      setLoadingSemesterGrades(false)
    }
  }

  // Recalculate current grade based on semester selection
  const recalculateCurrentGrade = async (semester) => {
    if (!assignments || assignments.length === 0) return
    
    try {
      let filteredAssignments = assignments
      
      if (semester !== 'all') {
        filteredAssignments = assignments.filter((assignment) => {
          const dueDate = assignment?.assignment?.due_at
          if (!dueDate) return true // Include assignments without due dates
          return getSemester(dueDate) === parseInt(semester)
        })
      }
      
      const response = await fetch('/api/calculate-grade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignments: filteredAssignments,
          assignment_groups: assignmentGroups,
          modifications: {} // Use empty modifications for current grade baseline
        })
      })
      
      const data = await response.json()
      setCurrentGrade(data.grade)
      
      // Don't reset modifications, dropped assignments, or projected grade
      // Let the user keep their what-if changes when switching semesters
      
      // If there are modifications, recalculate projected grade for the new semester
      if (Object.keys(modifications).length > 0 || Object.keys(droppedAssignments).length > 0 || Object.keys(hypotheticalAssignments).length > 0) {
        // Trigger a recalculation of projected grade with current modifications
        setTimeout(() => {
          calculateProjectedGrade()
        }, 100)
      }
    } catch (err) {
      console.error('Error recalculating grade:', err)
    }
  }

  // Update custom course name
  const updateCourseName = (courseId, newName) => {
    const updatedNames = { ...customCourseNames }
    if (newName.trim() === '') {
      delete updatedNames[courseId]
    } else {
      updatedNames[courseId] = newName.trim()
    }
    setCustomCourseNames(updatedNames)
    localStorage.setItem('customCourseNames', JSON.stringify(updatedNames))
  }

  // Open assignment detail view
  const openAssignmentDetail = (assignment, submission, groupName, index) => {
    setSelectedAssignmentDetail({
      assignment,
      submission,
      groupName,
      index,
      pointsPossible: assignment?.points_possible || 0,
      score: submission?.score,
      gradedAt: submission?.graded_at,
      submittedAt: submission?.submitted_at,
      comments: submission?.submission_comments || [],
      htmlUrl: assignment?.html_url
    })
    setShowAssignmentDetail(true)
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

  // Apply saved semester filter when courses are first loaded
  useEffect(() => {
    if (isAuthenticated && courses.length > 0 && !selectedCourse && !hasAppliedInitialSemesterFilter.current) {
      const savedSemester = localStorage.getItem('selectedSemester')
      // Only apply if a specific semester was saved
      if (savedSemester && savedSemester !== 'all') {
        hasAppliedInitialSemesterFilter.current = true
        updateCourseGradesForSemester(savedSemester)
      }
    }
  }, [isAuthenticated, courses.length])

  // Detect if device is mobile
  const isMobile = () => {
    return window.innerWidth <= 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
  }

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: isMobile() ? 50 : 8, // Require more movement on mobile to prevent accidental drags
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

  // Handle browser back/forward buttons
  useEffect(() => {
    const handlePopState = (event) => {
      if (event.state) {
        if (event.state.courseId) {
          // Navigate to specific course (skip adding to history)
          loadCourse(event.state.courseId, true)
        } else if (event.state.page === 'courses') {
          // Navigate back to courses list
          setSelectedCourse(null)
        }
      }
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [courses])

  // Auto-login if token exists
  useEffect(() => {
    const savedToken = localStorage.getItem('canvasToken')
    const savedUrl = localStorage.getItem('canvasUrl')
    const hasBeenAuthenticated = sessionStorage.getItem('hasBeenAuthenticated')
    
    if (savedToken && savedUrl && !isAuthenticated) {
      setToken(savedToken)
      setCanvasUrl(savedUrl)
      
      // If user has been authenticated this session (refresh), skip loading screen
      if (hasBeenAuthenticated) {
        setIsInitialLoad(false)
      } else {
        setLoading(true) // Show loading for first visit
      }
      
      // Trigger login automatically
      handleLogin({ preventDefault: () => {} })
    }
  }, [])

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setShowSlowLoadingMessage(false)
    setLoadingProgress(0)
    
    // Simulate progress bar - continues slowly even when waiting
    const progressInterval = setInterval(() => {
      setLoadingProgress(prev => {
        if (prev >= 95) return prev // Cap at 95% until actual completion
        // Slow down as we get closer to the cap
        const increment = prev < 60 ? Math.random() * 5 : Math.random() * 2
        return prev + increment
      })
    }, 500) // Slower interval
    
    // Show slow loading message after 3 seconds
    const slowLoadingTimer = setTimeout(() => {
      setShowSlowLoadingMessage(true)
    }, 3000)
    
    try {
      setLoadingProgress(10) // Initial progress
      const response = await fetch('/api/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, canvasUrl })
      })
      
      setLoadingProgress(75) // After fetch completes
      
      if (!response.ok) throw new Error('Invalid token or network error')
      
      const data = await response.json()
      setLoadingProgress(90) // After parsing
      
      // Handle new response format with user info
      const courses = data.courses || data // Fallback for old format
      const user = data.user || { name: 'Anonymous', id: null }
      
      // Store user info
      setUserInfo(user)
      
      // Load saved course order
      const savedOrder = localStorage.getItem('courseOrder')
      if (savedOrder) {
        try {
          const orderMap = JSON.parse(savedOrder)
          const orderedCourses = [...courses].sort((a, b) => {
            const orderA = orderMap[a.id] ?? 999
            const orderB = orderMap[b.id] ?? 999
            return orderA - orderB
          })
          setCourses(orderedCourses)
        } catch {
          setCourses(courses)
        }
      } else {
        setCourses(courses)
      }
      
      setIsAuthenticated(true)
      
      // Save token and Canvas URL to localStorage
      localStorage.setItem('canvasToken', token)
      localStorage.setItem('canvasUrl', canvasUrl)
      
      // Mark that user has been authenticated this session (for refresh detection)
      sessionStorage.setItem('hasBeenAuthenticated', 'true')
      
      // Set initial history state for courses page
      window.history.replaceState({ page: 'courses' }, '', '#courses')
      
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
          setUpcomingAssignments(data || [])
          setLoadingUpcoming(false)
        })
        .catch(err => {
          console.error('Error fetching upcoming:', err)
          setLoadingUpcoming(false)
        })

      // Fetch overdue assignments in background
      setLoadingOverdue(true)
      fetch('/api/overdue-assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, canvasUrl })
      })
        .then(res => {
          if (res.ok) return res.json()
          throw new Error('Failed to fetch')
        })
        .then(data => {
          setOverdueAssignments(data || [])
          setLoadingOverdue(false)
        })
        .catch(err => {
          console.error('Error fetching overdue:', err)
          setLoadingOverdue(false)
        })
    } catch (err) {
      setError(err.message)
    } finally {
      clearInterval(progressInterval)
      clearTimeout(slowLoadingTimer)
      setLoadingProgress(100) // Complete the progress bar
      setTimeout(() => {
        setLoading(false)
        setShowSlowLoadingMessage(false)
        setLoadingProgress(0)
      }, 300) // Brief delay to show 100%
    }
  }

  const loadCourse = async (courseId, skipHistory = false) => {
    setLoading(true)
    setError('')
    setModifications({})
    setDroppedAssignments({})
    setProjectedGrade(null)
    setHypotheticalAssignments({})
    setSelectedCourse({ id: courseId, name: 'Loading...', loading: true })
    
    // Get course name for logging
    const courseName = courses.find(c => c.id === courseId)?.name || 'Unknown Course'
    console.log(`📚 Loading course: ${courseName}`)
    
    // Push to browser history (unless navigating via back/forward)
    if (!skipHistory) {
      window.history.pushState(
        { courseId, page: 'course' },
        '',
        `#course/${courseId}`
      )
    }
    
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
      
      // Calculate semester grades after loading assignments
      // Use a small delay to ensure state is updated
      setTimeout(() => {
        calculateSemesterGrades()
      }, 100)
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
    
    // Show calculate prompt when modifications are made
    if (Object.keys(newMods).length > 0 || Object.keys(droppedAssignments).length > 0 || Object.keys(hypotheticalAssignments).length > 0) {
      setShowCalculatePrompt(true)
    } else {
      setShowCalculatePrompt(false)
    }
  }

  const toggleDropAssignment = (index) => {
    setDroppedAssignments(prev => {
      const newDropped = { ...prev }
      if (newDropped[index]) {
        delete newDropped[index]
      } else {
        newDropped[index] = true
      }
      
      // Show calculate prompt when assignments are dropped/restored
      setTimeout(() => {
        if (Object.keys(modifications).length > 0 || Object.keys(newDropped).length > 0 || Object.keys(hypotheticalAssignments).length > 0) {
          setShowCalculatePrompt(true)
        } else {
          setShowCalculatePrompt(false)
        }
      }, 0)
      
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
    setHypotheticalAssignments(prev => {
      const updated = {
        ...prev,
        [groupId]: prev[groupId].map(a => 
          a.id === assignmentId ? { ...a, [field]: value } : a
        )
      }
      
      // Show calculate prompt when hypothetical assignments are updated
      setTimeout(() => {
        if (Object.keys(modifications).length > 0 || Object.keys(droppedAssignments).length > 0 || Object.keys(updated).length > 0) {
          setShowCalculatePrompt(true)
        } else {
          setShowCalculatePrompt(false)
        }
      }, 0)
      
      return updated
    })
  }

  const removeHypotheticalAssignment = (groupId, assignmentId) => {
    setHypotheticalAssignments(prev => {
      const updated = {
        ...prev,
        [groupId]: prev[groupId].filter(a => a.id !== assignmentId)
      }
      
      // Show calculate prompt when hypothetical assignments are removed
      setTimeout(() => {
        if (Object.keys(modifications).length > 0 || Object.keys(droppedAssignments).length > 0 || Object.keys(updated).length > 0) {
          setShowCalculatePrompt(true)
        } else {
          setShowCalculatePrompt(false)
        }
      }, 0)
      
      return updated
    })
  }

  const calculateProjectedGrade = async () => {
    setLoading(true)
    try {
      // Filter out dropped assignments and merge hypothetical assignments
      const filteredAssignments = assignments.filter((_, index) => !droppedAssignments[index])
      
      // Apply semester filter
      const semesterFilteredAssignments = filterAssignmentsBySemester(filteredAssignments)
      
      const allAssignments = [...semesterFilteredAssignments]
      
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
      setShowCalculatePrompt(false) // Hide prompt after successful calculation
      
      // Also recalculate semester grades with modifications
      calculateSemesterGrades()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Calculate grades for each semester
  const calculateSemesterGrades = async () => {
    try {
      // Calculate Semester 1 grade
      const semester1Assignments = assignments.filter((assignment) => {
        const dueDate = assignment?.assignment?.due_at
        if (!dueDate) return false
        return getSemester(dueDate) === 1
      })

      // Filter out dropped assignments for semester 1
      const semester1FilteredAssignments = semester1Assignments.filter((_, index) => {
        const originalIndex = assignments.indexOf(semester1Assignments[index])
        return !droppedAssignments[originalIndex]
      })

      // Add hypothetical assignments for semester 1
      const semester1WithHypotheticals = [...semester1FilteredAssignments]
      Object.entries(hypotheticalAssignments).forEach(([groupId, hypoAssignments]) => {
        hypoAssignments.forEach(hypo => {
          if (hypo.score !== '' && hypo.pointsPossible !== '') {
            semester1WithHypotheticals.push({
              assignment: {
                assignment_group_id: parseInt(groupId),
                points_possible: parseFloat(hypo.pointsPossible),
                name: hypo.name || 'Hypothetical Assignment',
                due_at: new Date(new Date().getFullYear(), 8, 1).toISOString() // Default to Sept 1 (Semester 1)
              },
              score: parseFloat(hypo.score)
            })
          }
        })
      })

      if (semester1WithHypotheticals.length > 0) {
        // Create modifications map with original indices for semester 1
        const semester1Modifications = {}
        semester1Assignments.forEach((assignment, semesterIndex) => {
          const originalIndex = assignments.indexOf(assignment)
          if (modifications[originalIndex] !== undefined) {
            semesterIndex // Use semester index for the filtered array
            semester1Modifications[semesterIndex] = modifications[originalIndex]
          }
        })

        const response1 = await fetch('/api/calculate-grade', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            assignments: semester1WithHypotheticals,
            assignment_groups: assignmentGroups,
            modifications: semester1Modifications
          })
        })
        const data1 = await response1.json()
        setSemester1Grade(data1.grade)
      } else {
        setSemester1Grade(null)
      }

      // Calculate Semester 2 grade
      const semester2Assignments = assignments.filter((assignment) => {
        const dueDate = assignment?.assignment?.due_at
        if (!dueDate) return false
        return getSemester(dueDate) === 2
      })

      // Filter out dropped assignments for semester 2
      const semester2FilteredAssignments = semester2Assignments.filter((_, index) => {
        const originalIndex = assignments.indexOf(semester2Assignments[index])
        return !droppedAssignments[originalIndex]
      })

      // Add hypothetical assignments for semester 2
      const semester2WithHypotheticals = [...semester2FilteredAssignments]
      Object.entries(hypotheticalAssignments).forEach(([groupId, hypoAssignments]) => {
        hypoAssignments.forEach(hypo => {
          if (hypo.score !== '' && hypo.pointsPossible !== '') {
            semester2WithHypotheticals.push({
              assignment: {
                assignment_group_id: parseInt(groupId),
                points_possible: parseFloat(hypo.pointsPossible),
                name: hypo.name || 'Hypothetical Assignment',
                due_at: new Date(new Date().getFullYear(), 1, 1).toISOString() // Default to Feb 1 (Semester 2)
              },
              score: parseFloat(hypo.score)
            })
          }
        })
      })

      if (semester2WithHypotheticals.length > 0) {
        // Create modifications map with original indices for semester 2
        const semester2Modifications = {}
        semester2Assignments.forEach((assignment, semesterIndex) => {
          const originalIndex = assignments.indexOf(assignment)
          if (modifications[originalIndex] !== undefined) {
            semester2Modifications[semesterIndex] = modifications[originalIndex]
          }
        })

        const response2 = await fetch('/api/calculate-grade', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            assignments: semester2WithHypotheticals,
            assignment_groups: assignmentGroups,
            modifications: semester2Modifications
          })
        })
        const data2 = await response2.json()
        setSemester2Grade(data2.grade)
      } else {
        setSemester2Grade(null)
      }
    } catch (err) {
      console.error('Error calculating semester grades:', err)
    }
  }

  const groupedAssignments = () => {
    const grouped = {}
    const groupMap = {}
    
    assignmentGroups.forEach(g => {
      groupMap[g.id] = g
      grouped[g.id] = []
    })
    
    // Filter assignments by semester before grouping
    const filteredAssignments = filterAssignmentsBySemester(assignments)
    
    filteredAssignments.forEach((s, i) => {
      const assignment = s.assignment || {}
      const groupId = assignment.assignment_group_id
      if (groupId && grouped[groupId]) {
        // Use original index for modifications/drops to work correctly
        const originalIndex = assignments.indexOf(s)
        grouped[groupId].push({ ...s, index: originalIndex })
      }
    })
    
    return { grouped, groupMap }
  }

  if (!isAuthenticated) {
    // Show loading screen only on initial load (not on refresh)
    if (loading && localStorage.getItem('canvasToken') && isInitialLoad) {
      return (
        <div className="container">
          <div className="auto-login-loading">
            <div className="loading-spinner"></div>
            <h2>Welcome back!</h2>
            <p>Loading your Canvas data...</p>
            <div className="progress-container">
              <div className="progress-bar">
                <div 
                  className="progress-fill" 
                  style={{ width: `${loadingProgress}%` }}
                ></div>
              </div>
              <div className="progress-text">
                {loadingProgress < 40 && 'Connecting to Canvas...'}
                {loadingProgress >= 40 && loadingProgress < 75 && 'Loading your courses...'}
                {loadingProgress >= 75 && loadingProgress < 95 && 'Processing data...'}
                {loadingProgress >= 95 && loadingProgress < 100 && 'Almost there...'}
                {loadingProgress >= 100 && 'Complete!'}
              </div>
            </div>
            {showSlowLoadingMessage && (
              <div className="slow-loading-message">
                The server may be waking up from inactivity. This can slow down the first load.
              </div>
            )}
          </div>
        </div>
      )
    }
    
    // On refresh, show nothing (blank screen) while loading
    if (loading && localStorage.getItem('canvasToken') && !isInitialLoad) {
      return null
    }

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
          {loading && (
            <div className="progress-container">
              <div className="progress-bar">
                <div 
                  className="progress-fill" 
                  style={{ width: `${loadingProgress}%` }}
                ></div>
              </div>
              <div className="progress-text">
                {loadingProgress < 40 && 'Connecting to Canvas...'}
                {loadingProgress >= 40 && loadingProgress < 75 && 'Loading your courses...'}
                {loadingProgress >= 75 && loadingProgress < 95 && 'Processing data...'}
                {loadingProgress >= 95 && loadingProgress < 100 && 'Almost there...'}
                {loadingProgress >= 100 && 'Complete!'}
              </div>
            </div>
          )}
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
          <div className="header-buttons">
            <button onClick={() => setShowNameEditor(true)} className="edit-names-btn">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="m18.5 2.5 a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
              Edit Names
            </button>
            <button onClick={() => {
              setIsAuthenticated(false)
              localStorage.removeItem('canvasToken')
              localStorage.removeItem('canvasUrl')
              clearCourseCache() // Clear cache on logout
              setToken('')
              setCanvasUrl('cuhsd.instructure.com')
            }} className="logout-btn">
              Logout
            </button>
          </div>
        </div>
        
        {/* Semester Selector for Homepage */}
        <div className="homepage-semester-selector">
          <div className="semester-buttons">
            <button 
              className={`semester-btn ${selectedSemester === 'all' ? 'active' : ''}`}
              onClick={() => changeSemester('all')}
              disabled={loadingSemesterGrades}
            >
              All Year
            </button>
            <button 
              className={`semester-btn ${selectedSemester === '1' ? 'active' : ''}`}
              onClick={() => changeSemester('1')}
              disabled={loadingSemesterGrades}
            >
              Semester 1
            </button>
            <button 
              className={`semester-btn ${selectedSemester === '2' ? 'active' : ''}`}
              onClick={() => changeSemester('2')}
              disabled={loadingSemesterGrades}
            >
              Semester 2
            </button>
          </div>
          {loadingSemesterGrades && (
            <p className="semester-note">
              <span className="loading-spinner-small"></span>
              Calculating semester grades...
            </p>
          )}
          {!loadingSemesterGrades && selectedSemester !== 'all' && (
            <p className="semester-note">
              Showing grades for Semester {selectedSemester} only
            </p>
          )}
        </div>
        
        {isMobile() ? (
          // On mobile, render course cards without drag-and-drop
          <div className="courses-grid">
            {courses.map(course => (
              <div
                key={course.id}
                className="course-card"
                onClick={() => loadCourse(course.id)}
              >
                <h3>{getDisplayName(course)}</h3>
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
            ))}
          </div>
        ) : (
          // On desktop, render with drag-and-drop functionality
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
                    displayName={getDisplayName(course)}
                    onClick={() => loadCourse(course.id)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}

        {(loadingUpcoming || loadingOverdue || upcomingAssignments.length > 0 || overdueAssignments.length > 0) && (
          <div className="assignments-section">
            <div className="assignments-tabs">
              <button 
                className={`tab-btn ${assignmentsTab === 'upcoming' ? 'active' : ''}`}
                onClick={() => setAssignmentsTab('upcoming')}
              >
                📋 Upcoming ({upcomingAssignments.length})
              </button>
              <button 
                className={`tab-btn ${assignmentsTab === 'overdue' ? 'active' : ''}`}
                onClick={() => setAssignmentsTab('overdue')}
              >
                ⚠️ Overdue ({overdueAssignments.length})
              </button>
            </div>

            <div className="tab-content">
              {assignmentsTab === 'upcoming' && (
                <div className="upcoming-tab">
                  {loadingUpcoming && (
                    <div className="loading-assignments">Loading upcoming assignments...</div>
                  )}
                  {!loadingUpcoming && upcomingAssignments.length === 0 && (
                    <div className="no-assignments">No upcoming assignments found</div>
                  )}
                  {!loadingUpcoming && upcomingAssignments.length > 0 && (
                    <div className="assignments-list">
                      {upcomingAssignments.map((assignment, index) => {
                        const dueDate = new Date(assignment.due_at)
                        const now = new Date()
                        const daysUntil = Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24))
                        const isUrgent = daysUntil <= 2
                        
                        return (
                          <div key={index} className={`assignment-item ${isUrgent ? 'urgent' : ''}`}>
                            <div className="assignment-info">
                              <div className="assignment-course">{assignment.course_name}</div>
                              <div className="assignment-name">{assignment.assignment_name}</div>
                              <div className="assignment-meta">
                                <span className="assignment-points">{assignment.points_possible} pts</span>
                                <span className="assignment-due">
                                  {isUrgent ? '' : ''}
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

              {assignmentsTab === 'overdue' && (
                <div className="overdue-tab">
                  {loadingOverdue && (
                    <div className="loading-assignments">Loading overdue assignments...</div>
                  )}
                  {!loadingOverdue && overdueAssignments.length === 0 && (
                    <div className="no-assignments">No overdue assignments found! 🎉</div>
                  )}
                  {!loadingOverdue && overdueAssignments.length > 0 && (
                    <div className="assignments-list">
                      {overdueAssignments.map((assignment, index) => {
                        const dueDate = new Date(assignment.due_at)
                        const lockDate = assignment.lock_at ? new Date(assignment.lock_at) : null
                        const now = new Date()
                        const isLocked = assignment.is_locked
                        
                        return (
                          <div key={index} className={`assignment-item overdue ${isLocked ? 'locked' : ''}`}>
                            <div className="assignment-info">
                              <div className="assignment-course">{assignment.course_name}</div>
                              <div className="assignment-name">
                                {assignment.assignment_name}
                                {isLocked && <span className="locked-badge">🔒 Locked</span>}
                              </div>
                              <div className="assignment-meta">
                                <span className="assignment-points">{assignment.points_possible} pts</span>
                                <span className="assignment-overdue">
                                  Was due {dueDate.toLocaleDateString()} at {dueDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                  <span className="days-overdue">({assignment.days_overdue} days ago)</span>
                                </span>
                                {lockDate && (
                                  <span className="lock-info">
                                    {isLocked ? 
                                      `🔒 Locked ${lockDate.toLocaleDateString()}` : 
                                      `⏰ Locks ${lockDate.toLocaleDateString()}`
                                    }
                                  </span>
                                )}
                              </div>
                            </div>
                            {assignment.html_url && !isLocked && (
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

        {/* Course Name Editor Modal */}
        {showNameEditor && (
          <>
            <div className="bg-overlay" onClick={() => setShowNameEditor(false)}></div>
            <div className="name-editor-modal">
              <div className="modal-header">
                <h3>Edit Course Names</h3>
                <button onClick={() => setShowNameEditor(false)} className="close-modal-btn">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
              <div className="modal-content">
                <p className="modal-hint">
                  Customize how your course names appear throughout the app. Leave blank to use the original Canvas name.
                </p>
                <div className="course-name-list">
                  {courses.map(course => (
                    <div key={course.id} className="course-name-item">
                      <div className="course-info">
                        <div className="original-name">{course.name}</div>
                        {course.current_grade && (
                          <div className="course-grade">{course.current_grade} ({course.current_score}%)</div>
                        )}
                      </div>
                      <div className="name-input-container">
                        <input
                          type="text"
                          placeholder="Custom display name (optional)"
                          value={customCourseNames[course.id] || ''}
                          onChange={(e) => updateCourseName(course.id, e.target.value)}
                          className="course-name-input"
                        />
                        {customCourseNames[course.id] && (
                          <button
                            onClick={() => updateCourseName(course.id, '')}
                            className="clear-name-btn"
                            title="Reset to original name"
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <line x1="18" y1="6" x2="6" y2="18"/>
                              <line x1="6" y1="6" x2="18" y2="18"/>
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="name-editor-actions">
                  <button onClick={() => setShowNameEditor(false)} className="done-btn">
                    Done
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    )
  }

  const { grouped, groupMap } = groupedAssignments()

  // Toggle bounce cards visibility
  const toggleBounceCards = () => {
    setShowBounceCards(prev => {
      const newValue = !prev
      localStorage.setItem('showBounceCards', JSON.stringify(newValue))
      return newValue
    })
  }

  // Toggle course visibility in bounce cards
  const toggleCourseVisibility = (courseId) => {
    setHiddenCourses(prev => {
      const newHidden = { ...prev }
      if (newHidden[courseId]) {
        delete newHidden[courseId]
      } else {
        newHidden[courseId] = true
      }
      localStorage.setItem('hiddenCourses', JSON.stringify(newHidden))
      return newHidden
    })
  }

  // Prepare cards for BounceCards component - filter out hidden courses
  const visibleCourses = courses.filter(course => !hiddenCourses[course.id])
  const bounceCardData = visibleCourses.map(course => ({
    id: course.id,
    name: getDisplayName(course),
    grade: course.current_grade,
    score: course.current_score,
    isActive: course.id === selectedCourse?.id
  }));

  // Dynamically generate transform styles based on number of courses
  const generateTransformStyles = (count) => {
    if (count === 0) return [];
    if (count === 1) return ['rotate(0deg)'];
    
    const styles = [];
    const spacing = 90; // pixels between cards
    const maxRotation = 3; // degrees - reduced for more subtle curve
    const centerIndex = (count - 1) / 2;
    
    for (let i = 0; i < count; i++) {
      const offset = i - centerIndex;
      const translateX = offset * spacing;
      const rotation = (offset / centerIndex) * maxRotation;
      styles.push(`rotate(${rotation.toFixed(1)}deg) translate(${translateX}px)`);
    }
    
    return styles;
  };

  const transformStyles = generateTransformStyles(bounceCardData.length);

  return (
    <div className="container">
      <div className="header">
        <button onClick={() => {
          setSelectedCourse(null)
          window.history.pushState({ page: 'courses' }, '', '#courses')
        }} className="back-btn">
          ← Back to Courses
        </button>
        <h1>{getDisplayName(selectedCourse)}</h1>
        {courses.length > 1 && (
          <>
            <button 
              onClick={toggleBounceCards} 
              className={`toggle-cards-btn ${showBounceCards ? 'active' : ''}`}
              title={showBounceCards ? 'Hide course cards' : 'Show course cards'}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7" rx="1"/>
                <rect x="14" y="3" width="7" height="7" rx="1"/>
                <rect x="14" y="14" width="7" height="7" rx="1"/>
                <rect x="3" y="14" width="7" height="7" rx="1"/>
              </svg>
              <span>{showBounceCards ? 'Hide' : 'Show'} Cards</span>
            </button>
            {showBounceCards && (
              <button onClick={() => setShowCourseManager(!showCourseManager)} className="manage-courses-btn">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="1"/>
                  <circle cx="12" cy="5" r="1"/>
                  <circle cx="12" cy="19" r="1"/>
                </svg>
                <span>Manage</span>
              </button>
            )}
          </>
        )}
      </div>

      {/* Course Manager Modal */}
      {showCourseManager && (
        <>
          <div className="bg-overlay" onClick={() => setShowCourseManager(false)}></div>
          <div className="course-manager-modal">
            <div className="modal-header">
              <h3>Manage Course Cards</h3>
              <button onClick={() => setShowCourseManager(false)} className="close-modal-btn">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <div className="modal-content">
              <p className="modal-hint">Select which courses are shown in the cards</p>
              <div className="course-list">
                {courses.map(course => (
                  <label key={course.id} className="course-toggle">
                    <input
                      type="checkbox"
                      checked={!hiddenCourses[course.id]}
                      onChange={() => toggleCourseVisibility(course.id)}
                    />
                    <span className="course-toggle-name">{getDisplayName(course)}</span>
                    {course.current_grade && (
                      <span className="course-toggle-grade">{course.current_grade} ({course.current_score}%)</span>
                    )}
                  </label>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* BounceCards for switching between courses */}
      {!loading && showBounceCards && bounceCardData.length > 1 && (
        <BounceCards
          cards={bounceCardData}
          containerWidth={Math.min(800, 200 + bounceCardData.length * 90)}
          containerHeight={280}
          animationDelay={0.3}
          animationStagger={0.08}
          easeType="elastic.out(1, 0.5)"
          transformStyles={transformStyles}
          enableHover={true}
          onCardClick={(card) => {
            if (card.id !== selectedCourse?.id) {
              loadCourse(card.id);
            }
          }}
        />
      )}

      {loading && (
        <div className="loading-overlay">
          <div className="loading-spinner"></div>
          <div className="loading-text">Loading course data...</div>
          <div className="loading-watermark">
            Made by Sahaj Khandelwal
            <span className="watermark-separator">•</span>
            <button onClick={() => setShowFeedback(true)} className="feedback-link">
              Send Feedback
            </button>
          </div>
        </div>
      )}

      {/* Feedback Modal */}
      {showFeedback && (
        <>
          <div className="bg-overlay" onClick={() => setShowFeedback(false)}></div>
          <div className="feedback-modal">
            <div className="modal-header">
              <h3>Send Feedback</h3>
              <button onClick={() => setShowFeedback(false)} className="close-modal-btn">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <div className="modal-content">
              {!feedbackSubmitted ? (
                <>
                  <p className="modal-hint">
                    Have a suggestion, found a bug, or just want to say hi? Let me know!
                  </p>
                  <textarea
                    className="feedback-textarea"
                    placeholder="Your feedback here..."
                    value={feedbackText}
                    onChange={(e) => setFeedbackText(e.target.value)}
                    rows={6}
                  />
                  <div className="feedback-actions">
                    <button 
                      onClick={() => {
                        setShowFeedback(false)
                        setFeedbackText('')
                      }} 
                      className="cancel-btn"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={async () => {
                        if (feedbackText.trim()) {
                          try {
                            const response = await fetch('/api/feedback', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ 
                                feedback: feedbackText,
                                email: userInfo.name || 'Anonymous',
                                userId: userInfo.id
                              })
                            })
                            
                            if (response.ok) {
                              setFeedbackSubmitted(true)
                              setTimeout(() => {
                                setShowFeedback(false)
                                setFeedbackSubmitted(false)
                                setFeedbackText('')
                              }, 2000)
                            } else {
                              alert('Failed to send feedback. Please try again.')
                            }
                          } catch (error) {
                            console.error('Error sending feedback:', error)
                            alert('Failed to send feedback. Please try again.')
                          }
                        }
                      }}
                      className="submit-btn"
                      disabled={!feedbackText.trim()}
                    >
                      Send Feedback
                    </button>
                  </div>
                </>
              ) : (
                <div className="feedback-success">
                  <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                    <polyline points="22 4 12 14.01 9 11.01"/>
                  </svg>
                  <h4>Thank you!</h4>
                  <p>Your feedback has been sent.</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Assignment Detail Modal */}
      {showAssignmentDetail && selectedAssignmentDetail && (
        <>
          <div className="bg-overlay" onClick={() => setShowAssignmentDetail(false)}></div>
          <div className="assignment-detail-modal">
            <div className="modal-header">
              <h3>{selectedAssignmentDetail.assignment?.name || 'Assignment Details'}</h3>
              <button onClick={() => setShowAssignmentDetail(false)} className="close-modal-btn">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <div className="assignment-detail-content">
              <div className="assignment-detail-main">
                <div className="assignment-detail-section">
                  <h4>Assignment Information</h4>
                  <div className="detail-grid">
                    <div className="detail-item">
                      <label>Course Category</label>
                      <span>{selectedAssignmentDetail.groupName}</span>
                    </div>
                    <div className="detail-item">
                      <label>Points Possible</label>
                      <span>{selectedAssignmentDetail.pointsPossible}</span>
                    </div>
                    <div className="detail-item">
                      <label>Current Score</label>
                      <span>
                        {selectedAssignmentDetail.score !== null ? (
                          <>
                            {selectedAssignmentDetail.score} / {selectedAssignmentDetail.pointsPossible}
                            {selectedAssignmentDetail.pointsPossible > 0 && (
                              <span className="detail-percentage">
                                ({((selectedAssignmentDetail.score / selectedAssignmentDetail.pointsPossible) * 100).toFixed(2)}%)
                              </span>
                            )}
                          </>
                        ) : (
                          'Not graded'
                        )}
                      </span>
                    </div>
                    {modifications[selectedAssignmentDetail.index] !== undefined && (
                      <div className="detail-item">
                        <label>Modified Score</label>
                        <span className="modified-score">
                          {modifications[selectedAssignmentDetail.index]} / {selectedAssignmentDetail.pointsPossible}
                          {selectedAssignmentDetail.pointsPossible > 0 && (
                            <span className="detail-percentage">
                              ({((modifications[selectedAssignmentDetail.index] / selectedAssignmentDetail.pointsPossible) * 100).toFixed(2)}%)
                            </span>
                          )}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {selectedAssignmentDetail.assignment?.description && (
                  <div className="assignment-detail-section">
                    <h4>Description</h4>
                    <div 
                      className="assignment-description"
                      dangerouslySetInnerHTML={{ __html: selectedAssignmentDetail.assignment.description }}
                    />
                  </div>
                )}

                <div className="assignment-detail-section">
                  <h4>Timeline</h4>
                  <div className="timeline-grid">
                    {selectedAssignmentDetail.assignment?.due_at && (
                      <div className="timeline-item">
                        <div className="timeline-icon">📅</div>
                        <div className="timeline-content">
                          <label>Due Date</label>
                          <span>{new Date(selectedAssignmentDetail.assignment.due_at).toLocaleString()}</span>
                        </div>
                      </div>
                    )}
                    {selectedAssignmentDetail.submittedAt && (
                      <div className="timeline-item">
                        <div className="timeline-icon">📤</div>
                        <div className="timeline-content">
                          <label>Submitted</label>
                          <span>{new Date(selectedAssignmentDetail.submittedAt).toLocaleString()}</span>
                        </div>
                      </div>
                    )}
                    {selectedAssignmentDetail.gradedAt && (
                      <div className="timeline-item">
                        <div className="timeline-icon">✅</div>
                        <div className="timeline-content">
                          <label>Graded</label>
                          <span>{new Date(selectedAssignmentDetail.gradedAt).toLocaleString()}</span>
                        </div>
                      </div>
                    )}
                    {selectedAssignmentDetail.assignment?.lock_at && (
                      <div className="timeline-item">
                        <div className="timeline-icon">🔒</div>
                        <div className="timeline-content">
                          <label>Locks</label>
                          <span>{new Date(selectedAssignmentDetail.assignment.lock_at).toLocaleString()}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {selectedAssignmentDetail.comments && selectedAssignmentDetail.comments.length > 0 && (
                  <div className="assignment-detail-section">
                    <h4>Comments</h4>
                    <div className="comments-list">
                      {selectedAssignmentDetail.comments.map((comment, idx) => (
                        <div key={idx} className="comment-item">
                          <div className="comment-author">{comment.author_name}</div>
                          <div className="comment-text">{comment.comment}</div>
                          <div className="comment-date">
                            {new Date(comment.created_at).toLocaleString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="assignment-detail-sidebar">
                <div className="detail-actions">
                  <h4>Quick Actions</h4>
                  
                  <div className="action-item">
                    <label>Modify Score</label>
                    <input
                      type="number"
                      step="0.01"
                      max={selectedAssignmentDetail.pointsPossible}
                      placeholder={selectedAssignmentDetail.score !== null ? selectedAssignmentDetail.score : 'Enter score'}
                      value={modifications[selectedAssignmentDetail.index] !== undefined ? modifications[selectedAssignmentDetail.index] : ''}
                      onChange={(e) => handleModification(selectedAssignmentDetail.index, e.target.value)}
                      className="detail-score-input"
                      disabled={droppedAssignments[selectedAssignmentDetail.index]}
                    />
                  </div>

                  <div className="action-item">
                    <label className="drop-checkbox-detail">
                      <input
                        type="checkbox"
                        checked={droppedAssignments[selectedAssignmentDetail.index] || false}
                        onChange={() => toggleDropAssignment(selectedAssignmentDetail.index)}
                      />
                      <span>Drop from grade calculation</span>
                    </label>
                  </div>

                  {selectedAssignmentDetail.htmlUrl && (
                    <button 
                      onClick={() => window.open(selectedAssignmentDetail.htmlUrl, '_blank', 'noopener,noreferrer')}
                      className="open-canvas-btn"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                        <polyline points="15 3 21 3 21 9"/>
                        <line x1="10" y1="14" x2="21" y2="3"/>
                      </svg>
                      Open in Canvas
                    </button>
                  )}
                </div>

                {/* Grading Information Section */}
                <div className="grading-info-section">
                  <h4>Grading Information</h4>
                  
                  {selectedAssignmentDetail.gradedAt && (
                    <div className="grading-detail">
                      <div className="grading-icon">✅</div>
                      <div className="grading-content">
                        <label>Graded On</label>
                        <span>{new Date(selectedAssignmentDetail.gradedAt).toLocaleDateString()}</span>
                        <span className="grading-time">
                          {new Date(selectedAssignmentDetail.gradedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </span>
                      </div>
                    </div>
                  )}

                  {selectedAssignmentDetail.comments && selectedAssignmentDetail.comments.length > 0 && (
                    <div className="sidebar-comments">
                      <div className="comments-header">
                        <div className="comments-icon">💬</div>
                        <span>Teacher Comments ({selectedAssignmentDetail.comments.length})</span>
                      </div>
                      <div className="sidebar-comments-list">
                        {selectedAssignmentDetail.comments.slice(0, 2).map((comment, idx) => (
                          <div key={idx} className="sidebar-comment-item">
                            <div className="sidebar-comment-author">{comment.author_name}</div>
                            <div className="sidebar-comment-text">
                              {comment.comment.length > 100 
                                ? `${comment.comment.substring(0, 100)}...` 
                                : comment.comment
                              }
                            </div>
                            <div className="sidebar-comment-date">
                              {new Date(comment.created_at).toLocaleDateString()}
                            </div>
                          </div>
                        ))}
                        {selectedAssignmentDetail.comments.length > 2 && (
                          <div className="more-comments">
                            +{selectedAssignmentDetail.comments.length - 2} more comments
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {(!selectedAssignmentDetail.gradedAt && (!selectedAssignmentDetail.comments || selectedAssignmentDetail.comments.length === 0)) && (
                    <div className="no-grading-info">
                      <div className="no-info-icon">📝</div>
                      <span>No grading information available</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {!loading && (
        <>

      {/* Semester Selector */}
      <div className="semester-selector">
        <h3>View by Semester</h3>
        <div className="semester-buttons">
          <button 
            className={`semester-btn ${selectedSemester === 'all' ? 'active' : ''}`}
            onClick={() => changeSemester('all')}
          >
            All Year
          </button>
          <button 
            className={`semester-btn ${selectedSemester === '1' ? 'active' : ''}`}
            onClick={() => changeSemester('1')}
          >
            Semester 1
          </button>
          <button 
            className={`semester-btn ${selectedSemester === '2' ? 'active' : ''}`}
            onClick={() => changeSemester('2')}
          >
            Semester 2
          </button>
        </div>
        
        {/* Semester Grades Display */}
        {(semester1Grade !== null || semester2Grade !== null) && (
          <div className="semester-grades">
            {semester1Grade !== null && (
              <div className="semester-grade-item">
                <label>Semester 1 Grade</label>
                <div className="semester-grade-value">
                  <CountUp 
                    from={0} 
                    to={semester1Grade} 
                    duration={1}
                    className="count-up-text"
                  />%
                </div>
              </div>
            )}
            {semester2Grade !== null && (
              <div className="semester-grade-item">
                <label>Semester 2 Grade</label>
                <div className="semester-grade-value">
                  <CountUp 
                    from={0} 
                    to={semester2Grade} 
                    duration={1}
                    className="count-up-text"
                  />%
                </div>
              </div>
            )}
          </div>
        )}
      </div>

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
                    to={
                      selectedSemester === '1' && semester1Grade !== null ? semester1Grade :
                      selectedSemester === '2' && semester2Grade !== null ? semester2Grade :
                      projectedGrade
                    } 
                    duration={1}
                    className="count-up-text"
                  />%
                </div>
              </div>
              <div className="grade-box">
                <label>Change</label>
                <div className={`grade-value ${
                  (selectedSemester === '1' && semester1Grade !== null ? semester1Grade :
                   selectedSemester === '2' && semester2Grade !== null ? semester2Grade :
                   projectedGrade) - currentGrade >= 0 ? 'positive' : 'negative'
                }`}>
                  {(
                    (selectedSemester === '1' && semester1Grade !== null ? semester1Grade :
                     selectedSemester === '2' && semester2Grade !== null ? semester2Grade :
                     projectedGrade) - currentGrade >= 0 ? '+' : ''
                  )}
                  <CountUp 
                    from={0} 
                    to={Math.abs(
                      (selectedSemester === '1' && semester1Grade !== null ? semester1Grade :
                       selectedSemester === '2' && semester2Grade !== null ? semester2Grade :
                       projectedGrade) - currentGrade
                    )} 
                    duration={1}
                    className="count-up-text"
                  />%
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Assignment Search Section */}
      <div className="assignment-search-section">
        <div className="search-header">
          <h3>Assignment Search</h3>
          <button 
            onClick={() => setShowAssignmentSearch(!showAssignmentSearch)}
            className={`toggle-search-btn ${showAssignmentSearch ? 'active' : ''}`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/>
              <path d="m21 21-4.35-4.35"/>
            </svg>
            {showAssignmentSearch ? 'Hide Search' : 'Search Assignments'}
          </button>
        </div>
        
        {showAssignmentSearch && (
          <div className="search-content">
            <div className="search-input-container">
              <input
                type="text"
                placeholder="Search assignments by name..."
                value={assignmentSearch}
                onChange={(e) => setAssignmentSearch(e.target.value)}
                className="assignment-search-input"
              />
              {assignmentSearch && (
                <button 
                  onClick={() => setAssignmentSearch('')}
                  className="clear-search-btn"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              )}
            </div>
            
            {assignmentSearch.trim() && (
              <div className="search-results">
                {(() => {
                  const searchTerm = assignmentSearch.toLowerCase().trim()
                  const matchingAssignments = []
                  
                  // Search through all assignments
                  Object.entries(grouped).forEach(([groupId, groupAssignments]) => {
                    const group = groupMap[groupId]
                    groupAssignments.forEach((submissionData) => {
                      const { assignment, score, index } = submissionData
                      const assignmentName = assignment?.name || 'Unknown'
                      if (assignmentName.toLowerCase().includes(searchTerm)) {
                        matchingAssignments.push({
                          assignment,
                          score,
                          index,
                          groupName: group?.name || 'Unknown Group',
                          pointsPossible: assignment?.points_possible || 0,
                          submissionData // Add the full submission data
                        })
                      }
                    })
                  })
                  
                  if (matchingAssignments.length === 0) {
                    return (
                      <div className="no-search-results">
                        No assignments found matching "{assignmentSearch}"
                      </div>
                    )
                  }
                  
                  return (
                    <div className="search-results-list">
                      <div className="search-results-header">
                        Found {matchingAssignments.length} assignment{matchingAssignments.length !== 1 ? 's' : ''}:
                      </div>
                      {matchingAssignments.map(({ assignment, score, index, groupName, pointsPossible, submissionData }) => {
                        const currentScore = modifications[index] !== undefined ? modifications[index] : score
                        const percentage = pointsPossible > 0 && score !== null ? ((score / pointsPossible) * 100).toFixed(2) : null
                        
                        return (
                          <div 
                            key={index} 
                            className="search-result-item clickable"
                            onClick={(e) => {
                              if (e.target.tagName !== 'INPUT' && e.target.type !== 'checkbox') {
                                openAssignmentDetail(assignment, submissionData, groupName, index)
                              }
                            }}
                          >
                            <div className="search-result-info">
                              <div className="search-result-name">
                                {assignment?.name || 'Unknown'}
                                <span className="search-result-group">({groupName})</span>
                              </div>
                              <div className="search-result-details">
                                {score !== null ? (
                                  <>
                                    {percentage !== null && (
                                      <span className="search-result-percentage">
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
                              </div>
                            </div>
                            <div className="search-result-actions">
                              <label className="drop-checkbox" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="checkbox"
                                  checked={droppedAssignments[index] || false}
                                  onChange={() => toggleDropAssignment(index)}
                                  title="Drop this assignment from grade calculation"
                                />
                                <span className="checkbox-label">Drop</span>
                              </label>
                              <input
                                type="number"
                                step="0.01"
                                max={pointsPossible}
                                placeholder={score !== null ? score : 'Enter score'}
                                value={modifications[index] !== undefined ? modifications[index] : ''}
                                onChange={(e) => handleModification(index, e.target.value)}
                                className="search-score-input"
                                disabled={droppedAssignments[index]}
                              />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )
                })()}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="assignments-section">
        <div className="assignments-header">
          <div>
            <h2>What-If Analysis</h2>
            {selectedSemester !== 'all' && (
              <span className="semester-badge">
                Viewing Semester {selectedSemester}
              </span>
            )}
          </div>
        </div>
        <p className="hint">Modify assignment scores to see projected grade changes</p>
        <div className="user-tip">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <span>💡 Tip: Click on any assignment to view detailed information, comments, and timeline</span>
        </div>
        
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
            
            // Projected average (with modifications, dropped assignments, and hypothetical assignments)
            // Filter out dropped assignments
            const nonDroppedAssignments = gradedAssignments.filter(({ index }) => !droppedAssignments[index])
            
            // Calculate totals from non-dropped assignments with modifications
            let projectedEarned = nonDroppedAssignments.reduce((sum, { score, index }) => {
              const modifiedScore = modifications[index] !== undefined ? modifications[index] : score
              return sum + (modifiedScore || 0)
            }, 0)
            
            let projectedPossible = nonDroppedAssignments.reduce((sum, { assignment }) => {
              return sum + (assignment?.points_possible || 0)
            }, 0)
            
            // Add hypothetical assignments for this group
            const groupHypotheticals = hypotheticalAssignments[groupId] || []
            groupHypotheticals.forEach(hypo => {
              if (hypo.score !== '' && hypo.pointsPossible !== '') {
                projectedEarned += parseFloat(hypo.score) || 0
                projectedPossible += parseFloat(hypo.pointsPossible) || 0
              }
            })
            
            if (projectedPossible > 0) {
              projectedCategoryAverage = ((projectedEarned / projectedPossible) * 100).toFixed(2)
              
              // Check if there are any modifications (score changes, dropped assignments, or hypothetical assignments)
              hasModifications = Object.keys(modifications).some(modIndex => 
                gradedAssignments.some(({ index }) => index === parseInt(modIndex))
              ) || Object.keys(droppedAssignments).some(dropIndex => 
                gradedAssignments.some(({ index }) => index === parseInt(dropIndex))
              ) || groupHypotheticals.some(hypo => hypo.score !== '' && hypo.pointsPossible !== '')
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
                {groupAssignments.map((submissionData) => {
                  const { assignment, score, index } = submissionData
                  const pointsPossible = assignment?.points_possible || 0
                  const currentScore = modifications[index] !== undefined ? modifications[index] : score
                  const percentage = pointsPossible > 0 && score !== null ? ((score / pointsPossible) * 100).toFixed(2) : null
                  
                  const assignmentUrl = assignment?.html_url
                  
                  const handleAssignmentClick = (e) => {
                    if (e.target.tagName !== 'INPUT' && e.target.type !== 'checkbox') {
                      openAssignmentDetail(assignment, submissionData, group.name, index)
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

      {/* Floating Calculate Prompt */}
      {showCalculatePrompt && (
        <div className="calculate-prompt">
          <div className="calculate-prompt-content">
            <div className="calculate-prompt-text">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2h-4"/>
                <polyline points="6 9 12 15 18 9"/>
              </svg>
              <span>You have unsaved changes</span>
            </div>
            <div className="calculate-prompt-actions">
              <button 
                onClick={() => setShowCalculatePrompt(false)}
                className="dismiss-prompt-btn"
              >
                Dismiss
              </button>
              <button 
                onClick={calculateProjectedGrade}
                disabled={loading}
                className="calculate-prompt-btn"
              >
                {loading ? 'Calculating...' : 'Calculate Grade'}
              </button>
            </div>
          </div>
        </div>
      )}

      <Analytics />
    </div>
  )
}

export default App
